import * as THREE from 'three'
import { FISH } from '../../shared/config'
import type { FishPrototype, SpeciesId } from './fishAssets'
import { FISH_SPECIES, pickSpecies } from './fishAssets'
import { seedToPhase, swimAmplitudeFor, headingYaw } from './fishHelpers'
import {
  attachCausticUniforms,
  CAUSTIC_VERT_DECLARE,
  CAUSTIC_VERT_MAIN,
  CAUSTIC_FRAG_DECLARE,
  CAUSTIC_FRAG_MAIN,
} from './caustics'
import {
  attachWaterDepthUniforms,
  WATER_DEPTH_VERT_DECLARE,
  WATER_DEPTH_VERT_MAIN,
  WATER_DEPTH_FRAG_DECLARE,
  WATER_DEPTH_FRAG_MAIN,
} from './waterDepth'

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

/* ── Color tint: 시드 기반 미세 색 변주 ── */

const TINT_STRENGTH = 0.08

/* ── Fish ── */

export class Fish {
  readonly mesh: THREE.Group
  private _kind: FishKind = 'schooling'
  private _seed = 0
  private _baseSpeed = 1.0

  private readonly _fishMesh: THREE.Mesh
  private readonly _material: THREE.MeshStandardMaterial
  private readonly _prototypes: Map<SpeciesId, FishPrototype>

  /* shader uniforms */
  private readonly _uTime = { value: 0 }
  private readonly _uSwimAmp = { value: 0.3 }
  private readonly _uSwimSpeed = { value: 1.0 }
  private readonly _uPhase = { value: 0 }
  private readonly _uRimColor = { value: new THREE.Vector3(0.35, 0.55, 0.65) }
  private readonly _uRimPower = { value: 2.5 }

  /* movement state */
  private readonly _velocity = new THREE.Vector3()
  private _wanderPhase = 0
  private readonly _steer = new THREE.Vector3()

  /* prototype cache for current species */
  private _currentProto: FishPrototype | null = null

  constructor(prototypes: Map<SpeciesId, FishPrototype>) {
    this._prototypes = prototypes
    this.mesh = new THREE.Group()

    this._material = new THREE.MeshStandardMaterial({
      roughness: 0.4,
      metalness: 0.1,
      transparent: true,
      vertexColors: true, // GLB 프리미티브 색을 베이크한 버텍스 컬러 사용
    })
    this._setupShader()

    // 초기 메시 — reset에서 geometry가 교체됨
    const firstProto = prototypes.values().next().value as FishPrototype | undefined
    this._fishMesh = new THREE.Mesh(
      firstProto?.geometry ?? new THREE.BufferGeometry(),
      this._material,
    )
    this.mesh.add(this._fishMesh)
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
    this._steer.set(0, 0, 0)

    // 종 선택 & geometry 교체 (geometry는 공유 — clone하지 않음)
    const speciesId = pickSpecies(seed, kind)
    const proto = this._prototypes.get(speciesId)
    if (proto) {
      this._currentProto = proto
      this._fishMesh.geometry = proto.geometry // 공유 참조
    }

    // 셰이더 uniform 초기값
    this._uPhase.value = seedToPhase(seed)
    this._uTime.value = 0
    if (proto) {
      this._uSwimAmp.value = proto.swimAmplitude
      this._uSwimSpeed.value = proto.swimSpeed
    }

    // 버텍스 컬러(종 고유색)를 곱하는 흰색 베이스 + 개체별 미세 밝기 변주만.
    // (과거엔 흰색에서 랜덤 색조로 lerp해 종 색을 흐렸음 → 흰 물고기 사고)
    const lightJitter = 1 + (pseudoRandom(seed, 13) - 0.5) * TINT_STRENGTH
    this._material.color.setRGB(lightJitter, lightJitter, lightJitter)

    // 크기: 종 baseScale + 시드 변주 (±15%)
    const baseScale = proto?.baseScale ?? 0.15
    const scaleVariation = 0.85 + pseudoRandom(seed, 5) * 0.3
    const finalScale = baseScale * scaleVariation
    this.mesh.scale.setScalar(finalScale)

    // 위치: 범위 내 랜덤 배치
    const b = FISH.bounds
    this.mesh.position.set(
      b.minX + (b.maxX - b.minX) * pseudoRandom(seed, 0),
      b.minY + (b.maxY - b.minY) * pseudoRandom(seed, 1),
      b.minZ + (b.maxZ - b.minZ) * pseudoRandom(seed, 2),
    )

    // 속도
    const species = FISH_SPECIES.find((s) => s.id === speciesId)
    this._baseSpeed = species?.swimSpeed ?? (kind === 'schooling' ? 1.2 : 0.8)
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

    // 진행 방향으로 회전 (머리 +X가 속도를 향함 — headingYaw 규약)
    if (speed > 0.01) {
      this.mesh.rotation.y = headingYaw(this._velocity.x, this._velocity.z)
      this.mesh.rotation.z = Math.atan2(this._velocity.y, speed) * 0.3
    }

    // 셰이더 uniform 업데이트: 시간 + 속도 비례 진폭
    this._uTime.value += dt
    if (this._currentProto) {
      this._uSwimAmp.value = swimAmplitudeFor(
        speed,
        this._baseSpeed,
        this._currentProto.swimAmplitude,
      )
    }

    this._steer.set(0, 0, 0)
  }

