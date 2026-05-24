import { describe, it, expect } from 'vitest'
import { FISH, LIGHT, WINDOW, BUBBLE, CAMERA, COLORS } from '../config'
import { clampFishCount, clampBrightness01 } from '../clamp'

describe('clampFishCount', () => {
  it('값이 범위 안이면 그대로 반환', () => {
    expect(clampFishCount(10)).toBe(10)
  })

  it('min 미만이면 min으로 clamp', () => {
    expect(clampFishCount(-5)).toBe(FISH.min)
  })

  it('max 초과이면 max로 clamp', () => {
    expect(clampFishCount(999)).toBe(FISH.max)
  })

  it('min 경계값', () => {
    expect(clampFishCount(FISH.min)).toBe(FISH.min)
  })

  it('max 경계값', () => {
    expect(clampFishCount(FISH.max)).toBe(FISH.max)
  })

  it('소수점은 내림', () => {
    expect(clampFishCount(10.7)).toBe(10)
  })
})

describe('clampBrightness01', () => {
  it('값이 0~1 사이면 그대로 반환', () => {
    expect(clampBrightness01(0.5)).toBe(0.5)
  })

  it('0 미만이면 0으로 clamp', () => {
    expect(clampBrightness01(-0.3)).toBe(0)
  })

  it('1 초과이면 1로 clamp', () => {
    expect(clampBrightness01(1.5)).toBe(1)
  })

  it('경계값 0', () => {
    expect(clampBrightness01(0)).toBe(0)
  })

  it('경계값 1', () => {
    expect(clampBrightness01(1)).toBe(1)
  })
})

describe('config 불변식', () => {
  it('FISH.min <= FISH.default <= FISH.max', () => {
    expect(FISH.min).toBeLessThanOrEqual(FISH.default)
    expect(FISH.default).toBeLessThanOrEqual(FISH.max)
  })

  it('LIGHT.minIntensity < LIGHT.maxIntensity', () => {
    expect(LIGHT.minIntensity).toBeLessThan(LIGHT.maxIntensity)
  })

  it('WINDOW.height > 0', () => {
    expect(WINDOW.height).toBeGreaterThan(0)
  })

  it('BUBBLE.maxParticles > 0', () => {
    expect(BUBBLE.maxParticles).toBeGreaterThan(0)
  })

  it('CAMERA.fov > 0, near < far', () => {
    expect(CAMERA.fov).toBeGreaterThan(0)
    expect(CAMERA.near).toBeLessThan(CAMERA.far)
  })

  it('COLORS.point가 정의되어 있다', () => {
    expect(COLORS.point).toBeDefined()
  })
})
