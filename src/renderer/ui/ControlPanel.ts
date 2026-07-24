import { FISH, COLORS, ZOOM, TOKEN } from '../../shared/config'
import { setupButtonDrag, setupPanelDrag } from './drag'
import type { LureMode } from '../entities/FoodLure'
import { THEME_REGISTRY } from '../entities/themeRegistry'
import { zoomToSliderPercent, sliderPercentToZoom } from '../core/zoomHelpers'
import { computeThemeSegmentState } from './themeSegment'
import { usageLevel, gaugeColor, formatReset, formatAgo } from '../../shared/tokenHelpers'
import type { TokenUsage, TokenUsageWindow } from '../../shared/types'
import './controlPanel.css'

/** 토큰 게이지 링 하나(5시간 또는 주간)의 DOM 참조. */
interface TokenRingRefs {
  ring: HTMLDivElement
  pct: HTMLSpanElement
  reset: HTMLDivElement
}

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
  /** 시간대 반응(무드) 조명 토글 변경. */
  onMoodReactiveChange: (enabled: boolean) => void
  /** 배경 테마 변경(THEME_REGISTRY id). */
  onThemeChange: (id: string) => void
  /** 앱 종료 요청(파괴적). main이 app.quit 수행. */
  onQuit: () => void
  /** 토큰 사용량 섹션 표시/숨김 토글 변경. 하위호환: main이 아직 안 넘겨줘도 생성자가 동작. */
  onShowTokenUsageChange?: (show: boolean) => void
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
  moodReactive: boolean
  /** 토큰 사용량(도넛 게이지) 섹션 표시 여부. 하위호환: 없으면 표시(true)로 간주. */
  showTokenUsage?: boolean
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
  private readonly _hideToggle: HTMLInputElement
  private readonly _clickThroughToggle: HTMLInputElement
  private readonly _alwaysOnTopToggle: HTMLInputElement
  private readonly _moodToggle: HTMLInputElement
  private readonly _feedBtn: HTMLButtonElement
  private readonly _scareBtn: HTMLButtonElement
  /**
   * 단일 고정 높이 힌트 슬롯. lure 모드/투과/숨김 안내가 여기 하나로 모인다.
   * 힌트가 나타나고 사라질 때 패널 높이가 변해 토글들이 위아래로 밀리며 오클릭을
   * 유발하던 문제(위로 펼침에선 전체가 위로 밀림 — 라이브 QA 재현)를 높이 고정으로 제거.
   */
  private _hintSlot!: HTMLDivElement
  private _lureMode: LureMode = null
  private _quitBtn!: HTMLButtonElement
  private _quitArmed = false
  private _quitTimer: ReturnType<typeof setTimeout> | null = null
  /** 패널 닫힘 상태의 transform — 펼침 방향(up/down)에 따라 슬라이드 방향이 바뀐다. */
  private _closedTransform = 'translateY(-4px)'
  private _helpModal!: HTMLDivElement
  private readonly _featureGroupBody: HTMLDivElement
  /** 배경 테마 세그먼트 버튼(id→엘리먼트). setTheme이 선택 상태 갱신 시 조회한다. */
  private readonly _themeButtons = new Map<string, HTMLButtonElement>()
  /** 토큰 섹션: 표시 토글, 링 2종(5시간/주간) DOM 참조. */
  private readonly _tokenToggle: HTMLInputElement
  private readonly _tokenRingsRow: HTMLDivElement
  private readonly _fiveHourRing: TokenRingRefs
  private readonly _weeklyRing: TokenRingRefs
  /** 마지막 성공값(stale) 표시 시 "N분 전 기준" 노트. fresh면 숨김. */
  private readonly _tokenStaleNote: HTMLDivElement

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
    this._moodToggle = this._createToggle(rightCol, '시간대 반응', state.moodReactive,
      (checked) => callbacks.onMoodReactiveChange(checked))

    // ── 배경 테마 세그먼트(THEME_REGISTRY 기반 — id/displayName 하드코딩 금지. 테마 추가 시 자동 반영) ──
    this._appendSectionLabel(rightCol, '배경 테마')
    const themeRow = document.createElement('div')
    themeRow.className = 'cp__theme-segment'
    for (const theme of THEME_REGISTRY) {
      const btn = document.createElement('button')
      btn.className = 'cp__theme-btn'
      btn.textContent = theme.displayName
      btn.setAttribute('aria-pressed', 'false')
      btn.setAttribute('aria-label', `배경 테마: ${theme.displayName}`)
      btn.addEventListener('click', () => {
        this.setTheme(theme.id)
        callbacks.onThemeChange(theme.id)
      })
      themeRow.appendChild(btn)
      this._themeButtons.set(theme.id, btn)
    }
    rightCol.appendChild(themeRow)

    // ── 토큰(전폭): 계정 사용량 도넛 게이지 2종(5시간/주간) ──
    const initialShowToken = state.showTokenUsage ?? true
    this._appendSectionLabel(this._panel, '토큰')
    this._tokenToggle = this._createToggle(
      this._panel, '토큰 사용량 표시', initialShowToken,
      (checked) => {
        this._setTokenRingsVisible(checked)
        callbacks.onShowTokenUsageChange?.(checked)
      },
    )
    const tokenRingsRow = document.createElement('div')
    tokenRingsRow.className = 'cp__token-rings'
    this._fiveHourRing = this._createTokenRing(tokenRingsRow, '5시간')
    this._weeklyRing = this._createTokenRing(tokenRingsRow, '주간')
    this._panel.appendChild(tokenRingsRow)
    this._tokenRingsRow = tokenRingsRow
    // 마지막 성공값 표시 시 "N분 전 기준" 노트(fresh면 숨김). 링 바로 아래(전폭).
    const staleNote = document.createElement('div')
    staleNote.className = 'cp__token-stale-note'
    staleNote.style.display = 'none'
    this._panel.appendChild(staleNote)
    this._tokenStaleNote = staleNote
    this._setTokenRingsVisible(initialShowToken)
    // 최초 데이터 도착 전(main이 아직 updateTokenUsage를 안 불렀을 때) 회색 placeholder로 시작.
    this.updateTokenUsage(null)

    // ── 하단(전폭): 먹이/놀래키기 → 고정 힌트 슬롯 → 종료 ──
    this._hideToggle.addEventListener('change', () => this._updateHintSlot())
    this._clickThroughToggle.addEventListener('change', () => this._updateHintSlot())

    const lureRow = document.createElement('div')
    lureRow.style.cssText = 'display:flex;gap:8px;margin-bottom:10px;'
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

    // 고정 높이(2줄) 힌트 슬롯 — 내용이 없어도 공간을 유지해 레이아웃 시프트를 막는다.
    this._hintSlot = document.createElement('div')
    this._hintSlot.style.cssText =
      `font-size:11px;line-height:1.45;height:32px;overflow:hidden;` +
      `color:${COLORS.textSecondary};margin-bottom:10px;`
    this._panel.appendChild(this._hintSlot)

    this._quitBtn = document.createElement('button')
    this._quitBtn.className = 'cp__quit-btn'
    this._quitBtn.textContent = '종료'
    this._quitBtn.addEventListener('click', () => this._onQuitClick())
    this._panel.appendChild(this._quitBtn)

    this._root.appendChild(this._panel)
    container.appendChild(this._root)

    // ── 이용 가이드 모달 ──
    this._buildHelpModal(container)

    // ── 테마 변수 주입(패널 CSS는 controlPanel.css) ──
    this._applyThemeVars()

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
    this._updateHintSlot()
  }

  /** 패널 펼침 여부 (main이 투과 일시 해제 판단에 사용). */
  get expanded(): boolean {
    return this._expanded
  }

  /** 패널이 펼쳐져 있으면 접는다 — 버튼 드래그(창 이동) 시작 시 호출해 펼친 채 이동으로
   *  생기는 기하 문제(위 열림 패널이 메뉴바에 잘림 등)를 원천 차단한다. */
  collapse(): void {
    if (this._expanded) this._togglePanel()
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
    this._lureMode = mode
    this._feedBtn.classList.toggle('cp__lure-btn--active', mode === 'feed')
    this._scareBtn.classList.toggle('cp__lure-btn--active', mode === 'scare')
    this._updateHintSlot()
  }

  /**
   * 외부에서 배경 테마 선택 상태를 UI에 반영한다. 초기 선택 상태 주입(재시작 복원)과
   * 이후 동기화에 겸용 — 클릭 핸들러도 콜백 호출 전에 이 메서드로 자기 상태를 갱신한다.
   */
  setTheme(id: string): void {
    const states = computeThemeSegmentState(THEME_REGISTRY, id)
    for (const s of states) {
      const btn = this._themeButtons.get(s.id)
      if (!btn) continue
      btn.setAttribute('aria-pressed', String(s.active))
      btn.classList.toggle('cp__theme-btn--active', s.active)
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
    this._moodToggle.checked = state.moodReactive
    this._zoomSlider.value = String(zoomToSliderPercent(state.zoom))
    this._zoomValue.textContent = `${zoomToSliderPercent(state.zoom)}%`
    if (state.showTokenUsage !== undefined) {
      this._tokenToggle.checked = state.showTokenUsage
      this._setTokenRingsVisible(state.showTokenUsage)
    }
    this._updateHintSlot()
  }

  /** 외부(휠)에서 줌이 바뀌면 슬라이더/값 표시를 동기화 */
  setZoom(factor: number): void {
    const pct = zoomToSliderPercent(factor)
    this._zoomSlider.value = String(pct)
    this._zoomValue.textContent = `${pct}%`
  }

  /** 인터랙션 가용성 반영: 비활성 시 확대·먹이·놀래키기를 흐리게/클릭불가 + 힌트 안내. */
  setInteractive(enabled: boolean): void {
    this._zoomRow.classList.toggle('cp__control--disabled', !enabled)
    this._lureRow.classList.toggle('cp__control--disabled', !enabled)
    this._zoomSlider.disabled = !enabled
    this._feedBtn.disabled = !enabled
    this._scareBtn.disabled = !enabled
    this._updateHintSlot()
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

  /**
   * 외부(main)에서 토큰 사용량 스냅샷을 전달하면 두 게이지(5시간/주간)를 다시 그린다.
   * null이거나 state==='unavailable'이면 두 링 모두 회색 '연결 안 됨' placeholder로 표시한다
   * (섹션 자체는 숨기지 않음 — 토글 on/off는 별개의 관심사).
   *
   * staleAgeSec가 주어지면(마지막 성공값을 라이브 실패 상태에서 보여주는 경우) 링을 실제 %/색으로
   * 그리되 흐리게(dim) 표시하고 "N분 전 기준" 노트를 붙인다. 생략(fresh)이면 원복 + 노트 없음.
   * 하위호환: 두 번째 인자는 옵셔널 — 기존 호출부(updateTokenUsage(usage))는 그대로 fresh로 동작한다.
   */
  updateTokenUsage(usage: TokenUsage | null, staleAgeSec?: number): void {
    // now는 렌더 시점 기준(라이브 UI) — 순수 헬퍼(formatReset)엔 그대로 주입만 한다.
    const now = Date.now() / 1000
    if (usage === null || usage.state === 'unavailable') {
      this._renderRing(this._fiveHourRing, null, now, 'relative')
      this._renderRing(this._weeklyRing, null, now, 'absolute')
      this._applyTokenStale(undefined) // 진짜 연결 안 됨 — dim/노트 없음
      return
    }
    this._renderRing(this._fiveHourRing, usage.fiveHour ?? null, now, 'relative')
    this._renderRing(this._weeklyRing, usage.weekly ?? null, now, 'absolute')
    this._applyTokenStale(staleAgeSec)
  }

  /**
   * stale 표시 상태를 반영한다. ageSec가 있으면 링 행을 흐리게(dim) + "N분 전 기준" 노트,
   * 없으면(fresh) 원복 + 노트 숨김. 링 자체는 실제 %/밴드 색 그대로다(정보는 유지, 신뢰도만 낮춤).
   */
  private _applyTokenStale(ageSec: number | undefined): void {
    const stale = ageSec !== undefined
    this._tokenRingsRow.classList.toggle('cp__token-rings--stale', stale)
    if (stale) {
      this._tokenStaleNote.textContent = `${formatAgo(ageSec)} 기준`
      this._tokenStaleNote.style.display = 'block'
    } else {
      this._tokenStaleNote.textContent = ''
      this._tokenStaleNote.style.display = 'none'
    }
  }

  private _emitEnabledFeatures(): void {
    const ids = Array.from(
      this._featureGroupBody.querySelectorAll<HTMLButtonElement>('.cp__feature-chip[aria-pressed=true]'),
    ).map((c) => c.dataset.speciesId!).filter(Boolean)
    this._callbacks.onEnabledFeaturesChange(ids)
  }

  /** 토큰 게이지 링 행의 표시/숨김(섹션 표시 토글용). 숨기면 stale 노트도 함께 숨긴다. */
  private _setTokenRingsVisible(visible: boolean): void {
    this._tokenRingsRow.style.display = visible ? 'flex' : 'none'
    if (!visible) this._tokenStaleNote.style.display = 'none'
  }

  private _appendSectionLabel(parent: HTMLElement, text: string): void {
    const el = document.createElement('div')
    el.style.cssText = `font-size:11px;font-weight:700;color:${COLORS.textSecondary};letter-spacing:0.04em;margin:2px 0 8px;opacity:0.8;`
    el.textContent = text
    parent.appendChild(el)
  }

  /**
   * 고정 힌트 슬롯 갱신. 우선순위: lure armed > 투과/숨김 상태 안내 > (빈칸 유지).
   * 슬롯 높이는 고정이므로 어떤 상태 전환에도 다른 컨트롤이 밀리지 않는다.
   */
  private _updateHintSlot(): void {
    const hidden = this._hideToggle.checked
    const through = this._clickThroughToggle.checked
    let text = ''
    let color: string = COLORS.textSecondary
    if (this._lureMode !== null) {
      text =
        this._lureMode === 'feed' ? '먹이주기 모드: 화면을 클릭하세요' : '놀래키기 모드: 화면을 클릭하세요'
      color = COLORS.point
    } else if (hidden && through) {
      text = '수조 숨김·마우스 투과 중 — 먹이주기·놀래키기·확대 사용 불가'
    } else if (hidden) {
      text = '수조 숨김 중 — 렌더 정지(절전), 먹이주기·놀래키기·확대 불가'
    } else if (through) {
      text = '마우스 투과 중 — 수조 클릭이 뒤로 통과(패널 열린 동안 일시 해제)'
    }
    this._hintSlot.textContent = text
    this._hintSlot.style.color = color
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

    const isMac = navigator.userAgent.includes('Mac')
    const items: [string, string][] = [
      ['⚙ 플로팅 버튼', '드래그하면 창 이동, 클릭하면 이 패널을 열고 닫습니다.'],
      ['개체수', '함께 헤엄치는 작은 물고기 수를 조절합니다.'],
      ['특별 개체', '고래·만타가오리 등 큰 개체를 켜고 끕니다. 켜면 한 마리씩 천천히 등장합니다.'],
      ['물고기 대사', '물고기를 클릭하면 어종별로 한마디씩 말을 건넵니다.'],
      ['밝기', '수조 조명의 밝기를 조절합니다.'],
      ['투명도', '물고기를 제외한 수조(바닥·수초·돌)의 투명도. 0이면 물고기만 남습니다.'],
      ['확대', '수조 위에서 마우스 휠을 굴리거나 슬라이더로 1~2배 확대해 감상합니다.'],
      ['카메라 각도', '수조를 드래그하면 카메라가 좌우·위로 돌아 다른 각도에서 감상할 수 있습니다. 더블클릭하면 정면으로 부드럽게 복귀합니다.'],
      ['시간대 반응', '시각에 따라 조명 무드가 은은히 변합니다 — 심야는 어둑한 청색, 저녁은 골든 앰버.'],
      ['배경 테마', '수조 배경을 미니멀·다시마 숲·산호초 중에서 선택합니다.'],
      ['수조 숨김', '렌더링을 멈춰 절전합니다. 플로팅 버튼만 남습니다.'],
      ['마우스 투과', '수조 영역의 클릭이 뒤쪽 화면(바탕화면)으로 통과됩니다. 이 패널이 열려 있는 동안은 일시 해제됩니다.'],
      ['Always on Top', '항상 다른 창 위에 표시합니다.'],
      ['먹이주기 / 놀래키기', '버튼을 켠 뒤 화면을 클릭하면 물고기가 반응합니다. 20초간 사용이 없으면 자동 해제됩니다.'],
      ['크기 조절', '수조의 오른쪽·아래·우하단 모서리를 드래그해 크기를 바꿉니다.'],
      ['창 복구 단축키', `${isMac ? '⌥⌘A' : 'Ctrl+Alt+A'} — 창이 안 보이거나 버튼을 잃었을 때 화면 상단으로 되돌립니다.`],
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
    // 시각 라벨 span은 체크박스와 프로그램적으로 연결돼 있지 않으므로 접근성 이름을 직접 부여한다.
    input.setAttribute('aria-label', label)
    // display:none이면 키보드 포커스가 불가하다. 시각적으로만 숨기고(스크린리더/Tab 유지)
    // 포커스 가능하게 둬 라벨의 .cp__toggle-track에 :focus-visible 링이 뜨도록 한다.
    input.style.cssText = 'position:absolute;width:1px;height:1px;opacity:0;margin:0;pointer-events:none;'

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

  /** 토큰 게이지 링 하나(라벨 + 도넛 링 + 중앙 % + 리셋 텍스트)를 만들어 parent에 붙인다. */
  private _createTokenRing(parent: HTMLElement, label: string): TokenRingRefs {
    const col = document.createElement('div')
    col.className = 'cp__token-ring-col'

    const labelEl = document.createElement('div')
    labelEl.className = 'cp__token-ring-label'
    labelEl.textContent = label
    col.appendChild(labelEl)

    const ring = document.createElement('div')
    ring.className = 'cp__token-ring'

    const inner = document.createElement('div')
    inner.className = 'cp__token-ring-inner'

    const pct = document.createElement('span')
    pct.className = 'cp__token-ring-pct'
    inner.appendChild(pct)
    ring.appendChild(inner)
    col.appendChild(ring)

    const reset = document.createElement('div')
    reset.className = 'cp__token-ring-reset'
    col.appendChild(reset)

    parent.appendChild(col)
    return { ring, pct, reset }
  }

  /**
   * 링 하나를 데이터로 다시 그린다. win이 null이면(미가용) 회색 '연결 안 됨' placeholder,
   * 아니면 usageLevel(pct)→gaugeColor로 그 창 자신의 밴드 색을 링 채움(conic-gradient)에 쓰고
   * formatReset(mode)로 리셋 텍스트를 채운다.
   */
  private _renderRing(
    refs: TokenRingRefs,
    win: TokenUsageWindow | null,
    now: number,
    mode: 'relative' | 'absolute',
  ): void {
    if (win === null) {
      refs.ring.style.background = COLORS.textDisabled
      refs.pct.textContent = '—'
      refs.pct.style.color = COLORS.textDisabled
      refs.reset.textContent = '연결 안 됨'
      refs.reset.style.color = COLORS.textDisabled
      refs.ring.setAttribute('aria-label', '토큰 사용량 연결 안 됨')
      return
    }
    const pct01 = Math.min(1, Math.max(0, win.pct))
    const pctInt = Math.round(pct01 * 100)
    const level = usageLevel(win.pct, TOKEN.warnPct, TOKEN.criticalPct)
    const color = gaugeColor(level)
    refs.ring.style.background = `conic-gradient(${color} ${pctInt}%, ${COLORS.sliderTrackEmpty} 0)`
    refs.pct.textContent = `${pctInt}%`
    refs.pct.style.color = COLORS.textPrimary
    refs.reset.textContent = formatReset(win.resetsAt, now, mode)
    refs.reset.style.color = COLORS.textSecondary
    refs.ring.setAttribute('aria-label', `사용량 ${pctInt}%`)
  }

  /**
   * 패널 CSS는 controlPanel.css(Vite 번들)에 있고, 색상은 CSS 변수(--cp-*)로 참조한다.
   * 여기선 그 변수를 shared/config의 COLORS에서 :root에 주입해 COLORS를 단일 진실 원천으로 유지한다.
   * (help 모달/백드롭은 .cp 밖 body에 붙으므로 :root=documentElement에 설정해 전역 캐스케이드.)
   */
  private _applyThemeVars(): void {
    const r = document.documentElement.style
    r.setProperty('--cp-point', COLORS.point)
    r.setProperty('--cp-panel-bg', COLORS.panelBg)
    r.setProperty('--cp-button-bg', COLORS.buttonBg)
    r.setProperty('--cp-button-bg-hover', COLORS.buttonBgHover)
    r.setProperty('--cp-border', COLORS.border)
    r.setProperty('--cp-text-primary', COLORS.textPrimary)
    r.setProperty('--cp-text-secondary', COLORS.textSecondary)
    r.setProperty('--cp-toggle-off', COLORS.toggleOff)
    r.setProperty('--cp-slider-track-empty', COLORS.sliderTrackEmpty)
    r.setProperty('--cp-danger', COLORS.danger)
    r.setProperty('--cp-danger-fill', COLORS.dangerFill)
  }
}