  dispose(): void {
    // geometry는 공유이므로 dispose하지 않는다
    this._material.dispose()
  }

  private _setupShader(): void {
    const uTime = this._uTime
    const uSwimAmp = this._uSwimAmp
    const uSwimSpeed = this._uSwimSpeed
    const uPhase = this._uPhase
    const uRimColor = this._uRimColor
    const uRimPower = this._uRimPower

    this._material.onBeforeCompile = (shader) => {
      shader.uniforms.uTime = uTime
      shader.uniforms.uSwimAmp = uSwimAmp
      shader.uniforms.uSwimSpeed = uSwimSpeed
      shader.uniforms.uPhase = uPhase
      shader.uniforms.uRimColor = uRimColor
      shader.uniforms.uRimPower = uRimPower
      attachCausticUniforms(shader)
      attachWaterDepthUniforms(shader)

      /* ── Vertex: 바디 벤딩 + 커스틱 world XZ + 물 깊이 ── */
      shader.vertexShader = shader.vertexShader.replace(
        'void main() {',
        `uniform float uTime;
uniform float uSwimAmp;
uniform float uSwimSpeed;
uniform float uPhase;
${CAUSTIC_VERT_DECLARE}
${WATER_DEPTH_VERT_DECLARE}
void main() {`,
      )

      shader.vertexShader = shader.vertexShader.replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
// 바디 벤딩: +X=머리, -X=꼬리. 꼬리로 갈수록 진폭 증가.
float headToTail = clamp(0.5 - transformed.x, 0.0, 1.0);
float bendWeight = headToTail * headToTail;
float wave = sin(uTime * uSwimSpeed * 6.0 + uPhase + transformed.x * 5.0);
transformed.z += wave * uSwimAmp * bendWeight;`,
      )

      shader.vertexShader = shader.vertexShader.replace(
        '#include <project_vertex>',
        `#include <project_vertex>
${WATER_DEPTH_VERT_MAIN}`,
      )

      shader.vertexShader = shader.vertexShader.replace(
        '#include <worldpos_vertex>',
        `#include <worldpos_vertex>
${CAUSTIC_VERT_MAIN}`,
      )

      /* ── Fragment: 림라이트/프레넬 + 커스틱 + 물 깊이 틴트 ── */
      shader.fragmentShader = shader.fragmentShader.replace(
        'void main() {',
        `uniform vec3 uRimColor;
uniform float uRimPower;
${CAUSTIC_FRAG_DECLARE}
${WATER_DEPTH_FRAG_DECLARE}
void main() {`,
      )

      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
// 림라이트: 가장자리 프레넬 발광
vec3 rimViewDir = normalize(vViewPosition);
float rimNdotV = abs(dot(normal, rimViewDir));
float rimFactor = pow(1.0 - rimNdotV, uRimPower);
totalEmissiveRadiance += uRimColor * rimFactor * 0.5;
${CAUSTIC_FRAG_MAIN}`,
      )

      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <opaque_fragment>',
        `#include <opaque_fragment>
${WATER_DEPTH_FRAG_MAIN}`,
      )
    }

    this._material.customProgramCacheKey = () => 'fish-swim-rimlight-caustic-waterdepth'
  }
}
