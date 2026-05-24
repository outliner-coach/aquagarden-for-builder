/**
 * 패널 펼침 레이아웃 계산 (순수 로직).
 * 바(수조)는 화면 제자리에 두고, 패널이 들어갈 여백을 아래/위 중 어디에 둘지 결정한다.
 * 하단 공간이 부족하면 창을 강제로 위로 이동시키는 대신 패널을 위로 펼친다.
 */

export type PanelDirection = 'down' | 'up'

export interface PanelDirectionInput {
  /** 창 좌상단의 화면 Y (window.screenY) */
  winTop: number
  /** 현재 바(수조) 높이 px */
  barHeight: number
  /** 패널 밴드가 필요로 하는 추가 높이 px */
  panelExtra: number
  /** 작업영역 상단 Y (screen.availTop) */
  availTop: number
  /** 작업영역 높이 (screen.availHeight) */
  availHeight: number
}

/**
 * 패널을 아래/위 어디로 펼칠지 결정한다.
 * - 바 아래에 panelExtra 만큼 공간이 있으면 'down'(기본).
 * - 아니면 바 위에 공간이 있으면 'up'.
 * - 둘 다 부족하면 더 넓은 쪽(잘림 최소).
 */
export function choosePanelDirection(p: PanelDirectionInput): PanelDirection {
  const spaceBelow = p.availTop + p.availHeight - (p.winTop + p.barHeight)
  const spaceAbove = p.winTop - p.availTop
  if (spaceBelow >= p.panelExtra) return 'down'
  if (spaceAbove >= p.panelExtra) return 'up'
  return spaceBelow >= spaceAbove ? 'down' : 'up'
}

/** 패널 펼침 시 창 전체 높이 = 바 높이 + 패널 밴드 여백. */
export function expandedWindowHeight(barHeight: number, panelExtra: number): number {
  return barHeight + panelExtra
}

/**
 * 창 안에서 캔버스(바)의 top 오프셋(px).
 * 'down'·축소: 0(상단). 'up': 창 하단에 바를 붙여 화면상 제자리 유지 → winHeight-barHeight.
 */
export function canvasTopOffset(dir: PanelDirection, winHeight: number, barHeight: number): number {
  return dir === 'up' ? Math.max(0, winHeight - barHeight) : 0
}
