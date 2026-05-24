import { describe, it, expect } from 'vitest'
import { computeBarBounds, barSizeForScale, centeredBarBounds, fovForHeight } from '../window'
import { WINDOW, CAMERA } from '../../shared/config'

describe('barSizeForScale', () => {
  const workArea = { width: 1920 }
  const limits = {
    minWidth: WINDOW.minWidth,
    minHeight: WINDOW.minHeight,
    maxHeight: WINDOW.maxHeight,
  }

  it('t=1이면 최대(전폭, maxHeight)', () => {
    const s = barSizeForScale(1, workArea, limits)
    expect(s.width).toBe(1920)
    expect(s.height).toBe(WINDOW.maxHeight)
  })

  it('t=0이면 최소(minWidth, minHeight)', () => {
    const s = barSizeForScale(0, workArea, limits)
    expect(s.width).toBe(WINDOW.minWidth)
    expect(s.height).toBe(WINDOW.minHeight)
  })

  it('단조 증가: t가 커지면 width/height 모두 커진다', () => {
    const s1 = barSizeForScale(0.3, workArea, limits)
    const s2 = barSizeForScale(0.7, workArea, limits)
    expect(s2.width).toBeGreaterThan(s1.width)
    expect(s2.height).toBeGreaterThan(s1.height)
  })

  it('범위 밖 클램프: t<0은 t=0처럼, t>1은 t=1처럼', () => {
    const sNeg = barSizeForScale(-0.5, workArea, limits)
    const sZero = barSizeForScale(0, workArea, limits)
    expect(sNeg).toEqual(sZero)

    const sOver = barSizeForScale(1.5, workArea, limits)
    const sOne = barSizeForScale(1, workArea, limits)
    expect(sOver).toEqual(sOne)
  })

  it('다양한 workArea에서 동작한다', () => {
    const s = barSizeForScale(1, { width: 3840 }, limits)
    expect(s.width).toBe(3840)
  })
})

describe('centeredBarBounds', () => {
  it('전폭이면 x=0', () => {
    const b = centeredBarBounds({ width: 1920 }, 1920, 220, 0)
    expect(b.x).toBe(0)
    expect(b.y).toBe(0)
    expect(b.width).toBe(1920)
    expect(b.height).toBe(220)
  })

  it('절반폭이면 x=1/4 폭(가로 중앙)', () => {
    const b = centeredBarBounds({ width: 1920 }, 960, 220, 0)
    expect(b.x).toBe(480) // (1920 - 960) / 2
  })

  it('topMargin이 반영된다', () => {
    const b = centeredBarBounds({ width: 1920 }, 960, 220, 30)
    expect(b.y).toBe(30)
  })

  it('width > workArea일 때 x=0으로 클램프', () => {
    const b = centeredBarBounds({ width: 800 }, 1000, 220, 0)
    expect(b.x).toBe(0)
  })
})

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
