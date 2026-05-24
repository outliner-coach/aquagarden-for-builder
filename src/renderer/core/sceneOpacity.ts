/**
 * 슬라이더 값(0~1)을 비-물고기 요소 불투명도 배수로 매핑한다.
 * slider=0 → factor=1(평소), slider=1 → factor=0(완전 투명). 단조 감소, 범위 클램프.
 */
export function sceneOpacityFactor(slider01: number): number {
  const clamped = Math.max(0, Math.min(1, slider01))
  return 1 - clamped
}
