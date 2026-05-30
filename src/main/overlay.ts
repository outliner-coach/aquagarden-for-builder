import { BrowserWindow, screen } from 'electron'
import { WINDOW } from '../shared/config'

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

/** 창과 디스플레이의 교집합(가시) 폭·높이. 안 겹치면 0. (순수) */
function visibleOverlap(bounds: Bounds, area: DisplayArea): { w: number; h: number } {
  const w = Math.max(
    0,
    Math.min(bounds.x + bounds.width, area.x + area.width) - Math.max(bounds.x, area.x),
  )
  const h = Math.max(
    0,
    Math.min(bounds.y + bounds.height, area.y + area.height) - Math.max(bounds.y, area.y),
  )
  return { w, h }
}

/**
 * 다중 디스플레이에서 창 위치를 클램프한다(순수, 크기 보존).
 *
 * 어떤 디스플레이에든 최소 가시영역(minVisible)만큼 보이면 **그대로 둔다** → 모니터 간 자유 이동
 * 허용(전폭 바도 옆 모니터로 넘어갈 수 있다). 어디에도 그만큼 안 보이면(완전 이탈) 겹침이 가장 큰,
 * 겹침이 전혀 없으면 중심이 가장 가까운 디스플레이 안으로 끌어당겨 버튼째 사라지는 것을 막는다.
 *
 * 기존 단일-디스플레이 클램프(clampPositionToDisplay)가 전폭 바를 x=area.x로 고정해 좌우 이동을
 * 원천 차단하고, 단일 디스플레이 work area에 가둬 다른 모니터로 못 넘어가던 문제를 해결한다.
 */
export function clampPositionToDisplays(
  bounds: Bounds,
  displays: DisplayArea[],
  minVisible: number,
): Bounds {
  if (displays.length === 0) return bounds

  const needW = Math.min(minVisible, bounds.width)
  const needH = Math.min(minVisible, bounds.height)

  // 어떤 디스플레이든 충분히 보이면 이동 허용(그대로).
  for (const d of displays) {
    const ov = visibleOverlap(bounds, d)
    if (ov.w >= needW && ov.h >= needH) return bounds
  }

  // 완전 이탈 — 끌어당길 대상 디스플레이를 고른다: 겹침 면적 최대, 없으면 중심 거리 최소.
  let target = displays[0]
  let bestArea = -1
  for (const d of displays) {
    const ov = visibleOverlap(bounds, d)
    const areaOverlap = ov.w * ov.h
    if (areaOverlap > bestArea) {
      bestArea = areaOverlap
      target = d
    }
  }
  if (bestArea <= 0) {
    const cx = bounds.x + bounds.width / 2
    const cy = bounds.y + bounds.height / 2
    let minDist = Infinity
    for (const d of displays) {
      const dcx = d.x + d.width / 2
      const dcy = d.y + d.height / 2
      const dist = (cx - dcx) ** 2 + (cy - dcy) ** 2
      if (dist < minDist) {
        minDist = dist
        target = d
      }
    }
  }
  return clampPositionToDisplay(bounds, target)
}

/**
 * 마우스 이벤트 무시(click-through) 설정.
 * forward:true로 hover(mousemove)는 계속 renderer에 전달되어, 컨트롤 위에서
 * renderer가 다시 ignore=false로 복원할 수 있게 한다. (수조만 통과, 버튼은 조작)
 */
export function setMouseIgnore(win: BrowserWindow, ignore: boolean): void {
  win.setIgnoreMouseEvents(ignore, { forward: true })
}

/** 플로팅 버튼 드래그로 창 전체를 dx/dy만큼 이동한다. 모니터 간 이동은 허용하되 완전 이탈만 방지. */
export function moveWindowBy(win: BrowserWindow, dx: number, dy: number): void {
  const current = win.getBounds()
  const moved = applyDelta(current, dx, dy)
  // 전체 디스플레이의 work area를 모두 넘겨, 창이 어느 모니터든 충분히 걸쳐 있으면 이동을 허용한다.
  // (단일 디스플레이로 클램프하면 전폭 바가 좌우로 못 움직이고 다른 모니터로도 못 넘어갔다.)
  const areas = screen.getAllDisplays().map((d) => d.workArea)
  win.setBounds(clampPositionToDisplays(moved, areas, WINDOW.minVisibleOnMove))
}
