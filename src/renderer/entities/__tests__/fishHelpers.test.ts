import { describe, it, expect } from 'vitest'
import { nextActiveCount } from '../fishHelpers'

describe('nextActiveCount', () => {
  it('목표가 현재보다 크면 perTick만큼 증가', () => {
    expect(nextActiveCount(5, 10, 3)).toBe(8)
  })

  it('잔여분이 perTick 미만이면 목표에 정확히 도달', () => {
    expect(nextActiveCount(9, 10, 3)).toBe(10)
  })

  it('perTick만큼 증가해도 목표를 넘지 않음', () => {
    expect(nextActiveCount(0, 2, 100)).toBe(2)
  })

  it('목표가 현재보다 작으면 즉시 목표로 감소', () => {
    expect(nextActiveCount(10, 5, 3)).toBe(5)
  })

  it('현재와 목표가 같으면 변화 없음', () => {
    expect(nextActiveCount(5, 5, 3)).toBe(5)
  })

  it('0에서 시작해 perTick만큼 증가', () => {
    expect(nextActiveCount(0, 10, 3)).toBe(3)
  })

  it('목표 0으로 즉시 감소', () => {
    expect(nextActiveCount(10, 0, 3)).toBe(0)
  })

  it('perTick=1이면 1씩 증가', () => {
    expect(nextActiveCount(5, 10, 1)).toBe(6)
  })

  it('점진적 수렴: 여러 틱에 걸쳐 목표에 도달', () => {
    let current = 0
    const target = 7
    const perTick = 3
    const steps: number[] = []
    while (current < target) {
      current = nextActiveCount(current, target, perTick)
      steps.push(current)
    }
    expect(steps).toEqual([3, 6, 7])
  })

  it('감소 후 재증가는 점진적', () => {
    // 10 → 3 즉시, 3 → 8 점진
    expect(nextActiveCount(10, 3, 2)).toBe(3)
    expect(nextActiveCount(3, 8, 2)).toBe(5)
    expect(nextActiveCount(5, 8, 2)).toBe(7)
    expect(nextActiveCount(7, 8, 2)).toBe(8)
  })
})
