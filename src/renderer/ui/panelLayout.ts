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
 * 창 크기 변경 시 하단 가장자리를 고정(anchorBottom)할지 결정한다(순수).
 * 하단 앵커는 'up' 방향에서만 의미가 있고:
 * - 'toggle'(패널 펼침/접힘): 'up'이면 항상 하단 고정(바가 제자리 유지).
 * - 'resize': 패널이 **실제로 펼쳐져 있을 때만** 하단 고정. 닫힌 채 리사이즈는 좌상단 앵커여야 한다.
 *   (currentPanelDir가 'up'으로 남아 있어도 닫힌 상태 리사이즈가 하단 앵커가 되면, 우하단 그립을
 *    끌 때 바닥이 고정되고 top이 위로 기어올라 창이 화면 밖으로 사라지는 버그가 있었다.)
 */
export function shouldAnchorBottom(
  op: 'toggle' | 'resize',
  panelExpanded: boolean,
  dir: PanelDirection,
): boolean {
  if (dir !== 'up') return false
  return op === 'toggle' ? true : panelExpanded
}

/**
 * 창 안에서 캔버스(바)의 top 오프셋(px).
 * 'down'·축소: 0(상단). 'up': 창 하단에 바를 붙여 화면상 제자리 유지 → winHeight-barHeight.
 */
export function canvasTopOffset(dir: PanelDirection, winHeight: number, barHeight: number): number {
  return dir === 'up' ? Math.max(0, winHeight - barHeight) : 0
}

/**
 * 펼침 방향에 따라 패널이 실제로 차지할 수 있는 높이를 가용 공간으로 클램프한다(순수).
 * desiredPanelPx: 패널 실제 콘텐츠 높이(측정값) + 여백.
 * dir==='up'이면 바 위 공간, 'down'이면 바 아래 공간으로 제한. 음수는 0.
 */
export function requiredPanelExtra(
  desiredPanelPx: number,
  availTop: number,
  availHeight: number,
  winTop: number,
  barHeight: number,
  dir: PanelDirection,
): number {
  const spaceBelow = availTop + availHeight - (winTop + barHeight)
  const spaceAbove = winTop - availTop
  const room = dir === 'up' ? spaceAbove : spaceBelow
  return Math.max(0, Math.min(desiredPanelPx, room))
}
