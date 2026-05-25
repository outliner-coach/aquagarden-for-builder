import { BrowserWindow, screen } from 'electron'

interface Bounds {
  x: number
  y: number
  width: number
  height: number
}

interface DisplayArea {
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
 * 창이 디스플레이 work area를 벗어나지 않게 위치를 클램프한다(순수, 크기는 유지).
 * 창을 화면 밖으로 드래그해 버튼째 사라져 복구 불가가 되던 문제를 막는다.
 * 창이 영역보다 크면(전폭 바 등) 시작 모서리(area.x/y)로 맞춘다.
 */
export function clampPositionToDisplay(bounds: Bounds, area: DisplayArea): Bounds {
  const maxX = Math.max(area.x, area.x + area.width - bounds.width)
  const maxY = Math.max(area.y, area.y + area.height - bounds.height)
  return {
    ...bounds,
    x: Math.max(area.x, Math.min(bounds.x, maxX)),
    y: Math.max(area.y, Math.min(bounds.y, maxY)),
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

/** 플로팅 버튼 드래그로 창 전체를 dx/dy만큼 이동한다. 화면 밖으로 사라지지 않게 클램프. */
export function moveWindowBy(win: BrowserWindow, dx: number, dy: number): void {
  const current = win.getBounds()
  const moved = applyDelta(current, dx, dy)
  // 이동 후 위치 기준으로 가장 많이 겹치는 디스플레이의 work area로 클램프(모니터 간 이동은 허용하되
  // 모든 화면 밖으로는 못 나가게 — getDisplayMatching은 겹침이 없어도 가장 가까운 디스플레이를 반환).
  const area = screen.getDisplayMatching(moved).workArea
  win.setBounds(clampPositionToDisplay(moved, area))
}
