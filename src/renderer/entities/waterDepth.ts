import * as THREE from 'three'
import { WATER } from '../../shared/config'

/* ================================================================
 *  물 깊이 틴트+알파 페이드 — 공유 Uniform + GLSL 청크
 *  THREE.Fog 미사용 (투명 창에서 불투명 안개 사각형 + ShaderMaterial 무시)
 *  대신 onBeforeCompile로 깊이 기반 색 틴트 + 알파 페이드
 * ================================================================ */

/* ── 공유 Uniform (싱글턴) — 모든 머티리얼이 동일 참조 사용 ── */

const _tintColor = { value: new THREE.Vector3(...WATER.tintColor) }
const _depthNear = { value: WATER.depthNear }
const _depthFar = { value: WATER.depthFar }
const _maxTint = { value: WATER.maxTintStrength }
const _maxFade = { value: WATER.maxAlphaFade }

export function attachWaterDepthUniforms(
  shader: { uniforms: Record<string, { value: unknown }> },
): void {
  shader.uniforms.uWaterTintColor = _tintColor
  shader.uniforms.uWaterDepthNear = _depthNear
  shader.uniforms.uWaterDepthFar = _depthFar
  shader.uniforms.uWaterMaxTint = _maxTint
  shader.uniforms.uWaterMaxFade = _maxFade
}

/* ── 공유 GLSL 청크 — onBeforeCompile 주입용 ── */

/** 버텍스: void main() 앞에 선언 */
export const WATER_DEPTH_VERT_DECLARE = /* glsl */ `
varying float vWaterDepth;`

/** 버텍스: #include <project_vertex> 뒤에 삽입 (mvPosition 사용) */
export const WATER_DEPTH_VERT_MAIN = /* glsl */ `
vWaterDepth = -mvPosition.z;`

/** 프래그먼트: void main() 앞에 선언 */
export const WATER_DEPTH_FRAG_DECLARE = /* glsl */ `
uniform vec3 uWaterTintColor;
uniform float uWaterDepthNear;
uniform float uWaterDepthFar;
uniform float uWaterMaxTint;
uniform float uWaterMaxFade;
varying float vWaterDepth;`

/** 프래그먼트: #include <output_fragment> 뒤에 삽입. gl_FragColor를 수정. */
export const WATER_DEPTH_FRAG_MAIN = /* glsl */ `
{
  float waterT = clamp((vWaterDepth - uWaterDepthNear) / (uWaterDepthFar - uWaterDepthNear), 0.0, 1.0);
  gl_FragColor.rgb = mix(gl_FragColor.rgb, uWaterTintColor, waterT * uWaterMaxTint);
  gl_FragColor.a *= 1.0 - waterT * uWaterMaxFade;
}`

/**
 * MeshStandardMaterial에 물 깊이 틴트+알파 페이드를 주입한다.
 * 기존 onBeforeCompile(caustic 등)을 래핑하므로 다른 셰이더 수정과 공존 가능.
 */
export function applyWaterDepthToMaterial(mat: THREE.MeshStandardMaterial): void {
  mat.transparent = true

  const prevObc = mat.onBeforeCompile
  const prevKey = mat.customProgramCacheKey

  mat.onBeforeCompile = (shader, renderer) => {
    prevObc.call(mat, shader, renderer)
    attachWaterDepthUniforms(shader)

    shader.vertexShader = shader.vertexShader.replace(
      'void main() {',
      `${WATER_DEPTH_VERT_DECLARE}\nvoid main() {`,
    )
    shader.vertexShader = shader.vertexShader.replace(
      '#include <project_vertex>',
      `#include <project_vertex>\n${WATER_DEPTH_VERT_MAIN}`,
    )

    shader.fragmentShader = shader.fragmentShader.replace(
      'void main() {',
      `${WATER_DEPTH_FRAG_DECLARE}\nvoid main() {`,
    )
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <output_fragment>',
      `#include <output_fragment>\n${WATER_DEPTH_FRAG_MAIN}`,
    )
  }

  mat.customProgramCacheKey = () => {
    const base = prevKey ? prevKey() : ''
    return base + '-waterdepth'
  }
}
