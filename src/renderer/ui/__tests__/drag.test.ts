import { describe, it, expect } from 'vitest'
import { dragDelta, clampPanelPos, exceedsThreshold } from '../drag'

describe('exceedsThreshold', () => {
  const start = { x: 100, y: 100 }

  it('returns false when within threshold (jitter on click)', () => {
    expect(exceedsThreshold(start, { x: 102, y: 101 }, 4)).toBe(false)
  })

  it('returns false at exactly the threshold distance', () => {
    // 거리 4.0 == threshold 4 → 초과 아님(>이지 >=가 아님)
    expect(exceedsThreshold(start, { x: 104, y: 100 }, 4)).toBe(false)
  })

  it('returns true when moved beyond threshold (real drag)', () => {
    expect(exceedsThreshold(start, { x: 110, y: 100 }, 4)).toBe(true)
  })

  it('uses euclidean distance across both axes', () => {
    // (3,4) → 거리 5 > 4
    expect(exceedsThreshold(start, { x: 103, y: 104 }, 4)).toBe(true)
  })

  it('returns false when no movement', () => {
    expect(exceedsThreshold(start, { x: 100, y: 100 }, 4)).toBe(false)
  })
})

describe('dragDelta', () => {
  it('returns dx/dy between two points', () => {
    const result = dragDelta({ x: 10, y: 20 }, { x: 15, y: 25 })
    expect(result).toEqual({ dx: 5, dy: 5 })
  })

  it('handles negative deltas', () => {
    const result = dragDelta({ x: 100, y: 200 }, { x: 80, y: 190 })
    expect(result).toEqual({ dx: -20, dy: -10 })
  })

  it('returns zero when same point', () => {
    const result = dragDelta({ x: 50, y: 50 }, { x: 50, y: 50 })
    expect(result).toEqual({ dx: 0, dy: 0 })
  })

  it('handles fractional values', () => {
    const result = dragDelta({ x: 0.5, y: 0.5 }, { x: 1.5, y: 2.5 })
    expect(result.dx).toBeCloseTo(1)
    expect(result.dy).toBeCloseTo(2)
  })
})

describe('clampPanelPos', () => {
  const viewport = { width: 1920, height: 1080 }
  const panelSize = { width: 220, height: 300 }

  it('returns position when inside viewport', () => {
    const pos = { x: 100, y: 100 }
    const result = clampPanelPos(pos, viewport, panelSize)
    expect(result).toEqual({ x: 100, y: 100 })
  })

  it('clamps negative x to 0', () => {
    const pos = { x: -50, y: 100 }
    const result = clampPanelPos(pos, viewport, panelSize)
    expect(result.x).toBe(0)
    expect(result.y).toBe(100)
  })

  it('clamps negative y to 0', () => {
    const pos = { x: 100, y: -30 }
    const result = clampPanelPos(pos, viewport, panelSize)
    expect(result.x).toBe(100)
    expect(result.y).toBe(0)
  })

  it('clamps x when panel exceeds right edge', () => {
    const pos = { x: 1800, y: 100 }
    const result = clampPanelPos(pos, viewport, panelSize)
    // maxX = 1920 - 220 = 1700
    expect(result.x).toBe(1700)
  })

  it('clamps y when panel exceeds bottom edge', () => {
    const pos = { x: 100, y: 900 }
    const result = clampPanelPos(pos, viewport, panelSize)
    // maxY = 1080 - 300 = 780
    expect(result.y).toBe(780)
  })

  it('clamps both axes simultaneously', () => {
    const pos = { x: -10, y: 2000 }
    const result = clampPanelPos(pos, viewport, panelSize)
    expect(result.x).toBe(0)
    expect(result.y).toBe(780)
  })

  it('handles panel exactly at boundary', () => {
    const pos = { x: 1700, y: 780 }
    const result = clampPanelPos(pos, viewport, panelSize)
    expect(result).toEqual({ x: 1700, y: 780 })
  })

  it('handles small viewport where panel fills space', () => {
    const smallViewport = { width: 220, height: 300 }
    const pos = { x: 50, y: 50 }
    const result = clampPanelPos(pos, smallViewport, panelSize)
    // maxX = 220-220 = 0, maxY = 300-300 = 0
    expect(result).toEqual({ x: 0, y: 0 })
  })
})
