import { describe, it, expect } from 'vitest'
import { attractSteer, fleeSteer, foodFallDelta, isEaten } from '../lureHelpers'

/* ── attractSteer ── */

describe('attractSteer', () => {
  it('target이 오른쪽에 있으면 +x 방향으로 조향한다', () => {
    const result = attractSteer({ x: 0, y: 0, z: 0 }, { x: 5, y: 0, z: 0 }, 1, 10)
    expect(result.x).toBeGreaterThan(0)
    expect(result.y).toBe(0)
    expect(result.z).toBe(0)
  })

  it('target이 왼쪽에 있으면 -x 방향으로 조향한다', () => {
    const result = attractSteer({ x: 0, y: 0, z: 0 }, { x: -3, y: 0, z: 0 }, 1, 10)
    expect(result.x).toBeLessThan(0)
  })

  it('target이 위에 있으면 +y 방향으로 조향한다', () => {
    const result = attractSteer({ x: 0, y: 0, z: 0 }, { x: 0, y: 4, z: 0 }, 1, 10)
    expect(result.y).toBeGreaterThan(0)
  })

  it('radius 밖이면 영벡터(또는 매우 약함)를 반환한다', () => {
    const result = attractSteer({ x: 0, y: 0, z: 0 }, { x: 20, y: 0, z: 0 }, 1, 5)
    expect(result.x).toBe(0)
    expect(result.y).toBe(0)
    expect(result.z).toBe(0)
  })

  it('weight가 크면 결과 크기도 커진다', () => {
    const small = attractSteer({ x: 0, y: 0, z: 0 }, { x: 3, y: 0, z: 0 }, 1, 10)
    const big = attractSteer({ x: 0, y: 0, z: 0 }, { x: 3, y: 0, z: 0 }, 3, 10)
    expect(Math.abs(big.x)).toBeGreaterThan(Math.abs(small.x))
  })

  it('target과 pos가 같으면 영벡터 (안전)', () => {
    const result = attractSteer({ x: 2, y: 3, z: 1 }, { x: 2, y: 3, z: 1 }, 1, 10)
    expect(Number.isFinite(result.x)).toBe(true)
    expect(result.x).toBe(0)
    expect(result.y).toBe(0)
    expect(result.z).toBe(0)
  })

  it('3D 공간에서 z축도 올바르게 동작한다', () => {
    const result = attractSteer({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: -3 }, 1, 10)
    expect(result.z).toBeLessThan(0)
  })
})

/* ── fleeSteer ── */

describe('fleeSteer', () => {
  it('target이 오른쪽에 있으면 -x 방향(반대)으로 도망한다', () => {
    const result = fleeSteer({ x: 0, y: 0, z: 0 }, { x: 2, y: 0, z: 0 }, 1, 5)
    expect(result.x).toBeLessThan(0)
  })

  it('target이 왼쪽에 있으면 +x 방향으로 도망한다', () => {
    const result = fleeSteer({ x: 0, y: 0, z: 0 }, { x: -2, y: 0, z: 0 }, 1, 5)
    expect(result.x).toBeGreaterThan(0)
  })

  it('radius 밖이면 영벡터를 반환한다', () => {
    const result = fleeSteer({ x: 0, y: 0, z: 0 }, { x: 10, y: 0, z: 0 }, 1, 3)
    expect(result.x).toBe(0)
    expect(result.y).toBe(0)
    expect(result.z).toBe(0)
  })

  it('가까울수록 더 강하게 도망한다', () => {
    const close = fleeSteer({ x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 0 }, 1, 5)
    const far = fleeSteer({ x: 0, y: 0, z: 0 }, { x: 4, y: 0, z: 0 }, 1, 5)
    expect(Math.abs(close.x)).toBeGreaterThan(Math.abs(far.x))
  })

  it('weight가 크면 결과 크기도 커진다', () => {
    const small = fleeSteer({ x: 0, y: 0, z: 0 }, { x: 2, y: 0, z: 0 }, 1, 5)
    const big = fleeSteer({ x: 0, y: 0, z: 0 }, { x: 2, y: 0, z: 0 }, 3, 5)
    expect(Math.abs(big.x)).toBeGreaterThan(Math.abs(small.x))
  })

  it('target과 pos가 같으면 영벡터 (안전)', () => {
    const result = fleeSteer({ x: 1, y: 2, z: 3 }, { x: 1, y: 2, z: 3 }, 1, 5)
    expect(Number.isFinite(result.x)).toBe(true)
    expect(result.x).toBe(0)
    expect(result.y).toBe(0)
    expect(result.z).toBe(0)
  })

  it('3D 공간에서 z축도 올바르게 동작한다', () => {
    const result = fleeSteer({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 2 }, 1, 5)
    expect(result.z).toBeLessThan(0)
  })
})

/* ── foodFallDelta ── */

describe('foodFallDelta', () => {
  it('양의 dt와 fallSpeed에 대해 음의 값(아래로)을 반환한다', () => {
    const delta = foodFallDelta(0.016, 2)
    expect(delta).toBeLessThan(0)
  })

  it('dt=0이면 0을 반환한다', () => {
    expect(foodFallDelta(0, 2)).toEqual(0)
  })

  it('fallSpeed가 크면 절대값이 더 크다', () => {
    const slow = foodFallDelta(0.016, 1)
    const fast = foodFallDelta(0.016, 3)
    expect(Math.abs(fast)).toBeGreaterThan(Math.abs(slow))
  })
})

/* ── isEaten ── */

describe('isEaten', () => {
  it('fishPos가 foodPos 근처(eatRadius 이내)면 true', () => {
    expect(isEaten({ x: 0, y: 0, z: 0 }, { x: 0.1, y: 0, z: 0 }, 0.5)).toBe(true)
  })

  it('fishPos가 foodPos에서 eatRadius 밖이면 false', () => {
    expect(isEaten({ x: 0, y: 0, z: 0 }, { x: 3, y: 0, z: 0 }, 0.5)).toBe(false)
  })

  it('정확히 eatRadius 거리이면 true(경계 포함)', () => {
    expect(isEaten({ x: 0, y: 0, z: 0 }, { x: 0.5, y: 0, z: 0 }, 0.5)).toBe(true)
  })

  it('3D 거리로 판정한다', () => {
    // sqrt(0.3^2 + 0.3^2 + 0.3^2) ≈ 0.52 > 0.5
    expect(isEaten({ x: 0, y: 0, z: 0 }, { x: 0.3, y: 0.3, z: 0.3 }, 0.5)).toBe(false)
    // sqrt(0.2^2 + 0.2^2 + 0.2^2) ≈ 0.35 < 0.5
    expect(isEaten({ x: 0, y: 0, z: 0 }, { x: 0.2, y: 0.2, z: 0.2 }, 0.5)).toBe(true)
  })
})
