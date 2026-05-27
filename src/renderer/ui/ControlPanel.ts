import { FISH, COLORS, ZOOM } from '../../shared/config'
import { setupButtonDrag, setupPanelDrag } from './drag'
import type { LureMode } from '../entities/FoodLure'
import { zoomToSliderPercent, sliderPercentToZoom } from '../core/zoomHelpers'

/** ControlPanel이 외부에 알려주는 콜백 인터페이스 */
export interface ControlPanelCallbacks {
  onFishCountChange: (count: number) => void
  onBrightnessChange: (b01: number) => void
  onHiddenChange: (hidden: boolean) => void
  onClickThroughChange: (enabled: boolean) => void
  onSceneTransparencyChange: (t01: number) => void
  onAlwaysOnTopChange: (enabled: boolean) => void
  onMoveWindow: (dx: number, dy: number) => void
  /** 마우스가 컨트롤(버튼+패널) 위에 들어오고/나갈 때. click-through 중 컨트롤 조작용. */
  onControlsHoverChange: (hovering: boolean) => void
  /** 패널 확장/축소 시. 창 높이 조정용(잘림 방지). */
  onExpandedChange: (expanded: boolean) => void
  /** 확대(줌) 배율 변경. */
  onZoomChange: (factor: number) => void
  /** 먹이주기/놀래키기 모드 변경. */
  onLureModeChange: (mode: LureMode) => void
  /** 특별 개체 활성화 토글 변경. */
  onEnabledFeaturesChange: (ids: string[]) => void
  /** 앱 종료 요청(파괴적). main이 app.quit 수행. */
  onQuit: () => void
}

/** 초기 상태 */
export interface ControlPanelState {
  fishCount: number
  brightness01: number
  sceneTransparency01: number
  hidden: boolean
  clickThrough: boolean
  alwaysOnTop: boolean
  zoom: number
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
  private readonly _zoomSlider: HTMLInputElement
  private readonly _zoomValue: HTMLSpanElement
  private _zoomRow!: HTMLElement
  private _lureRow!: HTMLDivElement
  private _interactionNotice!: HTMLDivElement
  private readonly _hideToggle: HTMLInputElement
  private readonly _clickThroughToggle: HTMLInputElement
  private readonly _alwaysOnTopToggle: HTMLInputElement
  private readonly _feedBtn: HTMLButtonElement
  private readonly _scareBtn: HTMLButtonElement
  private _lureHint!: HTMLDivElement
  private _statusHint!: HTMLDivElement
  private _quitBtn!: HTMLButtonElement
  private _quitArmed = false
  private _quitTimer: ReturnType<typeof setTimeout> | null = null
  /** 패널 닫힘 상태의 transform — 펼침 방향(up/down)에 따라 슬라이드 방향이 바뀐다. */
  private _closedTransform = 'translateY(-4px)'
  private _helpModal!: HTMLDivElement
  private _featureGroupBody!: HTMLDivElement

