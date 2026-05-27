import * as THREE from 'three'
import type { SceneEntity } from '../core/SceneRoot'
import { ObjectPool } from '../core/ObjectPool'
import { Fish } from './Fish'
import type { FishKind } from './Fish'
import { nextActiveCount } from './fishHelpers'
import { computeBoidsSteer } from './boids'
import type { BoidAgent } from './boids'
import { FISH, BOIDS, LURE, FOOD, FEATURE } from '../../shared/config'
import { clampFishCount } from '../../shared/clamp'
import { loadFishPrototypes } from './fishAssets'
import type { SpeciesId, FishPrototype } from './fishAssets'
import { SPECIES_REGISTRY } from './speciesRegistry'
import { attractSteer, fleeSteer, isEaten } from './lureHelpers'
import { reconcileFeatures, featureSpawnPosition } from './featureHelpers'
import type { FoodParticles } from './FoodParticles'

const SCHOOLING_RATIO = 0.6

const BOIDS_WEIGHTS = {
  separationWeight: BOIDS.separationWeight,
  alignmentWeight: BOIDS.alignmentWeight,
  cohesionWeight: BOIDS.cohesionWeight,
}
const BOIDS_RADII = {
  separationRadius: BOIDS.separationRadius,
  alignmentRadius: BOIDS.alignmentRadius,
  cohesionRadius: BOIDS.cohesionRadius,
}

export class FishSchool implements SceneEntity {
  readonly object3d: THREE.Group
  private _pool: ObjectPool<Fish> | null = null
  private readonly _allFish: Fish[] = []
  private readonly _ambientFish: Fish[] = []
  private readonly _featureActive = new Map<SpeciesId, Fish>()
  private _desiredFeatures: ReadonlySet<SpeciesId> = new Set()
  private _featureSeed = 100000
  private _targetCount: number
  private _nextSeed = 0
  private readonly _agentBuf: BoidAgent[] = []
  private _prototypes: Map<SpeciesId, FishPrototype> | null = null
  private _ready = false

  /* feed/scare 상태 */
  private _foodParticles: FoodParticles | null = null
  private _scarePoint: THREE.Vector3 | null = null
  private _scareTimer = 0

  constructor() {
    this.object3d = new THREE.Group()
    this._targetCount = FISH.default
  }

  async init(): Promise<void> {
    const protos = await loadFishPrototypes()
    if (protos.size === 0) {
      console.warn('[FishSchool] 프로토타입 로드 실패, 빈 풀 유지')
      return
    }
    this._prototypes = protos
    this._pool = new ObjectPool<Fish>(
      () => this._createFish(),
      (fish) => fish.setVisible(false),
    )
    this._ready = true
  }

  setCount(n: number): void {
    this._targetCount = clampFishCount(n)
  }

  get activeCount(): number {
    return this._pool?.activeCount ?? 0
  }

  get ready(): boolean {
    return this._ready
  }

  /** 로드된 프로토타입 중 feature 카테고리 종 집합. 로드 실패 종은 제외(유령 차단). */
  availableFeatures(): Set<SpeciesId> {
    if (!this._prototypes) return new Set()
    return new Set(
      SPECIES_REGISTRY
        .filter((s) => s.category === 'feature' && this._prototypes!.has(s.id))
        .map((s) => s.id),
    )
  }

  /** 활성화할 특별 개체 종을 설정한다. 실제 reconcile은 update()에서 수행. */
  setEnabledFeatures(ids: SpeciesId[]): void {
    this._desiredFeatures = new Set(ids)
  }

  /** FoodParticles 참조를 설정한다 (먹이 소비 연동용). */
  setFoodParticles(fp: FoodParticles): void {
    this._foodParticles = fp
  }

  /** 먹이주기: 활성 먹이 입자가 있는 동안 물고기가 슬금슬금 모인다. */
  feedAt(): void {
    // feed 상태는 foodParticles.hasActive로 판단 — 별도 flag 불필요
  }

