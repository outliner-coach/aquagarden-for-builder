import { describe, it, expect } from 'vitest'
import { swayOffset, advanceTime } from '../aquascapeHelpers'

describe('advanceTime', () => {
  it('dt를 누적한다', () => {
    expect(advanceTime(1.0, 0.016)).toBeCloseTo(1.016, 5)
  })

  it('초기값 0에서 시작', () => {
    expect(advanceTime(0, 0.5)).toBeCloseTo(0.5, 5)
  })

  it('dt가 0이면 변화 없음', () => {
    expect(advanceTime(3.14, 0)).toBeCloseTo(3.14, 5)
  })

  it('큰 시간값도 정상 누적', () => {
    expect(advanceTime(9999.0, 0.016)).toBeCloseTo(9999.016, 5)
  })
})

describe('swayOffset', () => {
  it('time=0, phase=0이면 0 반환 (sin(0)=0)', () => {
    expect(swayOffset(0, 0, 1.0)).toBeCloseTo(0, 5)
  })

  it('amplitude가 0이면 항상 0', () => {
    expect(swayOffset(1.5, 0.3, 0)).toBeCloseTo(0, 5)
  })

  it('sin(π/2)=1 → amplitude 반환', () => {
    // time * frequency + phase = π/2 → sin = 1
    // 기본 frequency는 swayOffset 내부에서 결정되므로
    // time=π/2, phase=0 → sin(π/2) = 1 → result = amplitude
    expect(swayOffset(Math.PI / 2, 0, 2.0)).toBeCloseTo(2.0, 5)
  })

  it('phase가 오프셋을 준다', () => {
    // sin(time + phase) * amplitude
    // time=0, phase=π/2 → sin(π/2)=1
    expect(swayOffset(0, Math.PI / 2, 1.0)).toBeCloseTo(1.0, 5)
  })

  it('sin(π)=0 → 0에 근접', () => {
    expect(swayOffset(Math.PI, 0, 5.0)).toBeCloseTo(0, 5)
  })

  it('음수 amplitude도 동작', () => {
    expect(swayOffset(Math.PI / 2, 0, -3.0)).toBeCloseTo(-3.0, 5)
  })

  it('주기적으로 반복 (2π)', () => {
    const a = swayOffset(0.5, 0.3, 1.0)
    const b = swayOffset(0.5 + 2 * Math.PI, 0.3, 1.0)
    expect(a).toBeCloseTo(b, 5)
  })
})
