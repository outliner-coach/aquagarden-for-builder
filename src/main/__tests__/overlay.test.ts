import { describe, it, expect } from 'vitest'
import { applyDelta } from '../overlay'

interface Bounds {
  x: number
  y: number
  width: number
  height: number
}

describe('applyDelta', () => {
  const base: Bounds = { x: 100, y: 50, width: 1920, height: 220 }

  it('dx/dy를 현재 bounds에 더한다', () => {
    const result = applyDelta(base, 10, 20)
    expect(result).toEqual({ x: 110, y: 70, width: 1920, height: 220 })
  })

  it('음수 dx/dy로 왼쪽·위로 이동한다', () => {
    const result = applyDelta(base, -30, -10)
    expect(result).toEqual({ x: 70, y: 40, width: 1920, height: 220 })
  })

  it('dx=0, dy=0이면 bounds가 변하지 않는다', () => {
    const result = applyDelta(base, 0, 0)
    expect(result).toEqual(base)
  })

  it('width와 height는 변경되지 않는다', () => {
    const result = applyDelta(base, 50, 50)
    expect(result.width).toBe(base.width)
    expect(result.height).toBe(base.height)
  })

  it('원본 bounds를 변이시키지 않는다 (불변)', () => {
    const original = { ...base }
    applyDelta(base, 10, 10)
    expect(base).toEqual(original)
  })

  it('큰 값의 이동도 처리한다', () => {
    const result = applyDelta(base, 5000, -3000)
    expect(result.x).toBe(5100)
    expect(result.y).toBe(-2950)
  })
})
