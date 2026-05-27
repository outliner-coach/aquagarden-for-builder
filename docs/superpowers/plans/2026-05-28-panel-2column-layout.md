# 컨트롤 패널 2열 재구성 + 잘림 근본 수정 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 컨트롤 패널을 섹션별 2열로 재구성하고 특별 개체를 채움 칩으로 바꾸며, 고정 `panelExtra` 대신 패널 실제 높이를 측정해 창을 맞춰 잘림을 없앤다.

**Architecture:** 잘림 수정은 순수 함수 `requiredPanelExtra`(측정 높이를 가용 공간으로 클램프) + main의 측정 배선으로 처리. 레이아웃은 `ControlPanel`의 DOM 빌더가 좌/우 칼럼 부모를 받아 2열 grid에 배치하고, 특별 개체는 체크박스 토글 대신 `aria-pressed` 칩 버튼으로 교체. UI(시각)는 smoke + 라이브 QA로 검증.

**Tech Stack:** TypeScript(strict), Three.js 렌더러, plain DOM/CSS 패널, Vitest, Electron(main 창 제어), `npm run smoke`(headless eval).

설계: `docs/superpowers/specs/2026-05-28-panel-2column-layout-design.md`

---

## File Structure

- `src/renderer/ui/panelLayout.ts` — 순수 레이아웃 계산. `requiredPanelExtra` 추가.
- `src/renderer/ui/__tests__/panelLayout.test.ts` — `requiredPanelExtra` 테스트 추가.
- `src/renderer/main.ts` — 동적 패널 높이 측정·클램프 배선(`currentPanelExtra`), `syncWindowSize`/`applyCanvasAnchor`/`onExpandedChange`/resize에서 사용.
- `src/renderer/ui/ControlPanel.ts` — 2열 grid 재구성, 빌더가 부모를 받음, 특별 개체 칩, `getPanelHeight()`, CSS.
- `src/main/smoke.ts` — `AQUA_SMOKE_FEATURES` 훅을 칩 클릭으로 갱신.

---

### Task 1: `requiredPanelExtra` 순수 함수 (잘림 수정 핵심)

**Files:**
- Modify: `src/renderer/ui/panelLayout.ts`
- Test: `src/renderer/ui/__tests__/panelLayout.test.ts`

- [ ] **Step 1: 실패하는 테스트 작성**

`src/renderer/ui/__tests__/panelLayout.test.ts` 파일 상단 import에 `requiredPanelExtra`를 추가하고(기존: `import { choosePanelDirection, expandedWindowHeight, canvasTopOffset, shouldAnchorBottom } from '../panelLayout'`), 파일 끝에 아래 describe를 추가한다:

```ts
describe('requiredPanelExtra', () => {
  // winTop=100, barHeight=120, availTop=0, availHeight=1000
  // spaceBelow = 0+1000-(100+120) = 780, spaceAbove = 100-0 = 100
  const base = { availTop: 0, availHeight: 1000, winTop: 100, barHeight: 120 }

  it('down: 원하는 높이가 아래 공간보다 작으면 그대로 반환', () => {
    expect(requiredPanelExtra(400, base.availTop, base.availHeight, base.winTop, base.barHeight, 'down')).toBe(400)
  })

  it('down: 원하는 높이가 아래 공간을 넘으면 아래 공간으로 클램프', () => {
    expect(requiredPanelExtra(900, base.availTop, base.availHeight, base.winTop, base.barHeight, 'down')).toBe(780)
  })

  it('up: 위 공간으로 클램프', () => {
    expect(requiredPanelExtra(400, base.availTop, base.availHeight, base.winTop, base.barHeight, 'up')).toBe(100)
  })

  it('공간이 음수면 0으로 바닥 처리', () => {
    // 바가 작업영역 아래로 빠진 경우(winTop+barHeight > avail 하단)
    expect(requiredPanelExtra(400, 0, 200, 300, 120, 'down')).toBe(0)
  })
})
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npx vitest run src/renderer/ui/__tests__/panelLayout.test.ts`
Expected: FAIL — `requiredPanelExtra is not a function` (또는 import 에러).