  /** 놀래키기: 클릭 지점에서 일정 시간 물고기가 도망한다. */
  scareAt(point: THREE.Vector3): void {
    this._scarePoint = point.clone()
    this._scareTimer = LURE.scareDurationMs / 1000
    // 속도 상한 일시 상향
    if (this._pool) {
      this._pool.forEachActive((fish) => fish.setSpeedMultiplier(LURE.scareSpeedMultiplier))
    }
  }

  update(dt: number): void {
    if (!this._ready || !this._pool) return

    // 앰비언트: _ambientFish 길이를 _targetCount로 점진 수렴
    if (this._ambientFish.length < this._targetCount) {
      const next = nextActiveCount(this._ambientFish.length, this._targetCount, FISH.spawnPerTick)
      for (let i = this._ambientFish.length; i < next; i++) {
        this._nextSeed++
        const fish = this._pool.acquire()
        fish.reset(this._nextSeed, this._assignKind())
        this._ambientFish.push(fish)
      }
    } else {
      while (this._ambientFish.length > this._targetCount) {
        const fish = this._ambientFish.pop()!
        this._pool.release(fish)
      }
    }

    // 특별 개체 reconcile
    const available = this.availableFeatures()
    const target = new Set([...this._desiredFeatures].filter((id) => available.has(id)))
    const active = new Set(this._featureActive.keys())
    const { acquire, release } = reconcileFeatures(target, active)
    for (const id of release) {
      const fish = this._featureActive.get(id)!
      this._pool.release(fish)
      this._featureActive.delete(id)
    }
    for (const id of acquire) {
      this._featureSeed++
      const fish = this._pool.acquire()
      fish.reset(this._featureSeed, 'individual', id)
      const p = featureSpawnPosition(this._featureSeed, FEATURE.spawnArea)
      fish.position.set(p.x, p.y, p.z)
      this._featureActive.set(id, fish)
    }

    // Boids: schooling 물고기만 조향 적용
    this._applyBoids()

    // Feed/Scare: 외부 조향을 합산 (boids 이후, update 이전)
    this._applyLureSteer(dt)

    this._pool.forEachActive((fish) => fish.update(dt))
  }

  /** 레이캐스트로 활성 물고기 중 가장 가까운 교차를 찾아 반환한다. 없으면 null. */
  raycast(raycaster: THREE.Raycaster): Fish | null {
    if (!this._pool) return null
    let closest: Fish | null = null
    let closestDist = Infinity

    this._pool.forEachActive((fish) => {
      const intersects = raycaster.intersectObject(fish.mesh, true)
      if (intersects.length > 0 && intersects[0].distance < closestDist) {
        closestDist = intersects[0].distance
        closest = fish
      }
    })

    return closest
  }

  dispose(): void {
    for (const fish of this._allFish) {
      fish.dispose()
    }
    this._allFish.length = 0
    this._ambientFish.length = 0
    this._featureActive.clear()
    // prototype 씬의 geometry/material을 dispose
    if (this._prototypes) {
      for (const proto of this._prototypes.values()) {
        proto.scene.traverse((o) => {
          const mesh = o as THREE.Mesh
          if (mesh.geometry) mesh.geometry.dispose()
          const mat = mesh.material
          if (Array.isArray(mat)) mat.forEach((m) => m.dispose())
          else if (mat) mat.dispose()
        })
      }
      this._prototypes = null
    }
  }

