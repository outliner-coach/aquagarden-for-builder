import { FISH, COLORS } from '../../shared/config'
import { setupButtonDrag, setupPanelDrag } from './drag'

/** ControlPanel이 외부에 알려주는 콜백 인터페이스 */
export interface ControlPanelCallbacks {
  onFishCountChange: (count: number) => void
  onBrightnessChange: (b01: number) => void
  onHiddenChange: (hidden: boolean) => void
  onClickThroughChange: (enabled: boolean) => void
  onSceneTransparencyChange: (t01: number) => void
  onWindowScaleChange: (t01: number) => void
  onAlwaysOnTopChange: (enabled: boolean) => void
  onMoveWindow: (dx: number, dy: number) => void
  /** 마우스가 컨트롤(버튼+패널) 위에 들어오고/나갈 때. click-through 중 컨트롤 조작용. */
  onControlsHoverChange: (hovering: boolean) => void
  /** 패널 확장/축소 시. 창 높이 조정용(잘림 방지). */
  onExpandedChange: (expanded: boolean) => void
}

/** 초기 상태 */
export interface ControlPanelState {
  fishCount: number
  brightness01: number
  sceneTransparency01: number
  windowScale01: number
  hidden: boolean
  clickThrough: boolean
  alwaysOnTop: boolean
}

/**
 * 플로팅 버튼 + 확장 패널 UI.
 * plain DOM + CSS, UI_GUIDE 준수. 수조 위에 떠 있는 제어 위젯.
 */
export class ControlPanel {
  private readonly _root: HTMLElement
  private readonly _button: HTMLElement
  private readonly _panel: HTMLElement
  private readonly _callbacks: ControlPanelCallbacks
  private _expanded = false

  // 슬라이더/토글 참조
  private readonly _fishSlider: HTMLInputElement
  private readonly _fishValue: HTMLSpanElement
  private readonly _brightnessSlider: HTMLInputElement
  private readonly _brightnessValue: HTMLSpanElement
  private readonly _sceneTransSlider: HTMLInputElement
  private readonly _sceneTransValue: HTMLSpanElement
  private readonly _windowScaleSlider: HTMLInputElement
  private readonly _windowScaleValue: HTMLSpanElement
  private readonly _hideToggle: HTMLInputElement
  private readonly _clickThroughToggle: HTMLInputElement
  private readonly _alwaysOnTopToggle: HTMLInputElement

