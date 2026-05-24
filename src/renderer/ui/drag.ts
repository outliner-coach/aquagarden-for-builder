import { DRAG } from '../../shared/config'

const DRAG_CLICK_THRESHOLD_PX = DRAG.clickThresholdPx

/** 좌표 포인트 */
export interface Point {
  x: number
  y: number
}

/** 뷰포트/패널 크기 */
export interface Size {
  width: number
  height: number
}

/** 두 포인트 간 이동 델타를 계산하는 순수 함수 */
export function dragDelta(prev: Point, cur: Point): { dx: number; dy: number } {
  return { dx: cur.x - prev.x, dy: cur.y - prev.y }
}

/**
 * 시작점에서 현재점까지 유클리드 거리가 threshold를 '초과'하는지(순수).
 * 클릭 시 발생하는 미세 지터(1~2px)를 드래그로 오인해 토글이 스킵되던 문제(#4)를 막는다.
 */
export function exceedsThreshold(start: Point, cur: Point, threshold: number): boolean {
  return Math.hypot(cur.x - start.x, cur.y - start.y) > threshold
}

/** 패널 위치를 뷰포트 안에 클램프하는 순수 함수 */
export function clampPanelPos(
  pos: Point,
  viewport: Size,
  panelSize: Size,
): Point {
  const maxX = Math.max(0, viewport.width - panelSize.width)
  const maxY = Math.max(0, viewport.height - panelSize.height)
  return {
    x: Math.max(0, Math.min(pos.x, maxX)),
    y: Math.max(0, Math.min(pos.y, maxY)),
  }
}

/**
 * 플로팅 버튼 드래그 → 창 전체 이동.
 * pointer 이벤트의 이동 델타를 window.aqua.moveWindowBy로 보낸다.
 */
export function setupButtonDrag(
  button: HTMLElement,
  onMove: (dx: number, dy: number) => void,
  onClick: () => void,
): void {
  let dragging = false
  let started = false // 임계값을 넘어 실제 드래그로 전환됐는가
  let start: Point = { x: 0, y: 0 }
  let prev: Point = { x: 0, y: 0 }

  button.addEventListener('pointerdown', (e: PointerEvent) => {
    dragging = true
    started = false
    start = { x: e.screenX, y: e.screenY }
    prev = { x: e.screenX, y: e.screenY }
    button.setPointerCapture(e.pointerId)
    button.style.cursor = 'grabbing'
  })

  button.addEventListener('pointermove', (e: PointerEvent) => {
    if (!dragging) return
    const cur = { x: e.screenX, y: e.screenY }
    const delta = dragDelta(prev, cur)
    prev = cur
    // 임계값을 넘기 전엔 창을 움직이지 않는다 → 미세 지터는 '클릭'으로 유지.
    if (!started) {
      if (!exceedsThreshold(start, cur, DRAG_CLICK_THRESHOLD_PX)) return
      started = true
    }
    if (delta.dx !== 0 || delta.dy !== 0) {
      onMove(delta.dx, delta.dy)
    }
  })

  const endDrag = (e: PointerEvent) => {
    if (!dragging) return
    dragging = false
    if (button.hasPointerCapture(e.pointerId)) button.releasePointerCapture(e.pointerId)
    button.style.cursor = 'grab'
    // 임계값을 넘지 않았으면(=드래그 전환 안 됨) 클릭으로 처리 → 패널 토글.
    if (!started) {
      onClick()
    }
  }

  button.addEventListener('pointerup', endDrag)
  button.addEventListener('pointercancel', endDrag)
  // 캡처가 어떤 이유로든(멀티모니터로 창 이동 중 모니터 전환, OS 가로채기 등) 풀리면 드래그
  // 상태를 반드시 정리한다. 이게 빠지면 dragging이 true로 고착돼 이후 hover만 해도 창이 끌려가고
  // 클릭이 무반응처럼 보인다(보조 모니터로 드래그 후 버튼 무반응 — 0-A 클릭 무반응의 한 경로).
  // pointerup이 다른 모니터/요소에서 발생해 버튼에 미도달하는 케이스를 lostpointercapture가 메운다.
  button.addEventListener('lostpointercapture', () => {
    if (!dragging) return
    dragging = false
    button.style.cursor = 'grab'
  })
}

/**
 * 패널 드래그 → 패널만 이동 (CSS transform).
 * 창은 그대로, 패널 DOM의 위치만 갱신.
 */
export function setupPanelDrag(
  handle: HTMLElement,
  panel: HTMLElement,
): void {
  let dragging = false
  let prev: Point = { x: 0, y: 0 }

  handle.addEventListener('pointerdown', (e: PointerEvent) => {
    dragging = true
    prev = { x: e.clientX, y: e.clientY }
    handle.setPointerCapture(e.pointerId)
    handle.style.cursor = 'grabbing'
    e.stopPropagation()
  })

  handle.addEventListener('pointermove', (e: PointerEvent) => {
    if (!dragging) return
    const delta = dragDelta(prev, { x: e.clientX, y: e.clientY })
    prev = { x: e.clientX, y: e.clientY }

    const rect = panel.getBoundingClientRect()
    const newX = rect.left + delta.dx
    const newY = rect.top + delta.dy

    const viewport: Size = {
      width: window.innerWidth,
      height: window.innerHeight,
    }
    const panelSize: Size = { width: rect.width, height: rect.height }
    const clamped = clampPanelPos({ x: newX, y: newY }, viewport, panelSize)

    panel.style.left = `${clamped.x}px`
    panel.style.top = `${clamped.y}px`
  })

  const endDrag = (e: PointerEvent) => {
    if (!dragging) return
    dragging = false
    if (handle.hasPointerCapture(e.pointerId)) handle.releasePointerCapture(e.pointerId)
    handle.style.cursor = 'grab'
  }

  handle.addEventListener('pointerup', endDrag)
  handle.addEventListener('pointercancel', endDrag)
  // 버튼 드래그와 동일하게, 캡처 유실 시 dragging 고착 방지(멀티모니터/OS 가로채기).
  handle.addEventListener('lostpointercapture', () => {
    if (!dragging) return
    dragging = false
    handle.style.cursor = 'grab'
  })
}
