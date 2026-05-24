import { describe, it, expect } from 'vitest'
import { glowOpacityForBrightness, glowPulse } from '../glowHelpers'

describe('glowOpacityForBrightness', () => {
  it('brightness=0 (최소 밝기)이면 maxOpacity 반환', () => {
    expect(glowOpacityForBrightness(0, 0.05, 0.15)).toBeCloseTo(0.15, 5)
  })

  it('brightness=1 (최대 밝기)이면 minOpacity 반환', () => {
    expect(glowOpacityForBrightness(1, 0.05, 0.15)).toBeCloseTo(0.05, 5)
  })

  it('brightness=0.5이면 중간값 반환', () => {
    expect(glowOpacityForBrightness(0.5, 0.05, 0.15)).toBeCloseTo(0.1, 5)
  })

  it('brightness가 0 미만이면 maxOpacity로 클램프', () => {
    expect(glowOpacityForBrightness(-0.5, 0.05, 0.15)).toBeCloseTo(0.15, 5)
  })

  it('brightness가 1 초과이면 minOpacity로 클램프', () => {
    expect(glowOpacityForBrightness(1.5, 0.05, 0.15)).toBeCloseTo(0.05, 5)
  })

  it('minOpacity === maxOpacity이면 항상 그 값', () => {
    expect(glowOpacityForBrightness(0.3, 0.1, 0.1)).toBeCloseTo(0.1, 5)
  })
})

describe('glowPulse', () => {
  it('time=0, phase=0이면 0.5 반환 (sin(0)=0 → 0.5+0.5*0)', () => {
    expect(glowPulse(0, 0, 1.0)).toBeCloseTo(0.5, 5)
  })

  it('sin=1일 때 1.0 반환', () => {
    // time*speed+phase = pi/2 → sin=1 → 0.5+0.5*1=1
    expect(glowPulse(Math.PI / 2, 0, 1.0)).toBeCloseTo(1.0, 5)
  })

  it('sin=-1일 때 0.0 반환', () => {
    // time*speed+phase = 3pi/2 → sin=-1 → 0.5+0.5*(-1)=0
    expect(glowPulse(3 * Math.PI / 2, 0, 1.0)).toBeCloseTo(0.0, 5)
  })

  it('phase가 오프셋 역할', () => {
    // time=0, phase=pi/2, speed=1 → sin(pi/2)=1 → 1.0
    expect(glowPulse(0, Math.PI / 2, 1.0)).toBeCloseTo(1.0, 5)
  })

  it('speed가 주파수를 조절', () => {
    // time=1, speed=pi/2, phase=0 → sin(pi/2)=1 → 1.0
    expect(glowPulse(1, 0, Math.PI / 2)).toBeCloseTo(1.0, 5)
  })

  it('주기적으로 반복 (2pi)', () => {
    const a = glowPulse(0.7, 0.3, 1.0)
    const b = glowPulse(0.7 + 2 * Math.PI, 0.3, 1.0)
    expect(a).toBeCloseTo(b, 5)
  })

  it('결과는 항상 0~1 범위', () => {
    for (let t = 0; t < 10; t += 0.3) {
      const v = glowPulse(t, 1.23, 2.5)
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThanOrEqual(1)
    }
  })
})
