import * as THREE from 'three'
import { clone as cloneSkeleton } from 'three/examples/jsm/utils/SkeletonUtils.js'
import { FISH } from '../../shared/config'
import type { FishPrototype } from './fishAssets'
import type { SpeciesId } from './speciesRegistry'
import { pickSpecies } from './fishAssets'
import { headingYaw } from './fishHelpers'

/* ── Types ── */

export type FishKind = 'schooling' | 'individual'

/* ── Seeded pseudo-random (결정적 초기값 생성) ── */

function pseudoRandom(seed: number, index: number): number {
  const x = Math.sin(seed * 127.1 + index * 311.7) * 43758.5453
  return x - Math.floor(x)
}

/* ── Constants ── */

const BOUNDARY_MARGIN = 0.8
const BOUNDARY_TURN_FORCE = 2.5

/* ── Fish ── */

export class Fish {
  readonly mesh: THREE.Group // 외곽: 위치·헤딩 회전·스케일
  private readonly _align: THREE.Group // 정렬: 머리 +X
  private _kind: FishKind = 'schooling'
  private _seed = 0
  private _baseSpeed = 1.0

  private readonly _prototypes: Map<SpeciesId, FishPrototype>
  private _species: SpeciesId | null = null
  private _clone: THREE.Object3D | null = null
  private _mixer: THREE.AnimationMixer | null = null

  /* movement state */
  private readonly _velocity = new THREE.Vector3()
  private _wanderPhase = 0
  private readonly _steer = new THREE.Vector3()

  constructor(prototypes: Map<SpeciesId, FishPrototype>) {
    this._prototypes = prototypes
    this.mesh = new THREE.Group()
    this._align = new THREE.Group()
    this._align.rotation.y = Math.PI / 2 // 모델 머리(-X) → +X 진행방향
    this.mesh.add(this._align)
    this.mesh.visible = false
  }

  get kind(): FishKind {
    return this._kind
  }

  get speciesId(): SpeciesId | null {
    return this._species
  }

  get position(): THREE.Vector3 {
    return this.mesh.position
  }

  get velocity(): THREE.Vector3 {
    return this._velocity
  }

  reset(seed: number, kind: FishKind): void {
    this._kind = kind
    this._seed = seed
    this._wanderPhase = seed * 100
    this._steer.set(0, 0, 0)

    const speciesId = pickSpecies(seed, kind)
    const proto = this._prototypes.get(speciesId)

    // 종이 바뀌었을 때만 클론/믹서 재구성 (성장 시점에만 발생, 매 프레임 X)
    if (proto && speciesId !== this._species) {
      this._teardownClone()
      const model = cloneSkeleton(proto.scene)
      model.position.copy(proto.center).multiplyScalar(-1) // 원점 정렬
      this._align.add(model)
      this._clone = model
      this._species = speciesId

      if (proto.clip) {
        this._mixer = new THREE.AnimationMixer(model)
        const action = this._mixer.clipAction(proto.clip)
        action.timeScale = 0.8 + pseudoRandom(seed, 6) * 0.6 // 개체별 속도 변주
        action.time = pseudoRandom(seed, 7) * proto.clip.duration // 위상 desync
        action.play()
      }
    }

    // 크기: baseScale * normScale * 시드 변주
    const norm = proto?.normScale ?? 1
    const baseScale = proto?.baseScale ?? 0.5
    const variation = 0.85 + pseudoRandom(seed, 5) * 0.3
    this.mesh.scale.setScalar(baseScale * norm * variation)

    // 위치
    const b = FISH.bounds
    this.mesh.position.set(
      b.minX + (b.maxX - b.minX) * pseudoRandom(seed, 0),
      b.minY + (b.maxY - b.minY) * pseudoRandom(seed, 1),
      b.minZ + (b.maxZ - b.minZ) * pseudoRandom(seed, 2),
    )

    // 속도
    this._baseSpeed = proto?.swimSpeed ?? (kind === 'schooling' ? 1.2 : 0.8)
    const angle = pseudoRandom(seed, 3) * Math.PI * 2
    this._velocity.set(
      Math.cos(angle) * this._baseSpeed,
      (pseudoRandom(seed, 4) - 0.5) * 0.2,
      Math.sin(angle) * this._baseSpeed * 0.3,
    )

    this.mesh.visible = true
  }

  applySteer(v: THREE.Vector3): void {
    this._steer.add(v)
  }

  setVisible(visible: boolean): void {
    this.mesh.visible = visible
  }

  update(dt: number): void {
    if (!this.mesh.visible) return

    this._mixer?.update(dt) // 스켈레탈 헤엄 애니메이션

    this._wanderPhase += dt

    // Wander
    const s = this._seed
    const wp = this._wanderPhase
    const wx = Math.sin(wp * 0.7 + s * 6.28) * 0.5
    const wy = Math.sin(wp * 0.4 + s * 12.57) * 0.15
    const wz = Math.sin(wp * 0.5 + s * 18.85) * 0.25

    // Boundary avoidance
    const p = this.mesh.position
    const b = FISH.bounds
    const m = BOUNDARY_MARGIN
    const tf = BOUNDARY_TURN_FORCE
    let bx = 0
    let by = 0
    let bz = 0
    if (p.x < b.minX + m) bx = tf * (1 - (p.x - b.minX) / m)
    if (p.x > b.maxX - m) bx = -tf * (1 - (b.maxX - p.x) / m)
    if (p.y < b.minY + m) by = tf * (1 - (p.y - b.minY) / m)
    if (p.y > b.maxY - m) by = -tf * (1 - (b.maxY - p.y) / m)
    if (p.z < b.minZ + m) bz = tf * (1 - (p.z - b.minZ) / m)
    if (p.z > b.maxZ - m) bz = -tf * (1 - (b.maxZ - p.z) / m)

    this._velocity.x += (wx + bx + this._steer.x) * dt
    this._velocity.y += (wy + by + this._steer.y) * dt
    this._velocity.z += (wz + bz + this._steer.z) * dt

    // 속도 범위 유지
    const speed = this._velocity.length()
    const maxSpeed = this._baseSpeed * 1.5
    const minSpeed = this._baseSpeed * 0.3
    if (speed > maxSpeed) {
      this._velocity.multiplyScalar(maxSpeed / speed)
    } else if (speed > 0 && speed < minSpeed) {
      this._velocity.multiplyScalar(minSpeed / speed)
    }

    // 이동
    p.addScaledVector(this._velocity, dt)
    p.x = Math.max(b.minX, Math.min(b.maxX, p.x))
    p.y = Math.max(b.minY, Math.min(b.maxY, p.y))
    p.z = Math.max(b.minZ, Math.min(b.maxZ, p.z))

    // 진행 방향으로 회전 (머리 +X가 속도를 향함)
    if (speed > 0.01) {
      this.mesh.rotation.y = headingYaw(this._velocity.x, this._velocity.z)
      this.mesh.rotation.z = Math.atan2(this._velocity.y, speed) * 0.3
    }

    this._steer.set(0, 0, 0)
  }

  dispose(): void {
    this._teardownClone()
  }

  private _teardownClone(): void {
    if (this._mixer) {
      this._mixer.stopAllAction()
      this._mixer = null
    }
    if (this._clone) {
      this._align.remove(this._clone)
      this._clone = null
    }
  }
}
