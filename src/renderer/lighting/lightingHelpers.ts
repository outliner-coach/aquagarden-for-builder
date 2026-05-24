/**
 * 밝기(0~1)를 조명 intensity로 선형 매핑.
 * 입력은 0~1로 클램프된다.
 */
export function brightnessToIntensity(b01: number, min: number, max: number): number {
  const clamped = Math.max(0, Math.min(1, b01))
  return min + (max - min) * clamped
}

/**
 * 밝기(0~1)를 ambient 조명 intensity로 선형 매핑.
 * 입력은 0~1로 클램프된다.
 */
export function brightnessToAmbient(b01: number, minAmbient: number, maxAmbient: number): number {
  const clamped = Math.max(0, Math.min(1, b01))
  return minAmbient + (maxAmbient - minAmbient) * clamped
}

/**
 * 밝기(0~1)를 환경맵(IBL) intensity로 선형 매핑.
 * 입력은 0~1로 클램프된다.
 */
export function brightnessToEnvIntensity(b01: number, min: number, max: number): number {
  const clamped = Math.max(0, Math.min(1, b01))
  return min + (max - min) * clamped
}