- [ ] **Step 3: 최소 구현 작성**

`src/renderer/ui/panelLayout.ts` 파일 끝에 추가:

```ts
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
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npx vitest run src/renderer/ui/__tests__/panelLayout.test.ts`
Expected: PASS (신규 4개 포함 전부 통과).

- [ ] **Step 5: 커밋**

```bash
git add src/renderer/ui/panelLayout.ts src/renderer/ui/__tests__/panelLayout.test.ts
git commit -m "feat(panel): requiredPanelExtra — 측정 높이를 가용 공간으로 클램프"
```

---

### Task 2: ControlPanel에 `getPanelHeight()` + main 동적 높이 배선

**Files:**
- Modify: `src/renderer/ui/ControlPanel.ts` (메서드 1개 추가)
- Modify: `src/renderer/main.ts:191-215`(applyCanvasAnchor/syncWindowSize), `:305-323`(onExpandedChange), `:400-402`(resize)

- [ ] **Step 1: ControlPanel에 높이 측정 메서드 추가**

`src/renderer/ui/ControlPanel.ts`의 `setOpenDirection(...)` 메서드 바로 위에 추가:

```ts
  /** 패널 콘텐츠의 실제 레이아웃 높이(px). 창 높이 동적 산정에 쓴다(닫힘/펼침 무관, scrollHeight). */
  getPanelHeight(): number {
    return this._panel.scrollHeight
  }
```

- [ ] **Step 2: main에 동적 panelExtra 상태 추가 + 측정 헬퍼**

`src/renderer/main.ts`에서 `let currentPanelDir: PanelDirection = 'down'`(현재 188행) 바로 아래에 추가:

```ts
// 펼침 시 측정된 패널 밴드 높이(가용 공간으로 클램프됨). 측정 전/실패 시 fallback=WINDOW.panelExtra.
let currentPanelExtra = WINDOW.panelExtra
```

import 줄(현재 18행)에 `requiredPanelExtra`를 추가한다:

```ts
import { choosePanelDirection, expandedWindowHeight, canvasTopOffset, shouldAnchorBottom, requiredPanelExtra, type PanelDirection } from './ui/panelLayout'
```

- [ ] **Step 3: applyCanvasAnchor / syncWindowSize가 동적 값 사용**

`src/renderer/main.ts`의 `applyCanvasAnchor`(191-198행)와 `syncWindowSize`(209-215행)에서 `WINDOW.panelExtra`를 `currentPanelExtra`로 교체한다:

```ts
function applyCanvasAnchor(): void {
  const winH = panelExpanded
    ? expandedWindowHeight(currentBarHeight, currentPanelExtra)
    : currentBarHeight
  const top = canvasTopOffset(currentPanelDir, winH, currentBarHeight)
  container.style.top = `${top}px`
  waterVeil.style.top = `${top}px`
}
```

```ts
function syncWindowSize(anchorBottom: boolean): void {
  const winH = panelExpanded
    ? expandedWindowHeight(currentBarHeight, currentPanelExtra)
    : currentBarHeight
  window.aqua.setWindowSize(currentBarWidth, winH, anchorBottom)
  applyCanvasAnchor()
}
```

- [ ] **Step 4: onExpandedChange가 패널 높이를 측정·클램프**

`src/renderer/main.ts`의 `onExpandedChange`(305-323행) 본문을 아래로 교체한다:

