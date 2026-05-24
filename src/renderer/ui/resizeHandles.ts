/**
 * 창 모서리 드래그 리사이즈 — frameless·투명·always-on-top 창에서 OS 기본 리사이즈가
 * 불안정하므로, 캔버스 가장자리에 얇은 DOM 핸들을 두고 드래그로 크기를 조정한다.
 * OS 창 bounds 변경은 main에서만 수행하므로, onResize 콜백이 IPC로 요청한다.
 *
 * 좌표는 screenX/screenY(전역) 기준 델타를 쓴다. 창 좌상단이 앵커(고정)되므로
 * 창이 드래그 중 리사이즈되어도 전역 델타는 그대로 의도한 크기 변화량이 된다.
 */

export interface SizeLimits {
  minWidth: number
  minHeight: number
  maxWidth: number
  maxHeight: number
}

/** width/height를 한계 내로 클램프하고 정수화한다 (순수). */
export function clampSize(
  width: number,
  height: number,
  limits: SizeLimits,
): { width: number; height: number } {
  return {
    width: Math.round(Math.max(limits.minWidth, Math.min(width, limits.maxWidth))),
    height: Math.round(Math.max(limits.minHeight, Math.min(height, limits.maxHeight))),
  }
}

type Axis = 'e' | 's' | 'se'

export interface ResizeHandleCallbacks {
  /** 드래그 시작 시점의 현재 바 크기 */
  getStartSize: () => { width: number; height: number }
  /** 클램프된 새 크기로 리사이즈 요청 (드래그 중 실시간 호출) */
  onResize: (width: number, height: number) => void
  /** 핸들 위 hover/드래그 여부 — click-through 중에도 핸들 조작 가능하게 */
  onHoverChange: (hovering: boolean) => void
}

const HANDLE_THICKNESS = 8
const CORNER_SIZE = 16

function makeHandle(axis: Axis): HTMLDivElement {
  const el = document.createElement('div')
  el.dataset['resize'] = axis
  const cursor = axis === 'e' ? 'ew-resize' : axis === 's' ? 'ns-resize' : 'nwse-resize'
  const common = `position:absolute;z-index:10000;${`cursor:${cursor};`}`
  if (axis === 'e') {
    el.style.cssText = common + `top:0;right:0;width:${HANDLE_THICKNESS}px;height:100%;`
  } else if (axis === 's') {
    el.style.cssText = common + `left:0;bottom:0;height:${HANDLE_THICKNESS}px;width:100%;`
  } else {
    el.style.cssText = common + `right:0;bottom:0;width:${CORNER_SIZE}px;height:${CORNER_SIZE}px;`
  }
  return el
}

/**
 * host(캔버스 컨테이너) 가장자리에 리사이즈 핸들을 설치한다.
 * host는 position:relative로 설정되어 핸들이 그 안에 절대배치된다.
 */
export function setupResizeHandles(
  host: HTMLElement,
  getLimits: () => SizeLimits,
  cb: ResizeHandleCallbacks,
): void {
  if (getComputedStyle(host).position === 'static') {
    host.style.position = 'relative'
  }

  for (const axis of ['e', 's', 'se'] as Axis[]) {
    const handle = makeHandle(axis)
    host.appendChild(handle)

    let startScreenX = 0
    let startScreenY = 0
    let startW = 0
    let startH = 0
    let dragging = false
    let rafPending = false
    let pendingW = 0
    let pendingH = 0

    const flush = (): void => {
      rafPending = false
      cb.onResize(pendingW, pendingH)
    }

    handle.addEventListener('mouseenter', () => cb.onHoverChange(true))
    handle.addEventListener('mouseleave', () => {
      if (!dragging) cb.onHoverChange(false)
    })

    handle.addEventListener('pointerdown', (e: PointerEvent) => {
      dragging = true
      startScreenX = e.screenX
      startScreenY = e.screenY
      const s = cb.getStartSize()
      startW = s.width
      startH = s.height
      handle.setPointerCapture(e.pointerId)
      cb.onHoverChange(true)
      e.preventDefault()
    })

    handle.addEventListener('pointermove', (e: PointerEvent) => {
      if (!dragging) return
      const dx = e.screenX - startScreenX
      const dy = e.screenY - startScreenY
      const wantW = axis === 's' ? startW : startW + dx
      const wantH = axis === 'e' ? startH : startH + dy
      const clamped = clampSize(wantW, wantH, getLimits())
      pendingW = clamped.width
      pendingH = clamped.height
      if (!rafPending) {
        rafPending = true
        requestAnimationFrame(flush)
      }
    })

    const endDrag = (e: PointerEvent): void => {
      if (!dragging) return
      dragging = false
      if (handle.hasPointerCapture(e.pointerId)) handle.releasePointerCapture(e.pointerId)
      cb.onHoverChange(false)
    }
    handle.addEventListener('pointerup', endDrag)
    handle.addEventListener('pointercancel', endDrag)
  }
}
