/**
 * 기포가 수면(surfaceY) 이상이면 바닥(floorY)으로 리스폰.
 * 아니면 현재 y를 그대로 반환.
 */
export function respawnIfAboveSurface(y: number, surfaceY: number, floorY: number): number {
  return y >= surfaceY ? floorY : y
}

/**
 * 기포의 좌우 흔들림 오프셋 (사인 기반).
 */
export function bubbleWobbleX(
  time: number,
  phase: number,
  amplitude: number,
  speed: number,
): number {
  return Math.sin(time * speed + phase) * amplitude
}
