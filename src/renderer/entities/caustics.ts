import * as THREE from 'three'
import { CAUSTIC } from '../../shared/config'
import { causticUvOffset } from './causticHelpers'

/* ================================================================
 *  절차적 Voronoi 커스틱 텍스처 (CanvasTexture, 외부 이미지 없음)
 * ================================================================ */

function mulberry32(seed: number): () => number {
  let s = seed | 0
  return () => {
    s = (s + 0x6d2b79f5) | 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function createCausticTexture(): THREE.CanvasTexture {
  const size = CAUSTIC.textureSize
  const gridN = CAUSTIC.gridCells

  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')!
  const imgData = ctx.createImageData(size, size)
  const data = imgData.data

  const rng = mulberry32(54321)

  // 셀 당 하나의 지터 포인트 (정규화 [0, 1) 좌표)
  const pts: { x: number; y: number }[][] = []
  for (let gy = 0; gy < gridN; gy++) {
    const row: { x: number; y: number }[] = []
    for (let gx = 0; gx < gridN; gx++) {
      row.push({
        x: (gx + 0.15 + rng() * 0.7) / gridN,
        y: (gy + 0.15 + rng() * 0.7) / gridN,
      })
    }
    pts.push(row)
  }

  for (let py = 0; py < size; py++) {
    const ny = py / size
    for (let px = 0; px < size; px++) {
      const nx = px / size
      const cellX = Math.min(Math.floor(nx * gridN), gridN - 1)
      const cellY = Math.min(Math.floor(ny * gridN), gridN - 1)

      let d1 = Infinity
      let d2 = Infinity

      // 3x3 이웃 셀 검사 (래핑으로 심리스 타일링)
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const actualGx = cellX + dx
          const actualGy = cellY + dy
          const wrappedGx = ((actualGx % gridN) + gridN) % gridN
          const wrappedGy = ((actualGy % gridN) + gridN) % gridN
          const pt = pts[wrappedGy][wrappedGx]

          let offsetX = 0
          if (actualGx < 0) offsetX = -1
          else if (actualGx >= gridN) offsetX = 1
          let offsetY = 0
          if (actualGy < 0) offsetY = -1
          else if (actualGy >= gridN) offsetY = 1

          const ddx = nx - (pt.x + offsetX)
          const ddy = ny - (pt.y + offsetY)
          const dist = Math.sqrt(ddx * ddx + ddy * ddy)

          if (dist < d1) {
            d2 = d1
            d1 = dist
          } else if (dist < d2) {
            d2 = dist
          }
        }
      }

      // F2-F1: 셀 경계에서 밝은 선 → 커스틱 패턴
      const edge = d2 - d1
      const maxEdge = (1 / gridN) * 0.5
      const normalized = Math.min(1, edge / maxEdge)
      const caustic = Math.pow(1 - normalized, 3)

      const i = (py * size + px) * 4
      const byte = Math.floor(caustic * 255)
      data[i] = byte
      data[i + 1] = byte
      data[i + 2] = byte
      data[i + 3] = 255
    }
  }

  ctx.putImageData(imgData, 0, 0)
  const tex = new THREE.CanvasTexture(canvas)
  tex.wrapS = THREE.RepeatWrapping
  tex.wrapT = THREE.RepeatWrapping
  return tex
}

/* ================================================================
 *  공유 Uniform — 모든 커스틱 머티리얼이 동일 참조를 사용
 * ================================================================ */

let _texture: THREE.CanvasTexture | null = null

function getCausticTexture(): THREE.CanvasTexture {
  if (!_texture) {
    _texture = createCausticTexture()
  }
  return _texture
}

const _offset1 = { value: new THREE.Vector2(0, 0) }
const _offset2 = { value: new THREE.Vector2(0, 0) }
const _intensity = { value: CAUSTIC.intensity }
const _scale = { value: CAUSTIC.scale }

export interface CausticUniformSet {
  uCausticTex: { value: THREE.Texture }
  uCausticOffset1: { value: THREE.Vector2 }
  uCausticOffset2: { value: THREE.Vector2 }
  uCausticIntensity: { value: number }
  uCausticScale: { value: number }
}

