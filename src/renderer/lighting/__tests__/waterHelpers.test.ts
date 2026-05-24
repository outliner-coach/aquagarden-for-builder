import { describe, it, expect } from 'vitest'
import { depthToWaterTint } from '../waterHelpers'

describe('depthToWaterTint', () => {
  const NEAR = 2
  const FAR = 10

  it('depth === near → mix=0, alpha=1', () => {
    const r = depthToWaterTint(NEAR, NEAR, FAR)
    expect(r.mix).toBeCloseTo(0, 5)
    expect(r.alpha).toBeCloseTo(1, 5)
  })

  it('depth === far → mix=1, alpha=0', () => {
    const r = depthToWaterTint(FAR, NEAR, FAR)
    expect(r.mix).toBeCloseTo(1, 5)
    expect(r.alpha).toBeCloseTo(0, 5)
  })

  it('depth 중간값 → 선형 보간', () => {
    const mid = (NEAR + FAR) / 2
    const r = depthToWaterTint(mid, NEAR, FAR)
    expect(r.mix).toBeCloseTo(0.5, 5)
    expect(r.alpha).toBeCloseTo(0.5, 5)
  })

  it('depth < near → mix=0 클램프', () => {
    const r = depthToWaterTint(0, NEAR, FAR)
    expect(r.mix).toBeCloseTo(0, 5)
    expect(r.alpha).toBeCloseTo(1, 5)
  })

  it('depth > far → mix=1 클램프', () => {
    const r = depthToWaterTint(100, NEAR, FAR)
    expect(r.mix).toBeCloseTo(1, 5)
    expect(r.alpha).toBeCloseTo(0, 5)
  })

  it('단조 증가: depth가 커지면 mix 증가', () => {
    const r1 = depthToWaterTint(3, NEAR, FAR)
    const r2 = depthToWaterTint(5, NEAR, FAR)
    const r3 = depthToWaterTint(8, NEAR, FAR)
    expect(r2.mix).toBeGreaterThan(r1.mix)
    expect(r3.mix).toBeGreaterThan(r2.mix)
  })

  it('단조 감소: depth가 커지면 alpha 감소', () => {
    const r1 = depthToWaterTint(3, NEAR, FAR)
    const r2 = depthToWaterTint(5, NEAR, FAR)
    const r3 = depthToWaterTint(8, NEAR, FAR)
    expect(r2.alpha).toBeLessThan(r1.alpha)
    expect(r3.alpha).toBeLessThan(r2.alpha)
  })

  it('mix + alpha === 1 (보완 관계)', () => {
    for (const d of [0, 2, 4, 6, 8, 10, 15]) {
      const r = depthToWaterTint(d, NEAR, FAR)
      expect(r.mix + r.alpha).toBeCloseTo(1, 10)
    }
  })

  it('결정적: 같은 입력이면 같은 결과', () => {
    const a = depthToWaterTint(5, NEAR, FAR)
    const b = depthToWaterTint(5, NEAR, FAR)
    expect(a.mix).toBe(b.mix)
    expect(a.alpha).toBe(b.alpha)
  })

  it('near === far, depth >= near → mix=1', () => {
    const r = depthToWaterTint(5, 5, 5)
    expect(r.mix).toBeCloseTo(1, 5)
    expect(r.alpha).toBeCloseTo(0, 5)
  })

  it('near === far, depth < near → mix=0', () => {
    const r = depthToWaterTint(3, 5, 5)
    expect(r.mix).toBeCloseTo(0, 5)
    expect(r.alpha).toBeCloseTo(1, 5)
  })
})
