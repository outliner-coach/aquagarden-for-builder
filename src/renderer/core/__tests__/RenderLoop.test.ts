import { describe, it, expect } from 'vitest'
import { computeDelta } from '../RenderLoop'

describe('computeDelta', () => {
  it('정상 dt 계산 (ms → 초)', () => {
    expect(computeDelta(1000, 1016, 0.1)).toBeCloseTo(0.016, 5)
  })

  it('prevMs가 0이면 0 반환 (첫 프레임)', () => {
    expect(computeDelta(0, 1000, 0.1)).toBe(0)
  })

  it('maxDt 초과 시 클램프', () => {
    // 500ms = 0.5s, maxDt=0.1이면 0.1로 클램프
    expect(computeDelta(1000, 1500, 0.1)).toBe(0.1)
  })

  it('음수 dt는 0 반환', () => {
    expect(computeDelta(2000, 1000, 0.1)).toBe(0)
  })

  it('동일 시각이면 0 반환', () => {
    expect(computeDelta(1000, 1000, 0.1)).toBe(0)
  })

  it('maxDt 경계값과 정확히 같으면 그대로 반환', () => {
    // 100ms = 0.1s, maxDt=0.1
    expect(computeDelta(1000, 1100, 0.1)).toBe(0.1)
  })
})