/** 공유 uniform 객체를 반환한다. 모든 머티리얼이 같은 참조를 씀 → 시간 동기화 보장. */
export function getCausticUniforms(): CausticUniformSet {
  return {
    uCausticTex: { value: getCausticTexture() },
    uCausticOffset1: _offset1,
    uCausticOffset2: _offset2,
    uCausticIntensity: _intensity,
    uCausticScale: _scale,
  }
}

/**
 * 커스틱 시간을 갱신한다. 한 곳(Aquascape.update)에서만 호출.
 * 공유 uniform을 업데이트하므로 Fish·Rock 등 모든 머티리얼에 즉시 반영.
 */
export function updateCausticTime(totalTime: number): void {
  const o1 = causticUvOffset(totalTime, CAUSTIC.scroll1.speed, CAUSTIC.scroll1.angle)
  const o2 = causticUvOffset(totalTime, CAUSTIC.scroll2.speed, CAUSTIC.scroll2.angle)
  _offset1.value.set(o1.x, o1.y)
  _offset2.value.set(o2.x, o2.y)
}

/* ================================================================
 *  공유 GLSL 청크 — onBeforeCompile 주입용
 * ================================================================ */

/** 버텍스 셰이더: void main() 앞에 선언 */
export const CAUSTIC_VERT_DECLARE = /* glsl */ `
varying vec2 vCausticWorldXZ;`

/** 버텍스 셰이더: #include <worldpos_vertex> 뒤에 삽입 */
export const CAUSTIC_VERT_MAIN = /* glsl */ `
{
  vec4 causticWP = modelMatrix * vec4(transformed, 1.0);
  vCausticWorldXZ = causticWP.xz;
}`

/** 프래그먼트 셰이더: void main() 앞에 선언 */
export const CAUSTIC_FRAG_DECLARE = /* glsl */ `
uniform sampler2D uCausticTex;
uniform vec2 uCausticOffset1;
uniform vec2 uCausticOffset2;
uniform float uCausticIntensity;
uniform float uCausticScale;
varying vec2 vCausticWorldXZ;`

/** 프래그먼트 셰이더: #include <emissivemap_fragment> 뒤에 삽입. emissive에 가산. */
export const CAUSTIC_FRAG_MAIN = /* glsl */ `
{
  vec2 cUV = vCausticWorldXZ * uCausticScale;
  float c1_caustic = texture2D(uCausticTex, cUV + uCausticOffset1).r;
  float c2_caustic = texture2D(uCausticTex, cUV + uCausticOffset2).r;
  float causticVal = c1_caustic * c2_caustic * uCausticIntensity;
  totalEmissiveRadiance += vec3(causticVal);
}`

/**
 * shader 객체에 커스틱 uniform을 부착한다.
 * onBeforeCompile 콜백 안에서 호출.
 */
export function attachCausticUniforms(
  shader: { uniforms: Record<string, { value: unknown }> },
): void {
  const u = getCausticUniforms()
  shader.uniforms.uCausticTex = u.uCausticTex
  shader.uniforms.uCausticOffset1 = u.uCausticOffset1
  shader.uniforms.uCausticOffset2 = u.uCausticOffset2
  shader.uniforms.uCausticIntensity = u.uCausticIntensity
  shader.uniforms.uCausticScale = u.uCausticScale
}

/**
 * MeshStandardMaterial에 커스틱 셰이더를 주입한다.
 * onBeforeCompile이 없는 머티리얼(모래, 바위, 유목)용.
 */
export function applyCausticToStandardMaterial(
  mat: THREE.MeshStandardMaterial,
  cacheKey: string,
): void {
  mat.onBeforeCompile = (shader) => {
    attachCausticUniforms(shader)

    // Vertex: varying 선언 + world XZ 출력
    shader.vertexShader = shader.vertexShader.replace(
      'void main() {',
      `${CAUSTIC_VERT_DECLARE}\nvoid main() {`,
    )
    shader.vertexShader = shader.vertexShader.replace(
      '#include <worldpos_vertex>',
      `#include <worldpos_vertex>\n${CAUSTIC_VERT_MAIN}`,
    )

    // Fragment: uniform/varying 선언 + emissive 가산
    shader.fragmentShader = shader.fragmentShader.replace(
      'void main() {',
      `${CAUSTIC_FRAG_DECLARE}\nvoid main() {`,
    )
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <emissivemap_fragment>',
      `#include <emissivemap_fragment>\n${CAUSTIC_FRAG_MAIN}`,
    )
  }
  mat.customProgramCacheKey = () => cacheKey
}