  private _applyLureSteer(dt: number): void {
    if (!this._pool) return

    const steer = new THREE.Vector3()

    // Scare 타이머 감소
    if (this._scareTimer > 0) {
      this._scareTimer -= dt
      if (this._scareTimer <= 0) {
        this._scarePoint = null
        this._scareTimer = 0
        // 속도 배율 복귀
        this._pool.forEachActive((fish) => fish.setSpeedMultiplier(1))
      }
    }

    // Feed: 활성 먹이 입자가 있으면 attract 적용 + 섭취 판정
    const foodActive = this._foodParticles?.hasActive ?? false
    const foodPositions = foodActive ? this._foodParticles!.activePositions() : []

    // Scare/Feed 어느 것도 없으면 스킵
    if (!this._scarePoint && foodPositions.length === 0) return

    this._pool.forEachActive((fish) => {
      steer.set(0, 0, 0)
      const pos = fish.position

      // Feed attract: 가장 가까운 먹이 입자로 조향
      if (foodPositions.length > 0) {
        let closestIdx = 0
        let closestDist = Infinity
        for (let i = 0; i < foodPositions.length; i++) {
          const fp = foodPositions[i]
          const dx = pos.x - fp.x
          const dy = pos.y - fp.y
          const dz = pos.z - fp.z
          const d2 = dx * dx + dy * dy + dz * dz
          if (d2 < closestDist) {
            closestDist = d2
            closestIdx = i
          }
        }

        const target = foodPositions[closestIdx]
        const a = attractSteer(
          { x: pos.x, y: pos.y, z: pos.z },
          { x: target.x, y: target.y, z: target.z },
          LURE.attractWeight,
          LURE.attractRadius,
        )
        steer.x += a.x
        steer.y += a.y
        steer.z += a.z

        // 섭취 판정
        if (isEaten({ x: pos.x, y: pos.y, z: pos.z }, target, FOOD.eatRadius)) {
          this._foodParticles!.consume(target.index)
          // 소비된 입자를 목록에서 제거 (다른 물고기가 동시 소비 방지)
          foodPositions.splice(closestIdx, 1)
        }
      }

      // Scare flee
      if (this._scarePoint) {
        const f = fleeSteer(
          { x: pos.x, y: pos.y, z: pos.z },
          { x: this._scarePoint.x, y: this._scarePoint.y, z: this._scarePoint.z },
          LURE.fleeWeight,
          LURE.fleeRadius,
        )
        steer.x += f.x
        steer.y += f.y
        steer.z += f.z
      }

      if (steer.x !== 0 || steer.y !== 0 || steer.z !== 0) {
        fish.applySteer(steer)
      }
    })
  }

  private _applyBoids(): void {
    if (!this._pool) return

    // schooling 물고기의 BoidAgent 목록 수집 (재할당 방지)
    this._agentBuf.length = 0
    const schoolingFish: Fish[] = []

    this._pool.forEachActive((fish) => {
      if (fish.kind === 'schooling') {
        schoolingFish.push(fish)
        this._agentBuf.push({
          position: fish.position,
          velocity: fish.velocity,
        })
      }
    })

    if (schoolingFish.length < 2) return

    const steer = new THREE.Vector3()
    for (let i = 0; i < schoolingFish.length; i++) {
      const self = this._agentBuf[i]
      // 자기 자신을 제외한 이웃 (O(n) 슬라이스 대신 전체 전달 후 내부 필터링)
      const neighbors = this._agentBuf.filter((_, j) => j !== i)
      const s = computeBoidsSteer(self, neighbors, BOIDS_WEIGHTS, BOIDS_RADII)

      // maxSteer 제한
      const mag = Math.sqrt(s.x * s.x + s.y * s.y + s.z * s.z)
      if (mag > BOIDS.maxSteer) {
        const scale = BOIDS.maxSteer / mag
        steer.set(s.x * scale, s.y * scale, s.z * scale)
      } else {
        steer.set(s.x, s.y, s.z)
      }

      schoolingFish[i].applySteer(steer)
    }
  }

  private _createFish(): Fish {
    const fish = new Fish(this._prototypes!)
    this.object3d.add(fish.mesh)
    this._allFish.push(fish)
    return fish
  }

  private _assignKind(): FishKind {
    return Math.random() < SCHOOLING_RATIO ? 'schooling' : 'individual'
  }
}
