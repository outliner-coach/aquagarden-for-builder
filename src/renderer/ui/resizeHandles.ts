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

// 가장자리 히트영역은 넉넉히(보이지 않아도 잡기 쉽게), 코너 그립은 더 크고 '보이게'.
const HANDLE_THICKNESS = 12
const CORNER_SIZE = 24

// 우하단 코너 그립의 빗금 무늬 (평상시 옅게, hover 시 진하게). 투명 오버레이에서도
// 임의의 바탕화면 위에 사각형으로 보이지 않도록 코너에만, 대각선 스트라이프로 페더링.
const GRIP_STRIPES = (alpha: number): string =>
  `repeating-linear-gradient(-45deg,` +
  ` rgba(255,255,255,${alpha}) 0px, rgba(255,255,255,${alpha}) 2px,` +
  ` rgba(255,255,255,0) 2px, rgba(255,255,255,0) 5px)`

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
    // 우하단: 보이는 그립. 무늬는 코너 안쪽으로만(우하단에 모이는 삼각형 느낌).
    el.style.cssText =
      common +
      `right:0;bottom:0;width:${CORNER_SIZE}px;height:${CORNER_SIZE}px;` +
      `background:${GRIP_STRIPES(0.35)};` +
      `border-bottom-right-radius:4px;transition:background 120ms;`
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

    const isCorner = axis === 'se'
    handle.addEventListener('mouseenter', () => {
      if (isCorner) handle.style.background = GRIP_STRIPES(0.7)
      cb.onHoverChange(true)
    })
    handle.addEventListener('mouseleave', () => {
      if (!dragging) {
        if (isCorner) handle.style.background = GRIP_STRIPES(0.35)
        cb.onHoverChange(false)
      }
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
      if (isCorner) handle.style.background = GRIP_STRIPES(0.35)
      cb.onHoverChange(false)
    }
    handle.addEventListener('pointerup', endDrag)
    handle.addEventListener('pointercancel', endDrag)
    // 캡처가 어떤 이유로든(창 리사이즈로 커서가 창 밖, OS 가로채기 등) 풀리면 드래그 상태를
    // 반드시 정리한다. 이게 빠지면 dragging/capture가 고착돼 이후 포인터 이벤트를 가로채
    // 패널·버튼이 무반응처럼 보일 수 있다(0-A 클릭 무반응의 한 경로).
    handle.addEventListener('lostpointercapture', () => {
      if (!dragging) return
      dragging = false
      if (isCorner) handle.style.background = GRIP_STRIPES(0.35)
      cb.onHoverChange(false)
    })
  }
}
