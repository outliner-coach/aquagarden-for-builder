import * as THREE from 'three'
import type { SceneEntity } from '../core/SceneRoot'
import { ObjectPool } from '../core/ObjectPool'
import { Fish } from './Fish'
import type { FishKind } from './Fish'
import { nextActiveCount } from './fishHelpers'
import { computeBoidsSteer } from './boids'
import type { BoidAgent } from './boids'
import { FISH, BOIDS } from '../../shared/config'
import { clampFishCount } from '../../shared/clamp'
import { loadFishPrototypes } from './fishAssets'
import type { SpeciesId, FishPrototype } from './fishAssets'

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
  private _targetCount: number
  private _nextSeed = 0
  private readonly _agentBuf: BoidAgent[] = []
  private _prototypes: Map<SpeciesId, FishPrototype> | null = null
  private _ready = false

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

  update(dt: number): void {
    if (!this._ready || !this._pool) return

    const current = this._pool.activeCount

    if (current < this._targetCount) {
      const next = nextActiveCount(current, this._targetCount, FISH.spawnPerTick)
      const toSpawn = next - current
      for (let i = 0; i < toSpawn; i++) {
        this._nextSeed++
        const fish = this._pool.acquire()
        fish.reset(this._nextSeed, this._assignKind())
      }
    } else if (current > this._targetCount) {
      this._pool.setActiveCount(this._targetCount)
    }

    // Boids: schooling 물고기만 조향 적용
    this._applyBoids()

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
