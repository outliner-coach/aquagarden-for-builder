import * as THREE from 'three'
import { FISH } from '../../shared/config'

/* ── Types ── */

export type FishKind = 'schooling' | 'individual'

interface FishVariant {
  bodyColor: number
  tailColor: number
  scaleX: number
  scaleY: number
}

/* ── Variants (레퍼런스 기반 종/색 다양성) ── */

const SCHOOLING_VARIANTS: readonly FishVariant[] = [
  { bodyColor: 0x1c70d8, tailColor: 0xe03838, scaleX: 1.0, scaleY: 1.0 },
  { bodyColor: 0x2898b8, tailColor: 0xf04848, scaleX: 0.9, scaleY: 0.95 },
  { bodyColor: 0x3480c0, tailColor: 0xcc3030, scaleX: 1.05, scaleY: 1.0 },
  { bodyColor: 0x1898c0, tailColor: 0xd84040, scaleX: 0.95, scaleY: 0.9 },
]

const INDIVIDUAL_VARIANTS: readonly FishVariant[] = [
  { bodyColor: 0xf0c040, tailColor: 0xe8a020, scaleX: 1.3, scaleY: 1.2 },
  { bodyColor: 0xe87828, tailColor: 0xd06018, scaleX: 1.2, scaleY: 1.1 },
  { bodyColor: 0xc0c8d0, tailColor: 0xa0a8b0, scaleX: 0.7, scaleY: 2.0 },
  { bodyColor: 0xd8d0b8, tailColor: 0xc0b898, scaleX: 1.1, scaleY: 1.0 },
  { bodyColor: 0xcc3838, tailColor: 0xb02828, scaleX: 1.0, scaleY: 1.1 },
]

/* ── Geometry ── */

function createTailGeometry(): THREE.BufferGeometry {
  const positions = new Float32Array([
    0, 0, 0,
    -0.6, 0.35, 0,
    -0.6, -0.35, 0,
  ])
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  geo.setIndex([0, 1, 2])
  geo.computeVertexNormals()
  return geo
}

/* ── Seeded pseudo-random (결정적 초기값 생성) ── */

function pseudoRandom(seed: number, index: number): number {
  const x = Math.sin(seed * 127.1 + index * 311.7) * 43758.5453
  return x - Math.floor(x)
}

/* ── Constants ── */

const BASE_SCALE_SCHOOLING = 0.12
const BASE_SCALE_INDIVIDUAL = 0.25
const SPEED_SCHOOLING = 1.2
const SPEED_INDIVIDUAL = 0.8
const BOUNDARY_MARGIN = 0.8
const BOUNDARY_TURN_FORCE = 2.5
const TAIL_SWAY_SPEED = 8
const TAIL_SWAY_AMPLITUDE = 0.35

/* ── Fish ── */

export class Fish {
  readonly mesh: THREE.Group
  private _kind: FishKind = 'schooling'
  private _seed = 0
  private _speed = SPEED_SCHOOLING

  private readonly _body: THREE.Mesh
  private readonly _tail: THREE.Mesh
  private readonly _bodyMat: THREE.MeshBasicMaterial
  private readonly _tailMat: THREE.MeshBasicMaterial

  private readonly _velocity = new THREE.Vector3()
  private _wanderPhase = 0
  private _tailTime = 0
  private readonly _steer = new THREE.Vector3()

  constructor() {
    this.mesh = new THREE.Group()

    const bodyGeo = new THREE.IcosahedronGeometry(1, 0)
    this._bodyMat = new THREE.MeshBasicMaterial()
    this._body = new THREE.Mesh(bodyGeo, this._bodyMat)
    this._body.scale.set(1.4, 0.5, 0.35)
    this.mesh.add(this._body)

    const tailGeo = createTailGeometry()
    this._tailMat = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide })
    this._tail = new THREE.Mesh(tailGeo, this._tailMat)
    this._tail.position.x = -1.3
    this.mesh.add(this._tail)

    this.mesh.visible = false
  }

  get kind(): FishKind {
    return this._kind
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
    this._tailTime = seed * 50
    this._steer.set(0, 0, 0)

    const variants = kind === 'schooling' ? SCHOOLING_VARIANTS : INDIVIDUAL_VARIANTS
    const variant = variants[Math.floor(Math.abs(seed) * 1000) % variants.length]

    this._bodyMat.color.setHex(variant.bodyColor)
    this._tailMat.color.setHex(variant.tailColor)

    const baseScale = kind === 'schooling' ? BASE_SCALE_SCHOOLING : BASE_SCALE_INDIVIDUAL
    this.mesh.scale.set(
      baseScale * variant.scaleX,
      baseScale * variant.scaleY,
      baseScale,
    )

    const b = FISH.bounds
    this.mesh.position.set(
      b.minX + (b.maxX - b.minX) * pseudoRandom(seed, 0),
      b.minY + (b.maxY - b.minY) * pseudoRandom(seed, 1),
      b.minZ + (b.maxZ - b.minZ) * pseudoRandom(seed, 2),
    )

    const angle = pseudoRandom(seed, 3) * Math.PI * 2
    this._speed = kind === 'schooling' ? SPEED_SCHOOLING : SPEED_INDIVIDUAL
    this._velocity.set(
      Math.cos(angle) * this._speed,
      (pseudoRandom(seed, 4) - 0.5) * 0.2,
      Math.sin(angle) * this._speed * 0.3,
    )

    this.mesh.visible = true
  }

  /** Step 7 boids hook: 외부 조향 벡터 적용 */
  applySteer(v: THREE.Vector3): void {
    this._steer.add(v)
  }

  setVisible(visible: boolean): void {
    this.mesh.visible = visible
  }

  update(dt: number): void {
    if (!this.mesh.visible) return

    this._wanderPhase += dt

    // Wander: 부드러운 방향 전환
    const s = this._seed
    const wp = this._wanderPhase
    const wx = Math.sin(wp * 0.7 + s * 6.28) * 0.5
    const wy = Math.sin(wp * 0.4 + s * 12.57) * 0.15
    const wz = Math.sin(wp * 0.5 + s * 18.85) * 0.25

    // Boundary avoidance: 경계 부근 부드러운 선회
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
    const maxSpeed = this._speed * 1.5
    const minSpeed = this._speed * 0.3
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

    // 진행 방향으로 회전
    if (speed > 0.01) {
      this.mesh.rotation.y = -Math.atan2(this._velocity.z, this._velocity.x)
      this.mesh.rotation.z = Math.atan2(this._velocity.y, speed) * 0.3
    }

    // 꼬리 흔들림
    this._tailTime += dt * (speed + 0.5) * TAIL_SWAY_SPEED
    this._tail.rotation.y = Math.sin(this._tailTime) * TAIL_SWAY_AMPLITUDE

    this._steer.set(0, 0, 0)
  }

  dispose(): void {
    this._body.geometry.dispose()
    this._bodyMat.dispose()
    this._tail.geometry.dispose()
    this._tailMat.dispose()
  }
}
