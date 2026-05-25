import { describe, it, expect } from 'vitest'
import { zoomFromWheel, zoomToSliderPercent, sliderPercentToZoom } from '../zoomHelpers'
import { ZOOM } from '../../../shared/config'

describe('zoomFromWheel', () => {
  it('휠 업(deltaY<0)은 확대 — 줌 증가', () => {
    expect(zoomFromWheel(1.0, -100)).toBeCloseTo(1.0 + ZOOM.wheelStep)
  })

  it('휠 다운(deltaY>0)은 축소 — 줌 감소', () => {
    expect(zoomFromWheel(1.5, 100)).toBeCloseTo(1.5 - ZOOM.wheelStep)
  })

  it('최대 줌을 넘지 않도록 클램프', () => {
    expect(zoomFromWheel(ZOOM.max, -100)).toBe(ZOOM.max)
  })

  it('최소 줌 아래로 내려가지 않도록 클램프', () => {
    expect(zoomFromWheel(ZOOM.min, 100)).toBe(ZOOM.min)
  })

  it('명시적 step/min/max를 존중', () => {
    expect(zoomFromWheel(1.0, -1, 0.5, 1.0, 3.0)).toBeCloseTo(1.5)
  })
})

describe('슬라이더 ↔ 줌 매핑', () => {
  it('1.0배 → 100%', () => {
    expect(zoomToSliderPercent(1.0)).toBe(100)
  })

  it('2.0배 → 200%', () => {
    expect(zoomToSliderPercent(2.0)).toBe(200)
  })

  it('100% → 1.0배, 200% → 2.0배', () => {
    expect(sliderPercentToZoom(100)).toBeCloseTo(1.0)
    expect(sliderPercentToZoom(200)).toBeCloseTo(2.0)
  })

  it('왕복 변환이 일관(반올림 오차 내)', () => {
    expect(sliderPercentToZoom(zoomToSliderPercent(1.5))).toBeCloseTo(1.5)
  })
})
