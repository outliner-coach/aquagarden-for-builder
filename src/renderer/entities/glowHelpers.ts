/**
 * 밝기(0~1)를 글로우 불투명도로 매핑.
 * 어두울수록(brightness 낮을수록) 글로우가 상대적으로 더 도드라진다.
 */
export function glowOpacityForBrightness(
  brightness01: number,
  minOpacity: number,
  maxOpacity: number,
): number {
  const b = Math.max(0, Math.min(1, brightness01))
  return minOpacity + (1 - b) * (maxOpacity - minOpacity)
}

/**
 * 글로우 펄스 팩터 (0~1). 부드러운 사인 기반 맥동.
 */
export function glowPulse(time: number, phase: number, speed: number): number {
  return 0.5 + 0.5 * Math.sin(time * speed + phase)
}
