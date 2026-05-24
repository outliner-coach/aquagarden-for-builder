import { describe, it, expect } from 'vitest'
import { sceneOpacityFactor } from '../sceneOpacity'

describe('sceneOpacityFactor', () => {
  it('slider 0 -> factor 1 (평소 불투명)', () => {
    expect(sceneOpacityFactor(0)).toBe(1)
  })

  it('slider 1 -> factor 0 (완전 투명)', () => {
    expect(sceneOpacityFactor(1)).toBe(0)
  })

  it('단조 감소: 슬라이더가 커질수록 factor 작아짐', () => {
    const steps = [0, 0.1, 0.25, 0.5, 0.75, 0.9, 1.0]
    for (let i = 1; i < steps.length; i++) {
      expect(sceneOpacityFactor(steps[i])).toBeLessThanOrEqual(
        sceneOpacityFactor(steps[i - 1]),
      )
    }
  })

  it('범위 밖 입력은 [0,1]로 클램프', () => {
    expect(sceneOpacityFactor(-0.5)).toBe(1) // 음수 -> 0으로 클램프 -> factor=1
    expect(sceneOpacityFactor(1.5)).toBe(0)  // 1초과 -> 1로 클램프 -> factor=0
  })

  it('중간값은 (0,1) 범위 안', () => {
    const mid = sceneOpacityFactor(0.5)
    expect(mid).toBeGreaterThan(0)
    expect(mid).toBeLessThan(1)
  })
})