  constructor(
    container: HTMLElement,
    state: ControlPanelState,
    callbacks: ControlPanelCallbacks,
  ) {
    this._callbacks = callbacks

    // 루트 컨테이너 — 상단 우측 고정(메뉴바를 피하도록 top:36). 패널은 아래로 펼친다.
    this._root = document.createElement('div')
    this._root.className = 'cp'
    this._root.style.cssText = 'position:fixed;top:36px;right:12px;z-index:9999;'

    // ── 플로팅 버튼 (40px 원형) ──
    this._button = document.createElement('div')
    this._button.className = 'cp__btn'
    this._button.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10c1.85 0 3.58-.5 5.07-1.38"/><path d="M17 8c-1.5 2-4 3-7 3"/><path d="M22 12c0-2.5-1-4.5-2.5-6"/><circle cx="8" cy="9" r="1" fill="currentColor"/></svg>`
    this._root.appendChild(this._button)

    // ── 확장 패널 ──
    this._panel = document.createElement('div')
    this._panel.className = 'cp__panel'
    this._panel.style.cssText = `
      position:absolute;top:48px;right:0;
      width:220px;border-radius:12px;padding:14px 16px;
      background:${COLORS.panelBg};border:1px solid ${COLORS.border};
      opacity:0;pointer-events:none;
      transform:translateY(-4px);
      transition:opacity 150ms ease-out,transform 150ms ease-out;
    `

    // 패널 드래그 핸들 (표제 영역)
    const header = document.createElement('div')
    header.className = 'cp__panel-header'
    header.style.cssText = `
      font-size:12px;font-weight:600;
      color:${COLORS.textSecondary};letter-spacing:0.02em;
      margin-bottom:12px;cursor:grab;user-select:none;
    `
    header.textContent = 'Aquagarden'
    this._panel.appendChild(header)

    // ── 개체수 슬라이더 ──
    const { slider: fishSlider, value: fishValue } = this._createSlider(
      '개체수',
      FISH.min,
      FISH.max,
      1,
      state.fishCount,
      (v) => callbacks.onFishCountChange(v),
    )
    this._fishSlider = fishSlider
    this._fishValue = fishValue

    // ── 밝기 슬라이더 ──
    const { slider: brightSlider, value: brightValue } = this._createSlider(
      '밝기',
      0,
      100,
      1,
      Math.round(state.brightness01 * 100),
      (v) => callbacks.onBrightnessChange(v / 100),
    )
    this._brightnessSlider = brightSlider
    this._brightnessValue = brightValue

    // ── 배경 투명도 슬라이더 ──
    const { slider: sceneTransSlider, value: sceneTransValue } = this._createSlider(
      '배경 투명도',
      0,
      100,
      1,
      Math.round(state.sceneTransparency01 * 100),
      (v) => callbacks.onSceneTransparencyChange(v / 100),
    )
    this._sceneTransSlider = sceneTransSlider
    this._sceneTransValue = sceneTransValue

    // ── 창 크기 슬라이더 ──
    const { slider: windowScaleSlider, value: windowScaleValue } = this._createSlider(
      '창 크기',
      0,
      100,
      1,
      Math.round(state.windowScale01 * 100),
      (v) => callbacks.onWindowScaleChange(v / 100),
    )
    this._windowScaleSlider = windowScaleSlider
    this._windowScaleValue = windowScaleValue

    // ── Hide/Show 토글 ──
    this._hideToggle = this._createToggle(
      '수조 숨김',
      state.hidden,
      (checked) => callbacks.onHiddenChange(checked),
    )

    // ── Click-through 토글 ──
    this._clickThroughToggle = this._createToggle(
      '마우스 투과',
      state.clickThrough,
      (checked) => callbacks.onClickThroughChange(checked),
    )

    // ── Always on top 토글 ──
    this._alwaysOnTopToggle = this._createToggle(
      'Always on Top',
      state.alwaysOnTop,
      (checked) => callbacks.onAlwaysOnTopChange(checked),
    )

    this._root.appendChild(this._panel)
    container.appendChild(this._root)

    // ── CSS 주입 ──
    this._injectStyles()

    // ── 드래그 설정 ──
    // 버튼 드래그 → 창 전체 이동, 클릭 → 패널 토글
    setupButtonDrag(
      this._button,
      (dx, dy) => callbacks.onMoveWindow(dx, dy),
      () => this._togglePanel(),
    )

    // 패널 헤더 드래그 → 패널만 이동
    setupPanelDrag(header, this._panel)

    // 컨트롤(버튼+패널) hover 감지 → click-through 중에도 컨트롤은 조작 가능하게.
    // (root의 자손인 패널 위도 'inside'로 간주되어 mouseleave가 먼저 발생하지 않는다)
    this._root.addEventListener('mouseenter', () => {
      this._callbacks.onControlsHoverChange(true)
    })
    this._root.addEventListener('mouseleave', () => {
      this._callbacks.onControlsHoverChange(false)
    })
  }

  /** 외부에서 상태를 갱신하면 UI를 동기화 */
  syncState(state: ControlPanelState): void {
    this._fishSlider.value = String(state.fishCount)
    this._fishValue.textContent = String(state.fishCount)
    this._brightnessSlider.value = String(Math.round(state.brightness01 * 100))
    this._brightnessValue.textContent = `${Math.round(state.brightness01 * 100)}%`
    this._sceneTransSlider.value = String(Math.round(state.sceneTransparency01 * 100))
    this._sceneTransValue.textContent = `${Math.round(state.sceneTransparency01 * 100)}%`
    this._windowScaleSlider.value = String(Math.round(state.windowScale01 * 100))
    this._windowScaleValue.textContent = `${Math.round(state.windowScale01 * 100)}%`
    this._hideToggle.checked = state.hidden
    this._clickThroughToggle.checked = state.clickThrough
    this._alwaysOnTopToggle.checked = state.alwaysOnTop
  }

  private _togglePanel(): void {
    this._expanded = !this._expanded
    // 펼칠 때는 잘리지 않도록 먼저 창 높이를 키운다.
    this._callbacks.onExpandedChange(this._expanded)
    if (this._expanded) {
      this._panel.style.opacity = '1'
      this._panel.style.pointerEvents = 'auto'
      this._panel.style.transform = 'translateY(0)'
    } else {
      this._panel.style.opacity = '0'
      this._panel.style.pointerEvents = 'none'
      this._panel.style.transform = 'translateY(-4px)'
    }
  }