```ts
    onExpandedChange(expanded: boolean) {
      // 패널이 열리면 창을 패널 전체가 담길 만큼 키운다(작은 바에서도 안 잘림). 닫으면 바 높이로 복귀.
      panelExpanded = expanded
      if (expanded) {
        // 펼치기 직전 패널 실제 높이를 측정해 방향 결정 + 가용 공간으로 클램프.
        // availTop은 비표준이라 옵셔널 캐스트(없으면 0). 멀티모니터 작업영역 상단 오프셋 반영.
        const scr = window.screen as Screen & { availTop?: number }
        const availTop = scr.availTop ?? 0
        const desired = controlPanel.getPanelHeight() + WINDOW.panelGap
        currentPanelDir = choosePanelDirection({
          winTop: window.screenY,
          barHeight: currentBarHeight,
          panelExtra: desired,
          availTop,
          availHeight: scr.availHeight,
        })
        currentPanelExtra = requiredPanelExtra(
          desired, availTop, scr.availHeight, window.screenY, currentBarHeight, currentPanelDir,
        )
        controlPanel.setOpenDirection(currentPanelDir, currentBarHeight)
      }
      // 펼침/접힘에서만 'up'이면 하단 앵커(바를 제자리에 유지).
      syncWindowSize(shouldAnchorBottom('toggle', panelExpanded, currentPanelDir))
    },
```

- [ ] **Step 5: config에 panelGap 추가, panelExtra 의미 주석 갱신**

`src/shared/config.ts`의 `WINDOW` 객체에서 `panelExtra` 항목 주석을 바꾸고 `panelGap`을 추가한다. 현재:

```ts
  // 패널 펼침 시 바 위/아래에 추가하는 여백(px). 확장 창 높이 = 바 높이 + panelExtra.
  panelExtra: 400,
```

를 아래로 교체:

```ts
  // 패널 펼침 시 추가 높이의 fallback(측정 실패/초기 1프레임용). 평소엔 패널 실제 높이를 측정해 대체.
  panelExtra: 400,
  // 측정한 패널 높이에 더하는 여백(px) — 패널 상단 오프셋(top:48)+하단 숨쉬기.
  panelGap: 60,
```

- [ ] **Step 6: resize 경로 확인(코드 변경 없음)**

`onResize`(394-406행)는 이미 `syncWindowSize(...)`를 호출하므로 `currentPanelExtra`를 자동 사용한다. 단 펼쳐진 채 리사이즈하면 패널 높이는 그대로이므로 별도 재측정 불필요. 변경 없음(확인만).

- [ ] **Step 7: 빌드/테스트/스모크로 회귀 없음 확인**

Run: `npm run build && npm run test && npm run smoke`
Expected: build OK, test 전부 PASS, smoke `pass=true`(콘솔 에러 0, 헬스 정상, 픽셀 정상). 아직 레이아웃은 1열이지만 잘림 로직만 바뀐 상태로 회귀가 없어야 한다.

- [ ] **Step 8: 커밋**

```bash
git add src/renderer/ui/ControlPanel.ts src/renderer/main.ts src/shared/config.ts
git commit -m "feat(panel): 펼침 시 패널 실제 높이 측정해 창 높이 동적 산정(잘림 방지)"
```

---

### Task 3: 빌더가 부모를 받도록 변경 + `unit` 파라미터

DOM 빌더(`_createSlider`/`_createToggle`/`_appendSectionLabel`)가 항상 `this._panel`에 append하던 것을, 인자로 받은 부모에 append하도록 바꾼다. 2열 배치의 토대. 슬라이더 단위는 라벨 문자열 매칭 대신 `unit` 인자로 분리(좁은 칼럼에서 라벨을 줄여도 안전).

**Files:**
- Modify: `src/renderer/ui/ControlPanel.ts`(빌더 3개 + 호출부)

- [ ] **Step 1: `_appendSectionLabel`이 부모를 받도록 변경**

`src/renderer/ui/ControlPanel.ts`의 `_appendSectionLabel`(418-423행)을 교체:

```ts
  private _appendSectionLabel(parent: HTMLElement, text: string): void {
    const el = document.createElement('div')
    el.style.cssText = `font-size:11px;font-weight:700;color:${COLORS.textSecondary};letter-spacing:0.04em;margin:2px 0 8px;opacity:0.8;`
    el.textContent = text
    parent.appendChild(el)
  }
```

- [ ] **Step 2: `_createSlider`가 부모+unit을 받도록 변경**

