import { describe, it, expect } from 'vitest'
import { nextActiveCount, seedToPhase, swimAmplitudeFor } from '../fishHelpers'

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

/* ── seedToPhase ── */

describe('seedToPhase', () => {
  it('같은 시드는 같은 위상을 반환한다 (결정적)', () => {
    expect(seedToPhase(42)).toBe(seedToPhase(42))
  })

  it('다른 시드는 다른 위상을 반환한다', () => {
    const phases = new Set<number>()
    for (let s = 0; s < 20; s++) {
      phases.add(seedToPhase(s))
    }
    expect(phases.size).toBe(20)
  })

  it('반환값이 [0, 2π) 범위 안에 있다', () => {
    for (let s = 0; s < 100; s++) {
      const p = seedToPhase(s * 0.37)
      expect(p).toBeGreaterThanOrEqual(0)
      expect(p).toBeLessThan(Math.PI * 2)
    }
  })

  it('음수 시드도 유효한 범위를 반환한다', () => {
    const p = seedToPhase(-5)
    expect(p).toBeGreaterThanOrEqual(0)
    expect(p).toBeLessThan(Math.PI * 2)
  })
})

/* ── swimAmplitudeFor ── */

describe('swimAmplitudeFor', () => {
  it('현재 속도가 기본 속도와 같으면 기본 진폭을 반환', () => {
    expect(swimAmplitudeFor(1.0, 1.0, 0.4)).toBeCloseTo(0.4, 5)
  })

  it('현재 속도가 빠르면 진폭이 증가', () => {
    const amp = swimAmplitudeFor(2.0, 1.0, 0.4)
    expect(amp).toBeGreaterThan(0.4)
  })

  it('현재 속도가 느리면 진폭이 감소', () => {
    const amp = swimAmplitudeFor(0.5, 1.0, 0.4)
    expect(amp).toBeLessThan(0.4)
  })

  it('속도 0이어도 최소 진폭(0.3배)은 유지', () => {
    const amp = swimAmplitudeFor(0, 1.0, 0.4)
    expect(amp).toBeCloseTo(0.4 * 0.3, 5)
  })

  it('속도가 매우 높아도 최대 2배를 넘지 않는다', () => {
    const amp = swimAmplitudeFor(100, 1.0, 0.4)
    expect(amp).toBeCloseTo(0.4 * 2.0, 5)
  })

  it('baseSpeed가 0이면 baseAmp를 그대로 반환', () => {
    expect(swimAmplitudeFor(5, 0, 0.4)).toBeCloseTo(0.4, 5)
  })
})
