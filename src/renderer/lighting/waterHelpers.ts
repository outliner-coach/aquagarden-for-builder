/**
 * 깊이(view-space distance)를 물 틴트 혼합비와 알파 계수로 매핑.
 * mix: 0(near)→1(far), alpha: 1(near)→0(far). 선형·단조·클램프.
 */
export function depthToWaterTint(
  depth: number,
  near: number,
  far: number,
): { mix: number; alpha: number } {
  if (far <= near) {
    const mix = depth < near ? 0 : 1
    return { mix, alpha: 1 - mix }
  }
  const t = Math.max(0, Math.min(1, (depth - near) / (far - near)))
  return { mix: t, alpha: 1 - t }
}