`_createSlider`(545-591행)의 시그니처와 본문을 교체:

```ts
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
```

- [ ] **Step 3: `_createToggle`이 부모를 받도록 변경**

`_createToggle`(593-628행)의 시그니처와 마지막 append를 교체(본문 동일, `this._panel.appendChild(row)` → `parent.appendChild(row)`):

```ts
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
```

- [ ] **Step 4: 빌드 확인(호출부는 Task 4에서 갱신하므로 일시적 컴파일 에러 예상)**

이 단계 단독 빌드는 실패가 정상(호출부 인자 불일치). Task 4와 한 커밋으로 묶으므로 여기서는 커밋하지 않는다. 다음 Task로 진행.

---

### Task 4: 2열 grid 재구성 + 특별 개체 채움 칩

**Files:**
- Modify: `src/renderer/ui/ControlPanel.ts`(constructor 본문 137-273행, `setFeatureSpecies`/`_emitEnabledFeatures`, 필드/CSS), 불필요해진 `_toggleFeatureGroup`/`_featureExpanded`/`_featureGroupHeader` 제거.

- [ ] **Step 1: constructor 본문(어종~종료) 2열로 재구성**

`src/renderer/ui/ControlPanel.ts`의 `this._panel.appendChild(header)`(135행) **다음**부터 `this._panel.appendChild(this._quitBtn)`(273행) **까지**를 아래로 교체한다:

```ts
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
```

- [ ] **Step 2: 사용하지 않는 접이식 필드/메서드 제거**

`src/renderer/ui/ControlPanel.ts`에서 아래를 삭제한다:
- 필드 선언 `private _featureGroupHeader!: HTMLDivElement`(76행)와 `private _featureExpanded = false`(78행). (`_featureGroupBody`는 칩 컨테이너로 계속 사용하므로 유지.)
- 메서드 `_toggleFeatureGroup`(425-429행) 전체.

- [ ] **Step 3: `setFeatureSpecies`를 칩 버튼 생성으로 교체**

`setFeatureSpecies`(379-409행)를 아래로 교체:

```ts
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
```

- [ ] **Step 4: `_emitEnabledFeatures`를 칩 기준 선택자로 교체**

`_emitEnabledFeatures`(411-416행)를 아래로 교체:

```ts
  private _emitEnabledFeatures(): void {
    const ids = Array.from(
      this._featureGroupBody.querySelectorAll<HTMLButtonElement>('.cp__feature-chip[aria-pressed=true]'),
    ).map((c) => c.dataset.speciesId!).filter(Boolean)
    this._callbacks.onEnabledFeaturesChange(ids)
  }
```

- [ ] **Step 5: CSS — grid 본문 + 패널 폭 + 칩 + feature-header 제거**

`_injectStyles`의 `style.textContent` 템플릿에서 `.cp__feature-header`/`:hover` 블록(688-692행)을 삭제하고, 같은 템플릿 안에 아래 규칙을 추가한다(예: `.cp__slider` 블록 앞):

```css
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
```

그리고 패널 폭을 넓힌다: constructor의 `this._panel.style.cssText`(103-111행)에서 `width:220px;`를 `width:310px;`로 바꾼다.

- [ ] **Step 6: 빌드 + 타입체크 통과 확인**

Run: `npm run build`
Expected: TypeScript 컴파일 OK(미사용 심볼 에러 없음 — `_featureExpanded`/`_toggleFeatureGroup`/`_featureGroupHeader` 모두 제거됨), renderer 번들 성공.

- [ ] **Step 7: 커밋(Task 3+4 묶음)**

```bash
git add src/renderer/ui/ControlPanel.ts
git commit -m "feat(panel): 섹션별 2열 레이아웃 + 특별 개체 채움 칩"
```

---

### Task 5: smoke 훅을 칩 클릭으로 갱신

**Files:**
- Modify: `src/main/smoke.ts:82`

- [ ] **Step 1: `AQUA_SMOKE_FEATURES` 셀렉터를 칩으로 교체**

