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