  private _createSlider(
    label: string,
    min: number,
    max: number,
    step: number,
    initial: number,
    onChange: (value: number) => void,
  ): { slider: HTMLInputElement; value: HTMLSpanElement } {
    const row = document.createElement('div')
    row.style.cssText = 'margin-bottom:12px;'

    const labelRow = document.createElement('div')
    labelRow.style.cssText = 'display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;'

    const labelEl = document.createElement('span')
    labelEl.style.cssText = `font-size:12px;font-weight:500;color:${COLORS.textSecondary};`
    labelEl.textContent = label

    const valueEl = document.createElement('span')
    valueEl.className = 'cp__value'
    valueEl.style.cssText = `font-size:12px;font-weight:600;color:${COLORS.textPrimary};font-variant-numeric:tabular-nums;`
    const isPercent = label === '밝기' || label === '배경 투명도' || label === '창 크기'
    valueEl.textContent = isPercent ? `${initial}%` : String(initial)

    labelRow.appendChild(labelEl)
    labelRow.appendChild(valueEl)

    const slider = document.createElement('input')
    slider.type = 'range'
    slider.className = 'cp__slider'
    slider.min = String(min)
    slider.max = String(max)
    slider.step = String(step)
    slider.value = String(initial)

    slider.addEventListener('input', () => {
      const v = Number(slider.value)
      valueEl.textContent = isPercent ? `${v}%` : String(v)
      onChange(v)
    })

    row.appendChild(labelRow)
    row.appendChild(slider)
    this._panel.appendChild(row)

    return { slider, value: valueEl }
  }

  private _createToggle(
    label: string,
    initial: boolean,
    onChange: (checked: boolean) => void,
  ): HTMLInputElement {
    const row = document.createElement('div')
    row.style.cssText = 'display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;'

    const labelEl = document.createElement('span')
    labelEl.style.cssText = `font-size:12px;font-weight:500;color:${COLORS.textSecondary};`
    labelEl.textContent = label

    const toggleWrap = document.createElement('label')
    toggleWrap.className = 'cp__toggle'

    const input = document.createElement('input')
    input.type = 'checkbox'
    input.checked = initial
    input.style.cssText = 'display:none;'

    const track = document.createElement('span')
    track.className = 'cp__toggle-track'

    input.addEventListener('change', () => {
      onChange(input.checked)
    })

    toggleWrap.appendChild(input)
    toggleWrap.appendChild(track)

    row.appendChild(labelEl)
    row.appendChild(toggleWrap)
    this._panel.appendChild(row)

    return input
  }

  private _injectStyles(): void {
    if (document.getElementById('cp-styles')) return
    const style = document.createElement('style')
    style.id = 'cp-styles'
    style.textContent = `
      .cp__btn {
        width:40px;height:40px;border-radius:50%;
        background:${COLORS.buttonBg};border:1px solid ${COLORS.border};
        display:flex;align-items:center;justify-content:center;
        cursor:grab;color:${COLORS.textPrimary};
        transition:background 150ms;user-select:none;
      }
      .cp__btn:hover { background:rgba(15,23,28,0.76); }

      .cp__slider {
        -webkit-appearance:none;appearance:none;
        width:100%;height:4px;border-radius:2px;outline:none;
        background:${COLORS.sliderTrackEmpty};
      }
      .cp__slider::-webkit-slider-thumb {
        -webkit-appearance:none;appearance:none;
        width:14px;height:14px;border-radius:50%;
        background:#fff;cursor:pointer;
        margin-top:0;
      }
      .cp__slider::-webkit-slider-runnable-track {
        height:4px;border-radius:2px;
      }

      .cp__toggle {
        position:relative;display:inline-block;
        width:36px;height:20px;cursor:pointer;
      }
      .cp__toggle-track {
        position:absolute;top:0;left:0;right:0;bottom:0;
        border-radius:10px;
        background:${COLORS.toggleOff};
        transition:background 150ms;
      }
      .cp__toggle-track::after {
        content:'';position:absolute;
        width:16px;height:16px;border-radius:50%;
        left:2px;top:2px;background:#fff;
        transition:transform 150ms;
      }
      .cp__toggle input:checked + .cp__toggle-track {
        background:${COLORS.point};
      }
      .cp__toggle input:checked + .cp__toggle-track::after {
        transform:translateX(16px);
      }
    `
    document.head.appendChild(style)
  }
}