`src/main/smoke.ts`의 executeJavaScript 문자열(81-85행)에서 체크박스 구동을 칩 클릭으로 바꾼다:

```ts
        `(() => {
          const chips = document.querySelectorAll('.cp__feature-chip');
          chips.forEach((c) => { if (c.getAttribute('aria-pressed') !== 'true') { c.click(); } });
          return chips.length;
        })()`,
```

주석(76-77행)의 "토글 체크박스를 구동" 표현도 "칩을 클릭"으로 갱신한다.

- [ ] **Step 2: 특별 개체 렌더 스모크 통과 확인**

Run: `AQUA_SMOKE_FEATURES=1 npm run smoke`
Expected: `pass=true` — 칩 클릭으로 onEnabledFeaturesChange→스폰 경로가 타고, 콘솔 에러 0·헬스 정상·픽셀 정상.

- [ ] **Step 3: 커밋**

```bash
git add src/main/smoke.ts
git commit -m "test(smoke): 특별 개체 검증 훅을 칩 클릭으로 갱신"
```

---

### Task 6: 전체 검증 (smoke + 데스크톱 라이브 QA)

**Files:** 없음(검증 전용). 시각 변경이므로 `build/test/lint` 통과만으로 "표시됨" 단정 금지(CLAUDE.md).

- [ ] **Step 1: 전체 게이트**

Run: `npm run test && npm run lint && npm run build && npm run smoke`
Expected: 전부 통과, smoke `pass=true`.

- [ ] **Step 2: 데스크톱 라이브 QA (computer-use)**

`npm run dev` 후 패널을 열어 확인:
- 2열 배치(왼쪽 어종/개체수/특별개체 칩, 오른쪽 표시·조명) 정렬·가독성.
- 특별 개체 칩 클릭 → ON(청록 채움)/OFF 토글, 해당 개체 스폰/디스폰.
- 슬라이더(개체수·밝기·투명도·확대) 조작감(트랙 ~135px) 수용 가능 여부.
- **창을 세로로 길게/짧게 리사이즈** + 위/아래 펼침 양쪽에서 **패널 잘림 0**(헤더·어종·종료까지 전부 보임). 작은 화면에선 스크롤 fallback 동작.
- 투과/숨김 ON 중 어종(칩·개체수) 조작, 확대·먹이·놀래키기 비활성 + 안내문(회귀 없음).

- [ ] **Step 3: HANDOFF 갱신**

`docs/HANDOFF.md`에 "패널 2열 재구성 + 잘림 근본 수정 완료" 항목과 라이브 QA 결과를 기록한다(기존 형식 따라).

- [ ] **Step 4: 커밋**

```bash
git add docs/HANDOFF.md
git commit -m "docs: HANDOFF에 패널 2열 재구성 + 잘림 수정 라이브 QA 기록"
```

---

## Self-Review 결과

- **Spec coverage**: 2열 섹션 레이아웃(Task 3·4), 특별 개체 채움 칩(Task 4), 접이식 제거(Task 4), 잘림 근본 수정=측정+클램프(Task 1·2), 표시·조명 토글 유지(Task 4), smoke 훅 갱신(Task 5), 테스트/라이브 QA(Task 6) — 스펙 전 항목 매핑됨.
- **Placeholder scan**: 모든 코드 단계에 실제 코드/명령/기대출력 포함. 빈 항목 없음.
- **Type consistency**: `requiredPanelExtra` 시그니처(Task1)와 호출(Task2-Step4) 일치. `_createSlider`/`_createToggle`/`_appendSectionLabel` 새 시그니처(Task3)와 호출부(Task4-Step1) 일치. `_featureGroupBody` 필드는 칩 컨테이너로 일관 사용. 칩 셀렉터 `.cp__feature-chip[aria-pressed=true]`가 생성부와 emit/smoke에서 동일.
- **알려진 수용 트레이드오프**: 슬라이더 트랙 단축(폭 310px로 완화), Task6에서 체감 확인.
