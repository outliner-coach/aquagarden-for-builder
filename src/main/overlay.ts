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

/**
 * 마우스 이벤트 무시(click-through) 설정.
 * forward:true로 hover(mousemove)는 계속 renderer에 전달되어, 컨트롤 위에서
 * renderer가 다시 ignore=false로 복원할 수 있게 한다. (수조만 통과, 버튼은 조작)
 */
export function setMouseIgnore(win: BrowserWindow, ignore: boolean): void {
  win.setIgnoreMouseEvents(ignore, { forward: true })
}

/** 플로팅 버튼 드래그로 창 전체를 dx/dy만큼 이동한다. */
export function moveWindowBy(win: BrowserWindow, dx: number, dy: number): void {
  const current = win.getBounds()
  const next = applyDelta(current, dx, dy)
  win.setBounds(next)
}