  constructor(
    container: HTMLElement,
    state: ControlPanelState,
    callbacks: ControlPanelCallbacks,
  ) {
    this._callbacks = callbacks

    // 루트 컨테이너 — 상단 우측 고정(메뉴바를 피하도록 top:36). 패널은 아래로 펼친다.
    this._root = document.createElement('div')
    this._root.className = 'cp'
    // top:40 — macOS 메뉴바(고DPI 디스플레이에서 ~33px) 아래로 충분히 내려 버튼 상단이
    // 메뉴바에 가려 빗나가지 않게 한다(0-A: 작은 버튼이 메뉴바에 붙어 클릭이 빗나가던 문제).
    this._root.style.cssText = 'position:fixed;top:40px;right:12px;z-index:9999;'

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
      width:310px;border-radius:12px;padding:14px 16px;
      background:${COLORS.panelBg};border:1px solid ${COLORS.border};
      opacity:0;pointer-events:none;
      transform:translateY(-4px);
      transition:opacity 150ms ease-out,transform 150ms ease-out;
      max-height:calc(100vh - 96px);overflow-y:auto;
    `

    // 패널 드래그 핸들 (표제 영역) — 제목 + 가이드('?') 버튼
    const header = document.createElement('div')
    header.className = 'cp__panel-header'
    header.style.cssText = `
      display:flex;align-items:center;justify-content:space-between;
      font-size:12px;font-weight:600;
      color:${COLORS.textSecondary};letter-spacing:0.02em;
      margin-bottom:12px;cursor:grab;user-select:none;
    `
    const titleEl = document.createElement('span')
    titleEl.textContent = 'Aquagarden'
    header.appendChild(titleEl)

    const helpBtn = document.createElement('button')
    helpBtn.className = 'cp__help-btn'
    helpBtn.textContent = '?'
    helpBtn.title = '이용 방법'
    // 헤더 드래그와 충돌 방지: 버튼 위 pointerdown은 드래그를 시작시키지 않는다.
    helpBtn.addEventListener('pointerdown', (e) => e.stopPropagation())
    helpBtn.addEventListener('click', () => this._openHelp())
    header.appendChild(helpBtn)

    this._panel.appendChild(header)

    // ── 2열 본문 grid ──
    const body = document.createElement('div')
    body.className = 'cp__body'
    this._panel.appendChild(body)

    const leftCol = document.createElement('div')
    const rightCol = document.createElement('div')
    body.append(leftCol, rightCol)

    // ── 왼쪽: 어종 ──
    this._appendSectionLabel(leftCol, '어종')
    const { slider: fishSlider, value: fishValue } = this._createSlider(
      leftCol, '개체수', FISH.min, FISH.max, 1, state.fishCount, '',
      (v) => callbacks.onFishCountChange(v),
    )
    this._fishSlider = fishSlider
    this._fishValue = fishValue

    // 특별 개체 칩 컨테이너(setFeatureSpecies로 채움). 접이식 제거 — 항상 표시.
    this._appendSectionLabel(leftCol, '특별 개체')
    const featureWrap = document.createElement('div')
    featureWrap.className = 'cp__feature-chips'
    leftCol.appendChild(featureWrap)
    this._featureGroupBody = featureWrap

    // ── 오른쪽: 표시 · 조명 ──
    this._appendSectionLabel(rightCol, '표시 · 조명')
    const { slider: brightSlider, value: brightValue } = this._createSlider(
      rightCol, '밝기', 0, 100, 1, Math.round(state.brightness01 * 100), '%',
      (v) => callbacks.onBrightnessChange(v / 100),
    )
    this._brightnessSlider = brightSlider
    this._brightnessValue = brightValue

    const { slider: sceneTransSlider, value: sceneTransValue } = this._createSlider(
      rightCol, '투명도', 0, 100, 1, Math.round(state.sceneTransparency01 * 100), '%',
      (v) => callbacks.onSceneTransparencyChange(v / 100),
    )
    this._sceneTransSlider = sceneTransSlider
    this._sceneTransValue = sceneTransValue

    const { slider: zoomSlider, value: zoomValue } = this._createSlider(
      rightCol, '확대', Math.round(ZOOM.min * 100), Math.round(ZOOM.max * 100), 1,
      zoomToSliderPercent(state.zoom), '%',
      (v) => callbacks.onZoomChange(sliderPercentToZoom(v)),
    )
    this._zoomSlider = zoomSlider
    this._zoomValue = zoomValue
    this._zoomRow = zoomSlider.parentElement as HTMLElement

    this._hideToggle = this._createToggle(rightCol, '수조 숨김', state.hidden,
      (checked) => callbacks.onHiddenChange(checked))
    this._clickThroughToggle = this._createToggle(rightCol, '마우스 투과', state.clickThrough,
      (checked) => callbacks.onClickThroughChange(checked))
    this._alwaysOnTopToggle = this._createToggle(rightCol, 'Always on Top', state.alwaysOnTop,
      (checked) => callbacks.onAlwaysOnTopChange(checked))

    // ── 하단(전폭): 상태 힌트 → 먹이/놀래키기 → 안내 → 종료 ──
    this._statusHint = document.createElement('div')
    this._statusHint.style.cssText =
      `font-size:11px;line-height:1.4;color:${COLORS.textSecondary};margin:4px 0 12px;display:none;`
    this._panel.appendChild(this._statusHint)
    this._hideToggle.addEventListener('change', () => this._updateStatusHint())
    this._clickThroughToggle.addEventListener('change', () => this._updateStatusHint())

    const lureRow = document.createElement('div')
    lureRow.style.cssText = 'display:flex;gap:8px;margin-bottom:12px;'
    this._feedBtn = document.createElement('button')
    this._feedBtn.className = 'cp__lure-btn'
    this._feedBtn.textContent = '먹이주기'
    this._feedBtn.addEventListener('click', () => callbacks.onLureModeChange('feed'))
    this._scareBtn = document.createElement('button')
    this._scareBtn.className = 'cp__lure-btn'
    this._scareBtn.textContent = '놀래키기'
    this._scareBtn.addEventListener('click', () => callbacks.onLureModeChange('scare'))
    lureRow.append(this._feedBtn, this._scareBtn)
    this._panel.appendChild(lureRow)
    this._lureRow = lureRow

    this._lureHint = document.createElement('div')
    this._lureHint.style.cssText = `font-size:11px;color:${COLORS.point};margin-bottom:12px;display:none;`
    this._panel.appendChild(this._lureHint)

    this._interactionNotice = document.createElement('div')
    this._interactionNotice.style.cssText =
      `font-size:11px;line-height:1.4;color:${COLORS.textSecondary};margin-bottom:12px;display:none;`
    this._interactionNotice.textContent =
      '마우스 투과·수조 숨김 중에는 먹이주기·놀래키기·확대를 사용할 수 없어요.'
    this._panel.appendChild(this._interactionNotice)

    this._quitBtn = document.createElement('button')
    this._quitBtn.className = 'cp__quit-btn'
    this._quitBtn.textContent = '종료'
    this._quitBtn.addEventListener('click', () => this._onQuitClick())
    this._panel.appendChild(this._quitBtn)

    this._root.appendChild(this._panel)
    container.appendChild(this._root)

    // ── 이용 가이드 모달 ──
    this._buildHelpModal(container)

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

    // 초기 상태 힌트(복원된 hidden/clickThrough 반영)
    this._updateStatusHint()
  }

  /** 패널 콘텐츠의 실제 레이아웃 높이(px). 창 높이 동적 산정에 쓴다(닫힘/펼침 무관, scrollHeight). */
  getPanelHeight(): number {
    return this._panel.scrollHeight
  }

  /**
   * 패널 펼침 방향을 설정한다(펼치기 직전 호출).
   * 'down': 버튼 아래로(top-right 고정). 'up': 버튼 위로(바를 창 하단에 두고 위로 펼침).
   * barHeight는 'up'일 때 root를 바 상단-우측에 맞추기 위해 필요.
   */
  setOpenDirection(dir: 'down' | 'up', barHeight: number): void {
    if (dir === 'up') {
      // 바가 창 하단에 위치 → 버튼을 바 상단(=창 하단에서 barHeight-84px)에 두고 패널은 위로.
      this._root.style.top = 'auto'
      this._root.style.bottom = `${Math.max(0, barHeight - 84)}px`
      this._panel.style.top = 'auto'
      this._panel.style.bottom = '48px'
      this._closedTransform = 'translateY(4px)'
    } else {
      this._root.style.top = '40px'
      this._root.style.bottom = 'auto'
      this._panel.style.bottom = 'auto'
      this._panel.style.top = '48px'
      this._closedTransform = 'translateY(-4px)'
    }
    // 닫힘 상태면 새 방향의 closed transform을 즉시 반영(다음 펼침 애니메이션 방향 일치).
    if (!this._expanded) this._panel.style.transform = this._closedTransform
  }

  /** 외부에서 lure 모드 상태를 UI에 반영 */
  setLureMode(mode: LureMode): void {
    this._feedBtn.classList.toggle('cp__lure-btn--active', mode === 'feed')
    this._scareBtn.classList.toggle('cp__lure-btn--active', mode === 'scare')
    if (mode === null) {
      this._lureHint.style.display = 'none'
    } else {
      this._lureHint.textContent =
        mode === 'feed' ? '먹이주기 모드: 화면을 클릭하세요' : '놀래키기 모드: 화면을 클릭하세요'
      this._lureHint.style.display = 'block'
    }
  }

  /** 외부에서 상태를 갱신하면 UI를 동기화 */
  syncState(state: ControlPanelState): void {
    this._fishSlider.value = String(state.fishCount)
    this._fishValue.textContent = String(state.fishCount)
    this._brightnessSlider.value = String(Math.round(state.brightness01 * 100))
    this._brightnessValue.textContent = `${Math.round(state.brightness01 * 100)}%`
    this._sceneTransSlider.value = String(Math.round(state.sceneTransparency01 * 100))
    this._sceneTransValue.textContent = `${Math.round(state.sceneTransparency01 * 100)}%`
    this._hideToggle.checked = state.hidden
    this._clickThroughToggle.checked = state.clickThrough
    this._alwaysOnTopToggle.checked = state.alwaysOnTop
    this._zoomSlider.value = String(zoomToSliderPercent(state.zoom))
    this._zoomValue.textContent = `${zoomToSliderPercent(state.zoom)}%`
    this._updateStatusHint()
  }

  /** 외부(휠)에서 줌이 바뀌면 슬라이더/값 표시를 동기화 */
  setZoom(factor: number): void {
    const pct = zoomToSliderPercent(factor)
    this._zoomSlider.value = String(pct)
    this._zoomValue.textContent = `${pct}%`
  }

  /** 인터랙션 가용성 반영: 비활성 시 확대·먹이·놀래키기를 흐리게/클릭불가 + 안내문 표시. */
  setInteractive(enabled: boolean): void {
    this._zoomRow.classList.toggle('cp__control--disabled', !enabled)
    this._lureRow.classList.toggle('cp__control--disabled', !enabled)
    this._zoomSlider.disabled = !enabled
    this._feedBtn.disabled = !enabled
    this._scareBtn.disabled = !enabled
    this._interactionNotice.style.display = enabled ? 'none' : 'block'
  }

  /** 외부(main)에서 가용 특별 개체 종과 활성 목록을 전달해 칩 UI를 채운다. */
  setFeatureSpecies(species: { id: string; displayName: string }[], enabled: string[]): void {
    this._featureGroupBody.replaceChildren()
    if (species.length === 0) {
      const empty = document.createElement('div')
      empty.style.cssText = `font-size:11px;color:${COLORS.textSecondary};opacity:0.7;`
      empty.textContent = '추가 가능한 특별 개체가 없습니다.'
      this._featureGroupBody.appendChild(empty)
      return
    }
    const enabledSet = new Set(enabled)
    for (const sp of species) {
      const chip = document.createElement('button')
      chip.className = 'cp__feature-chip'
      chip.dataset.speciesId = sp.id
      const on = enabledSet.has(sp.id)
      chip.setAttribute('aria-pressed', String(on))
      chip.classList.toggle('cp__feature-chip--on', on)
      const dot = document.createElement('span')
      dot.className = 'cp__feature-chip-dot'
      const label = document.createElement('span')
      label.textContent = sp.displayName
      chip.append(dot, label)
      chip.addEventListener('click', () => {
        const next = chip.getAttribute('aria-pressed') !== 'true'
        chip.setAttribute('aria-pressed', String(next))
        chip.classList.toggle('cp__feature-chip--on', next)
        this._emitEnabledFeatures()
      })
      this._featureGroupBody.appendChild(chip)
    }
  }

  private _emitEnabledFeatures(): void {
    const ids = Array.from(
      this._featureGroupBody.querySelectorAll<HTMLButtonElement>('.cp__feature-chip[aria-pressed=true]'),
    ).map((c) => c.dataset.speciesId!).filter(Boolean)
    this._callbacks.onEnabledFeaturesChange(ids)
  }

  private _appendSectionLabel(parent: HTMLElement, text: string): void {
    const el = document.createElement('div')
    el.style.cssText = `font-size:11px;font-weight:700;color:${COLORS.textSecondary};letter-spacing:0.04em;margin:2px 0 8px;opacity:0.8;`
    el.textContent = text
    parent.appendChild(el)
  }

  /** 마우스 투과/수조 숨김이 켜졌을 때, 무슨 일이 일어나는지 안내 문구를 표시한다. */
  private _updateStatusHint(): void {
    const msgs: string[] = []
    if (this._hideToggle.checked) msgs.push('수조 숨김 — 우상단 버튼만 표시 중')
    if (this._clickThroughToggle.checked) msgs.push('마우스 투과 — 수조 클릭이 뒤 화면으로 통과')
    this._statusHint.textContent = msgs.join('  ·  ')
    this._statusHint.style.display = msgs.length > 0 ? 'block' : 'none'
  }

  /** 종료 버튼: 한 번 누르면 무장(확인 문구), 3초 내 다시 누르면 실제 종료. 오클릭 방지. */
  private _onQuitClick(): void {
    if (this._quitArmed) {
      if (this._quitTimer !== null) clearTimeout(this._quitTimer)
      this._callbacks.onQuit()
      return
    }
    this._quitArmed = true
    this._quitBtn.textContent = '한 번 더 누르면 종료'
    this._quitBtn.classList.add('cp__quit-btn--armed')
    this._quitTimer = setTimeout(() => {
      this._quitArmed = false
      this._quitBtn.textContent = '종료'
      this._quitBtn.classList.remove('cp__quit-btn--armed')
      this._quitTimer = null
    }, 3000)
  }

  /** 이용 가이드 모달 — 앱 내 DOM 카드(백드롭 클릭/✕로 닫기). 처음 이용자용 안내. */
  private _buildHelpModal(container: HTMLElement): void {
    const backdrop = document.createElement('div')
    backdrop.className = 'cp__help-backdrop'
    this._helpModal = backdrop

    const card = document.createElement('div')
    card.className = 'cp__help-card'
    // 카드 클릭은 백드롭으로 전파되지 않게(닫힘 방지)
    card.addEventListener('click', (e) => e.stopPropagation())

    const titleRow = document.createElement('div')
    titleRow.className = 'cp__help-title-row'
    const title = document.createElement('span')
    title.textContent = '이용 방법'
    title.className = 'cp__help-title'
    const closeBtn = document.createElement('button')
    closeBtn.className = 'cp__help-close'
    closeBtn.textContent = '✕'
    closeBtn.title = '닫기'
    closeBtn.addEventListener('click', () => this._closeHelp())
    titleRow.append(title, closeBtn)
    card.appendChild(titleRow)

    const items: [string, string][] = [
      ['⚙ 플로팅 버튼', '드래그하면 창 이동, 클릭하면 이 패널을 열고 닫습니다.'],
      ['개체수 (작은 물고기)', '함께 헤엄치는 작은 물고기 수를 조절합니다.'],
      ['특별 개체', '고래·만타가오리 등 큰 개체를 켜고 끕니다. 켜면 한 마리씩 천천히 등장합니다.'],
      ['밝기', '수조 조명의 밝기를 조절합니다.'],
      ['배경 투명도', '물고기를 제외한 수조(바닥·수초·돌)의 투명도. 0이면 물고기만 남습니다.'],
      ['수조 숨김', '렌더링을 멈춰 절전합니다. 플로팅 버튼만 남습니다.'],
      ['마우스 투과', '수조 영역의 클릭이 뒤쪽 화면(바탕화면)으로 통과됩니다.'],
      ['Always on Top', '항상 다른 창 위에 표시합니다.'],
      ['먹이주기 / 놀래키기', '버튼을 켠 뒤 화면을 클릭하면 물고기가 반응합니다.'],
      ['크기 조절', '수조의 오른쪽·아래·우하단 모서리를 드래그해 크기를 바꿉니다.'],
      ['종료', '한 번 누르면 확인, 다시 누르면 앱이 종료됩니다.'],
    ]
    const list = document.createElement('div')
    list.className = 'cp__help-list'
    for (const [k, v] of items) {
      const row = document.createElement('div')
      row.className = 'cp__help-item'
      const term = document.createElement('div')
      term.className = 'cp__help-term'
      term.textContent = k
      const desc = document.createElement('div')
      desc.className = 'cp__help-desc'
      desc.textContent = v
      row.append(term, desc)
      list.appendChild(row)
    }
    card.appendChild(list)
    backdrop.appendChild(card)

    // 백드롭 클릭(카드 바깥)으로 닫기
    backdrop.addEventListener('click', () => this._closeHelp())
    // 모달 위 hover는 컨트롤로 간주(click-through 중에도 조작 가능)
    backdrop.addEventListener('mouseenter', () => this._callbacks.onControlsHoverChange(true))
    backdrop.addEventListener('mouseleave', () => this._callbacks.onControlsHoverChange(false))

    container.appendChild(backdrop)
  }

  private _openHelp(): void {
    this._helpModal.style.display = 'flex'
  }

  private _closeHelp(): void {
    this._helpModal.style.display = 'none'
    this._callbacks.onControlsHoverChange(false)
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
      this._panel.style.transform = this._closedTransform
    }
  }

  private _createSlider(
    parent: HTMLElement,
    label: string,
    min: number,
    max: number,
    step: number,
    initial: number,
    unit: '' | '%',
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
    valueEl.textContent = `${initial}${unit}`

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
      valueEl.textContent = `${v}${unit}`
      onChange(v)
    })

    row.appendChild(labelRow)
    row.appendChild(slider)
    parent.appendChild(row)

    return { slider, value: valueEl }
  }

  private _createToggle(
    parent: HTMLElement,
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
    parent.appendChild(row)

    return input
  }

  private _injectStyles(): void {
    if (document.getElementById('cp-styles')) return
    const style = document.createElement('style')
    style.id = 'cp-styles'
    style.textContent = `
      .cp__btn {
        width:44px;height:44px;border-radius:50%;
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

      .cp__control--disabled {
        opacity:0.4;
        pointer-events:none;
        cursor:not-allowed;
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

      .cp__body {
        display:grid;
        grid-template-columns:1fr 1fr;
        column-gap:14px;
      }
      .cp__feature-chips {
        display:flex;flex-direction:column;gap:6px;margin-bottom:12px;
      }
      .cp__feature-chip {
        display:flex;align-items:center;gap:7px;
        padding:6px 9px;border-radius:8px;
        border:1px solid ${COLORS.border};
        background:${COLORS.buttonBg};
        color:${COLORS.textSecondary};
        font-size:12px;font-weight:500;text-align:left;
        cursor:pointer;transition:background 150ms,color 150ms,border-color 150ms;
      }
      .cp__feature-chip:hover { background:rgba(15,23,28,0.76); }
      .cp__feature-chip-dot {
        width:9px;height:9px;border-radius:50%;flex:none;
        border:1.5px solid ${COLORS.textSecondary};
      }
      .cp__feature-chip--on {
        border-color:${COLORS.point};
        background:rgba(63,208,201,0.15);
        color:${COLORS.textPrimary};
      }
      .cp__feature-chip--on .cp__feature-chip-dot {
        background:${COLORS.point};border-color:${COLORS.point};
        box-shadow:0 0 6px rgba(63,208,201,0.5);
      }

      .cp__lure-btn {
        flex:1;
        padding:6px 0;
        border:1px solid ${COLORS.border};
        border-radius:6px;
        background:${COLORS.buttonBg};
        color:${COLORS.textSecondary};
        font-size:12px;font-weight:500;
        cursor:pointer;
        transition:background 150ms,color 150ms,border-color 150ms;
      }
      .cp__lure-btn:hover {
        background:rgba(15,23,28,0.76);
      }
      .cp__lure-btn--active {
        border-color:${COLORS.point};
        background:${COLORS.point};
        color:#06201d;
        font-weight:700;
      }
      .cp__lure-btn--active:hover {
        background:${COLORS.point};
      }

      .cp__quit-btn {
        width:100%;
        margin-top:4px;
        padding:7px 0;
        border:1px solid ${COLORS.danger};
        border-radius:6px;
        background:transparent;
        color:${COLORS.danger};
        font-size:12px;font-weight:600;
        cursor:pointer;
        transition:background 120ms,color 120ms;
      }
      .cp__quit-btn:hover {
        background:rgba(248,113,113,0.12);
      }
      .cp__quit-btn--armed {
        background:${COLORS.dangerFill};
        color:#1a0d0d;
      }

      .cp__help-btn {
        width:20px;height:20px;flex:0 0 auto;
        display:flex;align-items:center;justify-content:center;
        border:1px solid ${COLORS.border};border-radius:50%;
        background:${COLORS.buttonBg};color:${COLORS.textSecondary};
        font-size:12px;font-weight:700;line-height:1;cursor:pointer;
        padding:0;transition:background 120ms,color 120ms;
      }
      .cp__help-btn:hover { background:${COLORS.point};color:#06201d; }

      .cp__help-backdrop {
        display:none;position:fixed;inset:0;z-index:10001;
        align-items:center;justify-content:center;
        background:rgba(6,18,20,0.35);
      }
      .cp__help-card {
        width:300px;max-width:calc(100vw - 32px);max-height:calc(100vh - 32px);
        overflow-y:auto;box-sizing:border-box;
        background:${COLORS.panelBg};border:1px solid ${COLORS.border};
        border-radius:12px;padding:16px 18px;
        box-shadow:0 8px 32px rgba(0,0,0,0.4);
      }
      .cp__help-title-row {
        display:flex;align-items:center;justify-content:space-between;
        margin-bottom:12px;
      }
      .cp__help-title {
        font-size:14px;font-weight:700;color:${COLORS.textPrimary};
      }
      .cp__help-close {
        width:24px;height:24px;border:none;border-radius:6px;
        background:transparent;color:${COLORS.textSecondary};
        font-size:13px;cursor:pointer;line-height:1;padding:0;
      }
      .cp__help-close:hover { background:rgba(255,255,255,0.08);color:${COLORS.textPrimary}; }
      .cp__help-item { margin-bottom:10px; }
      .cp__help-term {
        font-size:12px;font-weight:600;color:${COLORS.textPrimary};margin-bottom:2px;
      }
      .cp__help-desc {
        font-size:11px;line-height:1.45;color:${COLORS.textSecondary};
      }
    `
    document.head.appendChild(style)
  }
}
