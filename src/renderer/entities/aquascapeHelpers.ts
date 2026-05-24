/**
 * 시간을 누적한다.
 * @param prev 이전 누적 시간(초)
 * @param dt 프레임 경과 시간(초)
 * @returns 새 누적 시간
 */
export function advanceTime(prev: number, dt: number): number {
  return prev + dt
}

/**
 * 사인 기반 수초 흔들림 오프셋 계산.
 * @param time 현재 시간(초, 라디안 스케일)
 * @param phase 개별 수초의 위상 오프셋(라디안)
 * @param amplitude 최대 변위
 * @returns 흔들림 오프셋 값
 */
export function swayOffset(time: number, phase: number, amplitude: number): number {
  return Math.sin(time + phase) * amplitude
}
