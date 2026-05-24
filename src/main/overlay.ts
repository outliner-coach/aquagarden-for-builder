import { BrowserWindow } from 'electron'

interface Bounds {
  x: number
  y: number
  width: number
  height: number
}

/** 순수 함수: bounds에 dx/dy를 적용한 새 bounds를 반환한다. */
export function applyDelta(bounds: Bounds, dx: number, dy: number): Bounds {
  return {
    x: bounds.x + dx,
    y: bounds.y + dy,
    width: bounds.width,
    height: bounds.height,
  }
}

/** click-through 설정. forward:true로 hover 이벤트는 계속 수신한다. */
export function setClickThrough(win: BrowserWindow, enabled: boolean): void {
  win.setIgnoreMouseEvents(enabled, { forward: true })
}

/** 플로팅 버튼 드래그로 창 전체를 dx/dy만큼 이동한다. */
export function moveWindowBy(win: BrowserWindow, dx: number, dy: number): void {
  const current = win.getBounds()
  const next = applyDelta(current, dx, dy)
  win.setBounds(next)
}
