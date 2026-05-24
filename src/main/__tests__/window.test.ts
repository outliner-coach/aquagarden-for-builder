import { describe, it, expect } from 'vitest'
import { computeBarBounds, fovForHeight, clampSizeToDisplay } from '../window'
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

describe('clampSizeToDisplay', () => {
  const min = { minWidth: 200, minHeight: 100 }
  const primary = { x: 0, y: 0, width: 1920, height: 1080 }
  // 주 모니터 오른쪽에 붙은 보조 모니터 (전역 좌표 x=1920부터 시작)
  const secondary = { x: 1920, y: 0, width: 2560, height: 1440 }

  it('주 모니터 내에서 축소 시 위치를 유지한다', () => {
    const result = clampSizeToDisplay({ x: 100, y: 40, width: 800, height: 480 }, { width: 600, height: 400 }, primary, min)
    expect(result).toEqual({ x: 100, y: 40, width: 600, height: 400 })
  })

  it('보조 모니터 위의 창을 주 모니터로 끌어오지 않는다', () => {
    const current = { x: 2000, y: 40, width: 800, height: 480 }
    const result = clampSizeToDisplay(current, { width: 900, height: 520 }, secondary, min)
    // x는 보조 모니터 영역(>=1920) 안에 남아야 한다
    expect(result.x).toBe(2000)
    expect(result.x).toBeGreaterThanOrEqual(secondary.x)
  })

  it('보조 모니터 우측 끝을 넘기면 그 모니터 안쪽으로만 클램프한다', () => {
    const current = { x: 4400, y: 40, width: 200, height: 200 }
    const result = clampSizeToDisplay(current, { width: 400, height: 300 }, secondary, min)
    // 우측 한계 = area.x + area.width - w = 1920 + 2560 - 400 = 4080
    expect(result.x).toBe(4080)
    expect(result.x).toBeGreaterThanOrEqual(secondary.x)
  })

  it('너비/높이를 디스플레이 work area로 클램프한다', () => {
    const result = clampSizeToDisplay({ x: 0, y: 0, width: 100, height: 100 }, { width: 9999, height: 9999 }, primary, min)
    expect(result.width).toBe(primary.width)
    expect(result.height).toBe(primary.height)
  })

  it('최소 크기 제약을 적용한다', () => {
    const result = clampSizeToDisplay({ x: 0, y: 0, width: 100, height: 100 }, { width: 10, height: 10 }, primary, min)
    expect(result.width).toBe(min.minWidth)
    expect(result.height).toBe(min.minHeight)
  })

  it('소수 너비/높이를 반올림한다', () => {
    const result = clampSizeToDisplay({ x: 0, y: 0, width: 100, height: 100 }, { width: 600.6, height: 400.4 }, primary, min)
    expect(result.width).toBe(601)
    expect(result.height).toBe(400)
  })

  it('y 오프셋이 있는 디스플레이의 work area 상단으로 클램프한다', () => {
    const offset = { x: 0, y: 25, width: 1920, height: 1055 }
    const result = clampSizeToDisplay({ x: 0, y: 0, width: 800, height: 400 }, { width: 800, height: 400 }, offset, min)
    expect(result.y).toBe(25)
  })

  it('anchorBottom: 하단 가장자리를 고정한 채 위로 키운다', () => {
    // 바: y=600,height=220 (하단=820). 위로 펼쳐 height=640 → y=820-640=180, 하단 유지=820
    const current = { x: 100, y: 600, width: 800, height: 220 }
    const result = clampSizeToDisplay(current, { width: 800, height: 640 }, primary, min, true)
    expect(result.height).toBe(640)
    expect(result.y).toBe(180)
    expect(result.y + result.height).toBe(820) // 하단 가장자리 보존
  })

  it('anchorBottom: 축소 시에도 하단을 고정한다', () => {
    // 위로 펼쳤던 창을 바 높이로 축소: 하단 유지하며 위가 줄어든다
    const current = { x: 0, y: 180, width: 800, height: 640 }
    const result = clampSizeToDisplay(current, { width: 800, height: 220 }, primary, min, true)
    expect(result.y).toBe(600)
    expect(result.y + result.height).toBe(820)
  })

  it('anchorBottom: 위로 키워도 work area 상단을 넘지 않는다', () => {
    // 하단 고정 y가 음수가 되면 상단(area.y=0)으로 클램프
    const current = { x: 0, y: 50, width: 800, height: 220 } // 하단=270
    const result = clampSizeToDisplay(current, { width: 800, height: 640 }, primary, min, true)
    // 이상적 y = 270-640 = -370 → 0으로 클램프
    expect(result.y).toBe(0)
  })
})
