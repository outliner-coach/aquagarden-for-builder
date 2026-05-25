import { ZOOM } from '../../shared/config'

/**
 * 휠 deltaY로 줌 배율을 증감하고 [min,max]로 클램프한다.
 * deltaY<0(휠 업)=확대(줌↑), deltaY>0(휠 다운)=축소(줌↓).
 */
export function zoomFromWheel(
  current: number,
  deltaY: number,
  step: number = ZOOM.wheelStep,
  min: number = ZOOM.min,
  max: number = ZOOM.max,
): number {
  const dir = deltaY < 0 ? 1 : -1
  const next = current + dir * step
  return Math.max(min, Math.min(max, next))
}

/** 줌 배율(예 1.0~2.0) → 슬라이더 퍼센트(100~200), 정수 반올림. */
export function zoomToSliderPercent(factor: number): number {
  return Math.round(factor * 100)
}

/** 슬라이더 퍼센트(100~200) → 줌 배율(1.0~2.0). */
export function sliderPercentToZoom(percent: number): number {
  return percent / 100
}
