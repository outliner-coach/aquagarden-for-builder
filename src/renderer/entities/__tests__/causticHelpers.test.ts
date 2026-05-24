import { describe, it, expect } from 'vitest'
import { causticUvOffset } from '../causticHelpers'

describe('causticUvOffset', () => {
  it('time=0이면 오프셋 (0, 0) 반환', () => {
    const o = causticUvOffset(0, 1.0, 0.5)
    expect(o.x).toBeCloseTo(0, 10)
    expect(o.y).toBeCloseTo(0, 10)
  })

  it('speed=0이면 오프셋 (0, 0) 반환', () => {
    const o = causticUvOffset(5.0, 0, 1.2)
    expect(o.x).toBeCloseTo(0, 10)
    expect(o.y).toBeCloseTo(0, 10)
  })

  it('angle=0이면 x 방향으로만 이동 (y=0)', () => {
    const o = causticUvOffset(2.0, 0.5, 0)
    expect(o.x).toBeCloseTo(1.0, 5) // cos(0)*0.5*2 = 1.0
    expect(o.y).toBeCloseTo(0, 10)  // sin(0)*0.5*2 = 0
  })

  it('angle=π/2이면 y 방향으로만 이동 (x≈0)', () => {
    const o = causticUvOffset(3.0, 0.4, Math.PI / 2)
    expect(o.x).toBeCloseTo(0, 5)   // cos(π/2)≈0
    expect(o.y).toBeCloseTo(1.2, 5) // sin(π/2)*0.4*3 = 1.2
  })

  it('같은 입력이면 같은 결과 (결정적)', () => {
    const a = causticUvOffset(1.5, 0.3, 0.7)
    const b = causticUvOffset(1.5, 0.3, 0.7)
    expect(a.x).toBe(b.x)
    expect(a.y).toBe(b.y)
  })

  it('시간에 비례 (선형): offset(2t) = 2 * offset(t)', () => {
    const t1 = causticUvOffset(1.0, 0.5, 0.8)
    const t2 = causticUvOffset(2.0, 0.5, 0.8)
    expect(t2.x).toBeCloseTo(t1.x * 2, 5)
    expect(t2.y).toBeCloseTo(t1.y * 2, 5)
  })

  it('angle + 2π는 같은 결과 (주기성)', () => {
    const a = causticUvOffset(1.0, 0.5, 0.3)
    const b = causticUvOffset(1.0, 0.5, 0.3 + Math.PI * 2)
    expect(a.x).toBeCloseTo(b.x, 10)
    expect(a.y).toBeCloseTo(b.y, 10)
  })

  it('angle=π이면 x 음수 방향 이동', () => {
    const o = causticUvOffset(1.0, 1.0, Math.PI)
    expect(o.x).toBeCloseTo(-1.0, 5)
    expect(o.y).toBeCloseTo(0, 5)
  })

  it('음수 시간도 정상 동작 (역방향)', () => {
    const pos = causticUvOffset(1.0, 0.5, 0.3)
    const neg = causticUvOffset(-1.0, 0.5, 0.3)
    expect(neg.x).toBeCloseTo(-pos.x, 10)
    expect(neg.y).toBeCloseTo(-pos.y, 10)
  })

  it('임의의 angle에서 오프셋 크기 = speed * |time|', () => {
    const angle = 1.23
    const speed = 0.7
    const time = 2.5
    const o = causticUvOffset(time, speed, angle)
    const magnitude = Math.sqrt(o.x * o.x + o.y * o.y)
    expect(magnitude).toBeCloseTo(speed * Math.abs(time), 5)
  })
})
