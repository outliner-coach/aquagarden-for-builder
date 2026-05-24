import { describe, it, expect } from 'vitest'
import { respawnIfAboveSurface, bubbleWobbleX } from '../bubblesHelpers'
import { BUBBLE } from '../../../shared/config'

describe('respawnIfAboveSurface', () => {
  it('수면 아래에 있으면 현재 y를 반환', () => {
    expect(respawnIfAboveSurface(0.5, BUBBLE.surfaceY, BUBBLE.floorY)).toBe(0.5)
  })

  it('수면에 도달하면 바닥으로 리스폰', () => {
    expect(respawnIfAboveSurface(BUBBLE.surfaceY, BUBBLE.surfaceY, BUBBLE.floorY)).toBe(BUBBLE.floorY)
  })

  it('수면 위로 넘으면 바닥으로 리스폰', () => {
    expect(respawnIfAboveSurface(BUBBLE.surfaceY + 1, BUBBLE.surfaceY, BUBBLE.floorY)).toBe(BUBBLE.floorY)
  })

  it('바닥 위치에 있으면 그대로 유지', () => {
    expect(respawnIfAboveSurface(BUBBLE.floorY, BUBBLE.surfaceY, BUBBLE.floorY)).toBe(BUBBLE.floorY)
  })

  it('수면 바로 아래에서는 리스폰하지 않음', () => {
    const justBelow = BUBBLE.surfaceY - 0.001
    expect(respawnIfAboveSurface(justBelow, BUBBLE.surfaceY, BUBBLE.floorY)).toBe(justBelow)
  })

  it('커스텀 surfaceY/floorY 동작', () => {
    expect(respawnIfAboveSurface(10, 5, -5)).toBe(-5)
    expect(respawnIfAboveSurface(3, 5, -5)).toBe(3)
  })
})

describe('bubbleWobbleX', () => {
  it('time=0, phase=0이면 0 반환', () => {
    expect(bubbleWobbleX(0, 0, 1.0, 1.0)).toBeCloseTo(0, 5)
  })

  it('amplitude가 0이면 항상 0', () => {
    expect(bubbleWobbleX(5, 3, 0, 2.0)).toBeCloseTo(0, 5)
  })

  it('sin(pi/2)=1 → amplitude 반환', () => {
    // time * speed + phase = pi/2 → time = pi/2, speed=1, phase=0
    expect(bubbleWobbleX(Math.PI / 2, 0, 1.0, 1.0)).toBeCloseTo(1.0, 5)
  })

  it('phase가 오프셋을 제공', () => {
    // time=0, phase=pi/2, speed=1 → sin(pi/2)=1
    expect(bubbleWobbleX(0, Math.PI / 2, 2.0, 1.0)).toBeCloseTo(2.0, 5)
  })

  it('speed가 주파수를 조절', () => {
    // time=1, speed=pi/2, phase=0 → sin(pi/2)=1
    expect(bubbleWobbleX(1, 0, 1.0, Math.PI / 2)).toBeCloseTo(1.0, 5)
  })

  it('주기적으로 반복 (2pi)', () => {
    const a = bubbleWobbleX(0.5, 0.3, 1.0, 1.0)
    const b = bubbleWobbleX(0.5 + 2 * Math.PI, 0.3, 1.0, 1.0)
    expect(a).toBeCloseTo(b, 5)
  })
})
