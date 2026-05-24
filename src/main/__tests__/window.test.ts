import { describe, it, expect } from 'vitest'
import { computeBarBounds, fovForHeight } from '../window'
import { WINDOW, CAMERA } from '../../shared/config'

describe('fovForHeight', () => {
  const baseFov = CAMERA.fov
  const baseHeight = WINDOW.height

  it('heightPx = baseHeightPx이면 baseFov 반환', () => {
    expect(fovForHeight(baseFov, baseHeight, baseHeight)).toBeCloseTo(baseFov, 5)
  })

  it('heightPx < baseHeightPx이면 더 좁은 fov(단조 감소)', () => {
    const fov = fovForHeight(baseFov, baseHeight, baseHeight / 2)
    expect(fov).toBeLessThan(baseFov)
    expect(fov).toBeGreaterThan(0)
  })

  it('heightPx > baseHeightPx이면 더 넓은 fov', () => {
    const fov = fovForHeight(baseFov, baseHeight, baseHeight * 1.5)
    expect(fov).toBeGreaterThan(baseFov)
  })

  it('heightPx가 0에 가까워도 크래시하지 않고 양수 반환', () => {
    const fov = fovForHeight(baseFov, baseHeight, 1)
    expect(fov).toBeGreaterThan(0)
    expect(fov).toBeLessThan(baseFov)
  })
})

describe('computeBarBounds', () => {
  const defaultCfg = { height: WINDOW.height, topMargin: WINDOW.topMargin }

  it('width는 workArea.width와 같다', () => {
    const bounds = computeBarBounds({ width: 1920, height: 1080 }, defaultCfg)
    expect(bounds.width).toBe(1920)
  })

  it('height는 config에서 가져온다', () => {
    const bounds = computeBarBounds({ width: 1920, height: 1080 }, defaultCfg)
    expect(bounds.height).toBe(WINDOW.height)
  })

  it('x는 항상 0이다', () => {
    const bounds = computeBarBounds({ width: 2560, height: 1440 }, defaultCfg)
    expect(bounds.x).toBe(0)
  })

  it('y는 config.topMargin이다', () => {
    const bounds = computeBarBounds({ width: 1920, height: 1080 }, defaultCfg)
    expect(bounds.y).toBe(WINDOW.topMargin)
  })

  it('topMargin이 다르면 y에 반영된다', () => {
    const bounds = computeBarBounds({ width: 1920, height: 1080 }, { height: 200, topMargin: 30 })
    expect(bounds.y).toBe(30)
  })

  it('다양한 디스플레이 크기에서 동작한다', () => {
    const bounds = computeBarBounds({ width: 3840, height: 2160 }, defaultCfg)
    expect(bounds.width).toBe(3840)
    expect(bounds.height).toBe(WINDOW.height)
    expect(bounds.x).toBe(0)
    expect(bounds.y).toBe(WINDOW.topMargin)
  })

  it('반환 타입이 올바르다 (x, y, width, height)', () => {
    const bounds = computeBarBounds({ width: 1280, height: 720 }, defaultCfg)
    expect(bounds).toEqual({
      x: 0,
      y: WINDOW.topMargin,
      width: 1280,
      height: WINDOW.height,
    })
  })
})
