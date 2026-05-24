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

/**
 * 시드(0~1)에 따른 기포 크기 결정. 결정적(deterministic).
 */
export function bubbleSizeForSeed(seed: number, minSize: number, maxSize: number): number {
  const t = Math.max(0, Math.min(1, seed))
  return minSize + t * (maxSize - minSize)
}

/**
 * 수면 근처에서 기포 알파를 페이드아웃.
 * surfaceY에 가까울수록 0으로, fadeRange 이상 멀면 1.
 */
export function bubbleSurfaceFadeAlpha(y: number, surfaceY: number, fadeRange: number): number {
  const dist = surfaceY - y
  if (dist <= 0) return 0
  if (fadeRange <= 0) return 1
  if (dist >= fadeRange) return 1
  return dist / fadeRange
}
