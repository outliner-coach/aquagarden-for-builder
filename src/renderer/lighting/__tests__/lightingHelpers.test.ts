import { describe, it, expect } from 'vitest'
import { brightnessToIntensity, brightnessToAmbient } from '../lightingHelpers'
import { LIGHT } from '../../../shared/config'

describe('brightnessToIntensity', () => {
  it('b01=0 → minIntensity', () => {
    expect(brightnessToIntensity(0, LIGHT.minIntensity, LIGHT.maxIntensity)).toBeCloseTo(LIGHT.minIntensity, 5)
  })

  it('b01=1 → maxIntensity', () => {
    expect(brightnessToIntensity(1, LIGHT.minIntensity, LIGHT.maxIntensity)).toBeCloseTo(LIGHT.maxIntensity, 5)
  })

  it('b01=0.5 → 중간값', () => {
    const expected = (LIGHT.minIntensity + LIGHT.maxIntensity) / 2
    expect(brightnessToIntensity(0.5, LIGHT.minIntensity, LIGHT.maxIntensity)).toBeCloseTo(expected, 5)
  })

  it('b01 < 0 → minIntensity로 클램프', () => {
    expect(brightnessToIntensity(-0.5, LIGHT.minIntensity, LIGHT.maxIntensity)).toBeCloseTo(LIGHT.minIntensity, 5)
  })

  it('b01 > 1 → maxIntensity로 클램프', () => {
    expect(brightnessToIntensity(1.5, LIGHT.minIntensity, LIGHT.maxIntensity)).toBeCloseTo(LIGHT.maxIntensity, 5)
  })

  it('커스텀 min/max 범위에서도 선형 매핑', () => {
    expect(brightnessToIntensity(0.25, 0, 100)).toBeCloseTo(25, 5)
  })

  it('min === max이면 항상 같은 값', () => {
    expect(brightnessToIntensity(0.5, 5, 5)).toBeCloseTo(5, 5)
  })
})

describe('brightnessToAmbient', () => {
  it('b01=0 → minAmbient', () => {
    expect(brightnessToAmbient(0, LIGHT.minAmbient, LIGHT.maxAmbient)).toBeCloseTo(LIGHT.minAmbient, 5)
  })

  it('b01=1 → maxAmbient', () => {
    expect(brightnessToAmbient(1, LIGHT.minAmbient, LIGHT.maxAmbient)).toBeCloseTo(LIGHT.maxAmbient, 5)
  })

  it('b01=0.5 → 중간값', () => {
    const expected = (LIGHT.minAmbient + LIGHT.maxAmbient) / 2
    expect(brightnessToAmbient(0.5, LIGHT.minAmbient, LIGHT.maxAmbient)).toBeCloseTo(expected, 5)
  })

  it('b01 < 0 → minAmbient로 클램프', () => {
    expect(brightnessToAmbient(-1, LIGHT.minAmbient, LIGHT.maxAmbient)).toBeCloseTo(LIGHT.minAmbient, 5)
  })

  it('b01 > 1 → maxAmbient로 클램프', () => {
    expect(brightnessToAmbient(2, LIGHT.minAmbient, LIGHT.maxAmbient)).toBeCloseTo(LIGHT.maxAmbient, 5)
  })
})
