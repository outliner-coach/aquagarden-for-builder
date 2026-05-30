/**
 * 물 깊이 알파 페이드 매핑 (순수 로직 — GLSL `WATER_DEPTH_FRAG_MAIN`의 알파 항과 동일).
 * 뷰 깊이가 멀수록 알파를 낮춰 먼 지오메트리를 수중 헤이즈로 용해시킨다.
 * 모래 평면의 먼 가장자리가 하드 컷(수평선)으로 보이지 않게 하려면, 가장자리 뷰 깊이에서
 * 이 값이 0에 도달해야 한다. 그 불변식을 테스트로 가드한다.
 *
 * t = clamp((viewDepth - near) / (alphaFar - near), 0, 1),
 * eased = 1 - (1 - t)^power  (ease-out: 페이드를 가까운 깊이쪽으로 전진),
 * factor = 1 - eased * maxFade.
 *
 * 왜 ease-out인가: 원근 투영에서 먼 모래(깊이 10~16)는 화면상 ~17px에 압축된다. 과거의
 * smoothstep(끝에서 기울기 0이지만 t≈0.4~1 구간에서 급강하)은 그 좁은 띠에 알파를 한꺼번에
 * 떨어뜨려 어두운 '가로선'을 남겼다. ease-out(power>1)은 같은 페이드를 깊이 6~11(화면 35px+)로
 * 펼쳐, 선이 아닌 부드러운 수중 헤이즈 그라디언트로 용해시킨다. t=1(먼 가장자리)에서 eased=1이라
 * 알파 0 도달 불변식은 유지된다.
 */
export function waterDepthAlphaFactor(
  viewDepth: number,
  near: number,
  alphaFar: number,
  maxFade: number,
  power = 2.2,
): number {
  const t = Math.min(1, Math.max(0, (viewDepth - near) / (alphaFar - near)))
  const eased = 1 - Math.pow(1 - t, power)
  return 1 - eased * maxFade
}
