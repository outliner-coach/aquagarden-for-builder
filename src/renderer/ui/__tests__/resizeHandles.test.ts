import { describe, it, expect } from 'vitest'
import { clampSize } from '../resizeHandles'

const limits = { minWidth: 400, minHeight: 80, maxWidth: 1920, maxHeight: 350 }

describe('clampSize', () => {
  it('범위 안 값은 그대로(정수화)', () => {
    expect(clampSize(800.4, 200.6, limits)).toEqual({ width: 800, height: 201 })
  })

  it('최소 미만은 최소로 클램프', () => {
    expect(clampSize(100, 10, limits)).toEqual({ width: 400, height: 80 })
  })

  it('최대 초과는 최대로 클램프', () => {
    expect(clampSize(5000, 9999, limits)).toEqual({ width: 1920, height: 350 })
  })

  it('width/height 독립적으로 클램프된다', () => {
    expect(clampSize(100, 9999, limits)).toEqual({ width: 400, height: 350 })
    expect(clampSize(5000, 10, limits)).toEqual({ width: 1920, height: 80 })
  })

  it('경계값은 그대로 유지', () => {
    expect(clampSize(limits.minWidth, limits.maxHeight, limits)).toEqual({
      width: 400,
      height: 350,
    })
  })
})
