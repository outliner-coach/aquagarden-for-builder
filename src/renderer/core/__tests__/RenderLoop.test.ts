import { describe, it, expect } from 'vitest'
import { computeDelta, shouldTick } from '../RenderLoop'

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

// FPS 캡 — 힐링 위젯이 표시 중 CPU/GPU를 과점유하지 않도록 rAF 틱을 골라 실행한다.
describe('shouldTick', () => {
  it('minInterval이 0 이하이면 항상 틱 (캡 없음)', () => {
    expect(shouldTick(1000, 1001, 0)).toBe(true)
    expect(shouldTick(1000, 1001, -5)).toBe(true)
  })

  it('첫 프레임(lastTickMs=0)은 항상 틱', () => {
    expect(shouldTick(0, 123, 33.3)).toBe(true)
  })

  it('간격 미만이면 스킵', () => {
    expect(shouldTick(1000, 1016.7, 33.3)).toBe(false)
  })

  it('간격 이상이면 틱', () => {
    expect(shouldTick(1000, 1033.4, 33.3)).toBe(true)
    expect(shouldTick(1000, 1100, 33.3)).toBe(true)
  })

  it('rAF 타이밍 지터 허용 (경계 0.5ms 이내는 틱)', () => {
    // 60Hz rAF에서 2프레임=33.33ms가 33.0ms로 도착해도 30fps 틱을 놓치지 않는다
    expect(shouldTick(1000, 1033.0, 33.33)).toBe(true)
  })
})
