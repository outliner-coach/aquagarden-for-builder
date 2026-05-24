import { describe, it, expect } from 'vitest'
import { respawnIfAboveSurface, bubbleWobbleX, bubbleSizeForSeed, bubbleSurfaceFadeAlpha } from '../bubblesHelpers'
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

describe('bubbleSizeForSeed', () => {
  it('seed=0이면 minSize 반환', () => {
    expect(bubbleSizeForSeed(0, 0.04, 0.12)).toBeCloseTo(0.04, 5)
  })

  it('seed=1이면 maxSize 반환', () => {
    expect(bubbleSizeForSeed(1, 0.04, 0.12)).toBeCloseTo(0.12, 5)
  })

  it('seed=0.5이면 중간값 반환', () => {
    expect(bubbleSizeForSeed(0.5, 0.04, 0.12)).toBeCloseTo(0.08, 5)
  })

  it('결과는 항상 minSize~maxSize 범위', () => {
    for (let s = 0; s <= 1; s += 0.1) {
      const v = bubbleSizeForSeed(s, 0.04, 0.12)
      expect(v).toBeGreaterThanOrEqual(0.04 - 1e-10)
      expect(v).toBeLessThanOrEqual(0.12 + 1e-10)
    }
  })

  it('동일 seed는 동일 결과 (결정적)', () => {
    const a = bubbleSizeForSeed(0.73, 0.04, 0.12)
    const b = bubbleSizeForSeed(0.73, 0.04, 0.12)
    expect(a).toBe(b)
  })
})

describe('bubbleSurfaceFadeAlpha', () => {
  it('수면에서 멀면 1.0 반환', () => {
    expect(bubbleSurfaceFadeAlpha(0, 2.0, 0.5)).toBeCloseTo(1.0, 5)
  })

  it('수면에 도달하면 0.0 반환', () => {
    expect(bubbleSurfaceFadeAlpha(2.0, 2.0, 0.5)).toBeCloseTo(0.0, 5)
  })

  it('수면 위이면 0.0 반환', () => {
    expect(bubbleSurfaceFadeAlpha(2.5, 2.0, 0.5)).toBeCloseTo(0.0, 5)
  })

  it('페이드 범위 경계에서 1.0 반환', () => {
    // surfaceY=2.0, fadeRange=0.5 → y=1.5에서 dist=0.5=fadeRange → 1.0
    expect(bubbleSurfaceFadeAlpha(1.5, 2.0, 0.5)).toBeCloseTo(1.0, 5)
  })

  it('페이드 범위 중간에서 0.5 반환', () => {
    // surfaceY=2.0, fadeRange=0.5 → y=1.75에서 dist=0.25 → 0.25/0.5=0.5
    expect(bubbleSurfaceFadeAlpha(1.75, 2.0, 0.5)).toBeCloseTo(0.5, 5)
  })

  it('fadeRange=0이면 수면 아래에서 1.0, 수면에서 0.0', () => {
    expect(bubbleSurfaceFadeAlpha(1.5, 2.0, 0)).toBeCloseTo(1.0, 5)
    expect(bubbleSurfaceFadeAlpha(2.0, 2.0, 0)).toBeCloseTo(0.0, 5)
  })

  it('결과는 항상 0~1 범위', () => {
    for (let y = -2; y <= 3; y += 0.5) {
      const v = bubbleSurfaceFadeAlpha(y, 2.0, 0.5)
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThanOrEqual(1)
    }
  })
})
