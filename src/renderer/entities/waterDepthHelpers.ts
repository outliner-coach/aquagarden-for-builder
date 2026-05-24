/**
 * 물 깊이 알파 페이드 매핑 (순수 로직 — GLSL `WATER_DEPTH_FRAG_MAIN`의 알파 항과 동일).
 * 뷰 깊이가 멀수록 알파를 낮춰 먼 지오메트리를 수중 헤이즈로 용해시킨다.
 * 모래 평면의 먼 가장자리가 하드 컷(수평선)으로 보이지 않게 하려면, 가장자리 뷰 깊이에서
 * 이 값이 0에 도달해야 한다. 그 불변식을 테스트로 가드한다.
 *
 * t = clamp((viewDepth - near) / (alphaFar - near), 0, 1), smoothstep(t)로 ease,
 * factor = 1 - smoothstep(t) * maxFade.
 * smoothstep은 t=1에서 기울기 0 → 먼 가장자리에서 알파가 급강하 없이 0에 도달(수평선 방지).
 */
export function waterDepthAlphaFactor(
  viewDepth: number,
  near: number,
  alphaFar: number,
  maxFade: number,
): number {
  const t = Math.min(1, Math.max(0, (viewDepth - near) / (alphaFar - near)))
  const eased = t * t * (3 - 2 * t)
  return 1 - eased * maxFade
}
