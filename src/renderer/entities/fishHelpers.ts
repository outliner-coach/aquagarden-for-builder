/**
 * 매 틱 목표 개체수를 향해 perTick 이하로 수렴하는 다음 활성 수를 계산한다.
 * 증가는 점진적(perTick씩), 감소는 즉시.
 */
export function nextActiveCount(
  current: number,
  target: number,
  perTick: number,
): number {
  if (current < target) {
    return Math.min(current + perTick, target)
  }
  return target
}

/**
 * 시드로부터 결정적 헤엄 애니메이션 위상 오프셋을 생성한다.
 * 반환값은 [0, 2π) 범위.
 */
export function seedToPhase(seed: number): number {
  const hash = Math.sin(seed * 127.1 + 311.7) * 43758.5453
  const frac = hash - Math.floor(hash)
  return Math.abs(frac) * Math.PI * 2
}

/**
 * 현재 이동 속도에 비례해 셰이더 바디 벤딩 진폭을 계산한다.
 * 비율은 [0.3, 2.0] 범위로 클램프.
 */
export function swimAmplitudeFor(
  currentSpeed: number,
  baseSpeed: number,
  baseAmp: number,
): number {
  if (baseSpeed <= 0) return baseAmp
  const ratio = Math.max(0.3, Math.min(currentSpeed / baseSpeed, 2.0))
  return baseAmp * ratio
}
