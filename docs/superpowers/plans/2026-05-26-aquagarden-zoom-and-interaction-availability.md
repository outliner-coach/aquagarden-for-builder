# 수조 줌 + 인터랙션 가용성 UX 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 마우스 휠/슬라이더로 수조를 확대(`camera.zoom`)하고, 투과·숨김 상태에서 먹이주기·놀래키기·확대를 패널에서 비활성·안내한다.

**Architecture:** 줌은 `camera.fov`(리사이즈 때 재계산되어 덮어써짐)가 아니라 `camera.zoom`으로 구현해 리사이즈와 무관하게 유지되고 Raycaster가 자동 반영한다. 인터랙션 가용성은 `computeInteractive(clickThrough, hidden) = !clickThrough && !hidden` 순수 함수를 단일 진실 원천으로 삼아 UI 표시·실제 동작·게이트가 어긋나지 않게 한다.

**Tech Stack:** TypeScript, Three.js, Electron, Vitest. 순수 로직은 TDD, 시각 변경은 `npm run smoke` + dev 라이브 QA.

**참고 문서:** `docs/superpowers/specs/2026-05-26-aquagarden-zoom-and-interaction-availability-design.md`, `CLAUDE.md`(렌더링 함정·TDD·eval), `docs/HANDOFF.md`.

---

## 파일 구조

- **신규**
  - `src/renderer/core/zoomHelpers.ts` — 줌 순수 함수(휠→줌, 슬라이더%↔줌배율)
  - `src/renderer/core/__tests__/zoomHelpers.test.ts`
  - `src/renderer/ui/interaction.ts` — `computeInteractive` 순수 함수
  - `src/renderer/ui/__tests__/interaction.test.ts`
- **수정**
  - `src/shared/config.ts` — `ZOOM` 상수
  - `src/shared/types.ts` — `AppSettings.zoom`
  - `src/renderer/core/SceneRoot.ts` — `setZoom()`
  - `src/renderer/persistence.ts` — `zoom` 복원(하위호환: 누락 시 기본값)
  - `src/renderer/persistence`의 테스트는 없음 → 신규 `src/renderer/__tests__/persistence.test.ts`로 zoom 복원 가드
  - `src/renderer/ui/ControlPanel.ts` — 확대 슬라이더 + `setZoom()` + `setInteractive()` + 안내문 + CSS
  - `src/renderer/main.ts` — `onZoomChange` 콜백, 휠 리스너, `applyInteractive()`, 술어 `computeInteractive`로 통일, 초기 줌 적용

---

## Task 1: ZOOM 상수 + AppSettings.zoom 타입

**Files:**
- Modify: `src/shared/config.ts:59-63` (CAMERA 블록 아래)
- Modify: `src/shared/types.ts:1-7`

- [ ] **Step 1: config.ts에 ZOOM 상수 추가**

`src/shared/config.ts`의 `CAMERA` 블록(현재 59-63행) 바로 아래에 추가:

```ts
export const CAMERA = {
  fov: 50,
  near: 0.1,
  far: 100,
} as const

export const ZOOM = {
  min: 1.0,        // 기본(축소 없음)
  max: 2.0,        // 최대 2배 확대
  default: 1.0,
  wheelStep: 0.1,  // 휠 한 칸당 줌 증감
} as const
```

- [ ] **Step 2: types.ts AppSettings에 zoom 추가**

`src/shared/types.ts`의 `AppSettings`(1-7행)에 `zoom` 필드 추가:

```ts
export interface AppSettings {
  fishCount: number
  brightness01: number
  hidden: boolean
  clickThrough: boolean
  sceneTransparency01: number
  zoom: number
}
```

- [ ] **Step 3: 타입 컴파일 확인(아직 사용처는 에러일 수 있음 — 다음 태스크에서 채움)**

Run: `npx tsc --noEmit 2>&1 | head -20`
Expected: `main.ts`/`persistence.ts`에서 `zoom` 누락 관련 에러가 보일 수 있음(후속 태스크에서 해소). config.ts/types.ts 자체 문법 에러는 없어야 함.

- [ ] **Step 4: Commit**

```bash
git add src/shared/config.ts src/shared/types.ts
git commit -m "feat(config): 줌 상수(ZOOM)와 AppSettings.zoom 추가"
```

---

## Task 2: 줌 순수 함수 (TDD)

**Files:**
- Create: `src/renderer/core/zoomHelpers.ts`
- Test: `src/renderer/core/__tests__/zoomHelpers.test.ts`

- [ ] **Step 1: 실패하는 테스트 작성**

Create `src/renderer/core/__tests__/zoomHelpers.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { zoomFromWheel, zoomToSliderPercent, sliderPercentToZoom } from '../zoomHelpers'
import { ZOOM } from '../../../shared/config'

describe('zoomFromWheel', () => {
  it('휠 업(deltaY<0)은 확대 — 줌 증가', () => {
    expect(zoomFromWheel(1.0, -100)).toBeCloseTo(1.0 + ZOOM.wheelStep)
  })

  it('휠 다운(deltaY>0)은 축소 — 줌 감소', () => {
    expect(zoomFromWheel(1.5, 100)).toBeCloseTo(1.5 - ZOOM.wheelStep)
  })

  it('최대 줌을 넘지 않도록 클램프', () => {
    expect(zoomFromWheel(ZOOM.max, -100)).toBe(ZOOM.max)
  })

  it('최소 줌 아래로 내려가지 않도록 클램프', () => {
    expect(zoomFromWheel(ZOOM.min, 100)).toBe(ZOOM.min)
  })

  it('명시적 step/min/max를 존중', () => {
    expect(zoomFromWheel(1.0, -1, 0.5, 1.0, 3.0)).toBeCloseTo(1.5)
  })
})

describe('슬라이더 ↔ 줌 매핑', () => {
  it('1.0배 → 100%', () => {
    expect(zoomToSliderPercent(1.0)).toBe(100)
  })

  it('2.0배 → 200%', () => {
    expect(zoomToSliderPercent(2.0)).toBe(200)
  })

  it('100% → 1.0배, 200% → 2.0배', () => {
    expect(sliderPercentToZoom(100)).toBeCloseTo(1.0)
    expect(sliderPercentToZoom(200)).toBeCloseTo(2.0)
  })

  it('왕복 변환이 일관(반올림 오차 내)', () => {
    expect(sliderPercentToZoom(zoomToSliderPercent(1.5))).toBeCloseTo(1.5)
  })
})
```

- [ ] **Step 2: 테스트 실행 → 실패 확인**

Run: `npm run test -- zoomHelpers`
Expected: FAIL — `Cannot find module '../zoomHelpers'`

- [ ] **Step 3: 최소 구현 작성**

Create `src/renderer/core/zoomHelpers.ts`:

```ts
import { ZOOM } from '../../shared/config'

/**
 * 휠 deltaY로 줌 배율을 증감하고 [min,max]로 클램프한다.
 * deltaY<0(휠 업)=확대(줌↑), deltaY>0(휠 다운)=축소(줌↓).
 */
export function zoomFromWheel(
  current: number,
  deltaY: number,
  step: number = ZOOM.wheelStep,
  min: number = ZOOM.min,
  max: number = ZOOM.max,
): number {
  const dir = deltaY < 0 ? 1 : -1
  const next = current + dir * step
  return Math.max(min, Math.min(max, next))
}

/** 줌 배율(예 1.0~2.0) → 슬라이더 퍼센트(100~200), 정수 반올림. */
export function zoomToSliderPercent(factor: number): number {
  return Math.round(factor * 100)
}

/** 슬라이더 퍼센트(100~200) → 줌 배율(1.0~2.0). */
export function sliderPercentToZoom(percent: number): number {
  return percent / 100
}
```

- [ ] **Step 4: 테스트 실행 → 통과 확인**

Run: `npm run test -- zoomHelpers`
Expected: PASS (10개 통과)

- [ ] **Step 5: Commit**

```bash
git add src/renderer/core/zoomHelpers.ts src/renderer/core/__tests__/zoomHelpers.test.ts
git commit -m "feat(zoom): 휠→줌·슬라이더↔줌 순수 함수 + 테스트"
```

---

## Task 3: computeInteractive 순수 함수 (TDD)

**Files:**
- Create: `src/renderer/ui/interaction.ts`
- Test: `src/renderer/ui/__tests__/interaction.test.ts`

- [ ] **Step 1: 실패하는 테스트 작성**

Create `src/renderer/ui/__tests__/interaction.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { computeInteractive } from '../interaction'

describe('computeInteractive', () => {
  it('투과 OFF + 숨김 OFF → 인터랙션 가능', () => {
    expect(computeInteractive(false, false)).toBe(true)
  })

  it('투과 ON → 불가', () => {
    expect(computeInteractive(true, false)).toBe(false)
  })

  it('숨김 ON → 불가', () => {
    expect(computeInteractive(false, true)).toBe(false)
  })

  it('둘 다 ON → 불가', () => {
    expect(computeInteractive(true, true)).toBe(false)
  })
})
```

- [ ] **Step 2: 테스트 실행 → 실패 확인**

Run: `npm run test -- interaction`
Expected: FAIL — `Cannot find module '../interaction'`

- [ ] **Step 3: 최소 구현 작성**

Create `src/renderer/ui/interaction.ts`:

```ts
/**
 * 수조 인터랙션(먹이주기·놀래키기·휠 확대)이 가능한 상태인지 판정한다.
 * 마우스 투과 ON이면 입력이 뒤 화면으로 통과하고, 수조 숨김 ON이면 캔버스가 없어 모두 불가.
 * FoodLure/FishDialogue의 게이트, 휠 줌 게이트, 패널 비활성 표시가 모두 이 식을 공유한다.
 */
export function computeInteractive(clickThrough: boolean, hidden: boolean): boolean {
  return !clickThrough && !hidden
}
```

- [ ] **Step 4: 테스트 실행 → 통과 확인**

Run: `npm run test -- interaction`
Expected: PASS (4개 통과)

- [ ] **Step 5: Commit**

```bash
git add src/renderer/ui/interaction.ts src/renderer/ui/__tests__/interaction.test.ts
git commit -m "feat(interaction): computeInteractive 순수 함수 + 테스트"
```

---

## Task 4: SceneRoot.setZoom

**Files:**
- Modify: `src/renderer/core/SceneRoot.ts:50-52` (setEnvironmentIntensity 부근에 메서드 추가)

`camera.zoom`은 Three.js PerspectiveCamera의 표준 속성으로, `updateProjectionMatrix()` 호출 시 투영에 반영된다. `resizePreservingScale`은 `fov`만 다시 계산하므로 `zoom`은 보존된다(리사이즈해도 줌 유지). 단위 테스트로 검증하기 어려운 부수효과(WebGL 카메라)라 `npm run smoke`로 렌더 무결성을 확인한다.

- [ ] **Step 1: setZoom 메서드 추가**

`src/renderer/core/SceneRoot.ts`의 `setEnvironmentIntensity`(현재 50-52행) 바로 아래에 추가:

```ts
  setEnvironmentIntensity(v: number): void {
    this.scene.environmentIntensity = v
  }

  /** 카메라 줌 배율 설정(1.0=기본). camera.zoom은 fov 재계산(resize)과 독립이라 리사이즈해도 유지된다. */
  setZoom(factor: number): void {
    this.camera.zoom = factor
    this.camera.updateProjectionMatrix()
  }
```

- [ ] **Step 2: 빌드 확인**

Run: `npx tsc --noEmit 2>&1 | grep SceneRoot || echo "SceneRoot OK"`
Expected: `SceneRoot OK` (이 파일 자체 에러 없음; main.ts는 후속 태스크에서 해소)

- [ ] **Step 3: Commit**

```bash
git add src/renderer/core/SceneRoot.ts
git commit -m "feat(scene): SceneRoot.setZoom(camera.zoom 기반)"
```

---

## Task 5: persistence — zoom 복원 (하위호환) + 테스트

**Files:**
- Modify: `src/renderer/persistence.ts`
- Test: `src/renderer/__tests__/persistence.test.ts` (신규)

**설계 메모:** 기존 사용자의 저장본에는 `zoom`이 없다. 하드 가드(있어야 통과)에 넣으면 기존 상태가 전부 무효화되어 창 위치 등 다른 설정까지 날아간다. 따라서 `zoom`은 **하드 가드에 넣지 않고**, 없거나 범위 밖이면 `ZOOM.default`로 보정한다(`alwaysOnTop`이 leniently 처리되는 것과 동일 패턴).

- [ ] **Step 1: 실패하는 테스트 작성**

Create `src/renderer/__tests__/persistence.test.ts`:

```ts
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { loadPersisted, savePersisted, type PersistedState } from '../persistence'
import { ZOOM } from '../../shared/config'

// jsdom localStorage가 없으면 메모리 목으로 대체
function installLocalStorage(): void {
  const store = new Map<string, string>()
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
    clear: () => store.clear(),
  })
}

const base: PersistedState = {
  settings: {
    fishCount: 20,
    brightness01: 0.6,
    sceneTransparency01: 0.3,
    hidden: false,
    clickThrough: false,
    zoom: 1.5,
  },
  alwaysOnTop: true,
  barWidth: 1200,
  barHeight: 220,
  winX: 0,
  winY: 0,
}

describe('persistence zoom', () => {
  beforeEach(() => installLocalStorage())

  it('저장한 zoom을 그대로 복원', () => {
    savePersisted(base)
    expect(loadPersisted()?.settings.zoom).toBeCloseTo(1.5)
  })

  it('zoom이 없는 (구버전) 저장본도 유효 — zoom은 기본값으로 보정', () => {
    const legacy = { ...base, settings: { ...base.settings } } as Record<string, unknown>
    delete (legacy.settings as Record<string, unknown>).zoom
    localStorage.setItem('aquagarden.state.v1', JSON.stringify(legacy))
    const loaded = loadPersisted()
    expect(loaded).not.toBeNull()
    expect(loaded?.settings.zoom).toBe(ZOOM.default)
    expect(loaded?.settings.fishCount).toBe(20) // 나머지 설정은 보존
  })

  it('범위 밖 zoom은 [min,max]로 클램프', () => {
    savePersisted({ ...base, settings: { ...base.settings, zoom: 99 } })
    expect(loadPersisted()?.settings.zoom).toBe(ZOOM.max)
  })
})
```

- [ ] **Step 2: 테스트 실행 → 실패 확인**

Run: `npm run test -- persistence`
Expected: FAIL — 구버전 저장본 테스트에서 `zoom`이 `undefined`거나 클램프 미적용

- [ ] **Step 3: persistence.ts 수정**

상단 import에 `ZOOM` 추가:

```ts
import type { AppSettings } from '../shared/types'
import { ZOOM } from '../shared/config'
```

`loadPersisted`의 `return { settings: { ... } }` 블록(현재 43-50행)에서 settings에 `zoom`을 추가(하드 가드 29-40행은 **그대로** 둔다):

```ts
    return {
      settings: {
        fishCount: s.fishCount,
        brightness01: s.brightness01,
        sceneTransparency01: s.sceneTransparency01,
        hidden: s.hidden,
        clickThrough: s.clickThrough,
        zoom: isFiniteNumber(s.zoom)
          ? Math.max(ZOOM.min, Math.min(ZOOM.max, s.zoom))
          : ZOOM.default,
      },
      alwaysOnTop: typeof p.alwaysOnTop === 'boolean' ? p.alwaysOnTop : true,
      barWidth: p.barWidth,
      barHeight: p.barHeight,
      winX: p.winX,
      winY: p.winY,
    }
```

- [ ] **Step 4: 테스트 실행 → 통과 확인**

Run: `npm run test -- persistence`
Expected: PASS (3개 통과)

- [ ] **Step 5: Commit**

```bash
git add src/renderer/persistence.ts src/renderer/__tests__/persistence.test.ts
git commit -m "feat(persistence): zoom 복원(하위호환·클램프) + 테스트"
```

---

## Task 6: ControlPanel — 확대 슬라이더 + 비활성 UX

**Files:**
- Modify: `src/renderer/ui/ControlPanel.ts`

**배치 결정:** 인터랙션 의존 컨트롤 3개(**확대 슬라이더, 먹이주기, 놀래키기**)를 한 그룹으로 묶고, 그 **바로 아래** 단일 안내문을 둔다. 따라서 확대 슬라이더는 토글들 아래·`_statusHint` 다음·먹이/놀래키기 버튼 행 **바로 위**에 배치한다.

- [ ] **Step 1: import + 필드 추가**

`src/renderer/ui/ControlPanel.ts` 상단 import(1-3행)에 추가:

```ts
import { FISH, COLORS } from '../../shared/config'
import { setupButtonDrag, setupPanelDrag } from './drag'
import type { LureMode } from '../entities/FoodLure'
import { ZOOM } from '../../shared/config'
import { zoomToSliderPercent, sliderPercentToZoom } from '../core/zoomHelpers'
```

`ControlPanelCallbacks`(6-22행)에 콜백 추가:

```ts
  /** 확대(줌) 배율 변경. */
  onZoomChange: (factor: number) => void
```

`ControlPanelState`(25-32행)에 zoom 추가:

```ts
export interface ControlPanelState {
  fishCount: number
  brightness01: number
  sceneTransparency01: number
  hidden: boolean
  clickThrough: boolean
  alwaysOnTop: boolean
  zoom: number
}
```

필드 선언부(46-64행 영역, `_sceneTransValue` 아래쯤)에 추가:

```ts
  private readonly _zoomSlider: HTMLInputElement
  private readonly _zoomValue: HTMLSpanElement
  private _zoomRow!: HTMLElement
  private _lureRow!: HTMLDivElement
  private _interactionNotice!: HTMLDivElement
```

- [ ] **Step 2: 확대 슬라이더 생성 (statusHint 다음, lureRow 앞)**

`_statusHint`를 패널에 append하고 리스너를 거는 블록(현재 180-186행) **다음**, 먹이/놀래키기 버튼 블록(188행~) **앞**에 삽입:

```ts
    // ── 확대(줌) 슬라이더 ── (휠이 주 조작, 슬라이더는 레벨 표시 + 비활성 표시 대상)
    const { slider: zoomSlider, value: zoomValue } = this._createSlider(
      '확대',
      Math.round(ZOOM.min * 100),
      Math.round(ZOOM.max * 100),
      1,
      zoomToSliderPercent(state.zoom),
      (v) => callbacks.onZoomChange(sliderPercentToZoom(v)),
    )
    this._zoomSlider = zoomSlider
    this._zoomValue = zoomValue
    this._zoomRow = zoomSlider.parentElement as HTMLElement
```

- [ ] **Step 3: lureRow 참조 저장**

먹이/놀래키기 버튼 블록(현재 189행 `const lureRow = ...`)을 멤버에 저장하도록 수정. `const lureRow` 선언을 그대로 두되, 마지막에 참조 저장:

현재:
```ts
    lureRow.appendChild(this._feedBtn)
    lureRow.appendChild(this._scareBtn)
    this._panel.appendChild(lureRow)
```
변경:
```ts
    lureRow.appendChild(this._feedBtn)
    lureRow.appendChild(this._scareBtn)
    this._panel.appendChild(lureRow)
    this._lureRow = lureRow
```

- [ ] **Step 4: 인터랙션 안내문 요소 추가 (lureHint 다음)**

`_lureHint`를 패널에 append하는 블록(현재 207-209행) **다음**에 삽입:

```ts
    // 인터랙션 비활성 안내 — 위 그룹(확대·먹이·놀래키기) 바로 아래. 비활성일 때만 표시.
    this._interactionNotice = document.createElement('div')
    this._interactionNotice.style.cssText =
      `font-size:11px;line-height:1.4;color:${COLORS.textSecondary};margin-bottom:12px;display:none;`
    this._interactionNotice.textContent =
      '마우스 투과·수조 숨김 중에는 먹이주기·놀래키기·확대를 사용할 수 없어요.'
    this._panel.appendChild(this._interactionNotice)
```

- [ ] **Step 5: isPercent에 '확대' 추가**

`_createSlider`의 `isPercent` 계산(현재 437행)을 수정해 확대도 % 표기:

현재:
```ts
    const isPercent = label === '밝기' || label === '배경 투명도'
```
변경:
```ts
    const isPercent = label === '밝기' || label === '배경 투명도' || label === '확대'
```

- [ ] **Step 6: setZoom + setInteractive 메서드 추가**

`syncState`(현재 290-301행) 메서드 **다음**에 추가:

```ts
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
```

- [ ] **Step 7: syncState에 zoom 반영**

`syncState`(290-301행)에 zoom 슬라이더 동기화 한 줄 추가(`_alwaysOnTopToggle` 줄 다음, `_updateStatusHint()` 앞):

```ts
    this._alwaysOnTopToggle.checked = state.alwaysOnTop
    this._zoomSlider.value = String(zoomToSliderPercent(state.zoom))
    this._zoomValue.textContent = `${zoomToSliderPercent(state.zoom)}%`
    this._updateStatusHint()
```

- [ ] **Step 8: 비활성 CSS 추가**

`_injectStyles`의 `style.textContent` 템플릿(현재 505행~) 안, `.cp__slider` 규칙들 부근에 추가:

```ts
      .cp__control--disabled {
        opacity:0.4;
        pointer-events:none;
        cursor:not-allowed;
      }
```

- [ ] **Step 9: 빌드 + 기존 테스트 회귀 확인**

Run: `npx tsc --noEmit 2>&1 | grep ControlPanel || echo "ControlPanel OK"`
Expected: `ControlPanel OK` (main.ts는 Task 7에서 콜백/state 채움)

Run: `npm run test`
Expected: 기존 테스트 전부 PASS(회귀 없음)

- [ ] **Step 10: Commit**

```bash
git add src/renderer/ui/ControlPanel.ts
git commit -m "feat(panel): 확대 슬라이더 + 투과/숨김 시 인터랙션 비활성 표시·안내"
```

---

## Task 7: main.ts 배선

**Files:**
- Modify: `src/renderer/main.ts`

- [ ] **Step 1: import 추가**

`src/renderer/main.ts`의 import 블록(13-19행 부근)에 추가:

```ts
import { computeMouseIgnore } from './ui/passthrough'
import { computeInteractive } from './ui/interaction'
import { zoomFromWheel } from './core/zoomHelpers'
```

그리고 config import(16행)에 `ZOOM` 추가:

```ts
import { FISH, LIGHT, WATER, WINDOW, SCENE, CAMERA, ZOOM } from '../shared/config'
```

- [ ] **Step 2: settings 기본값에 zoom 추가**

`const settings: AppSettings = persisted?.settings ?? { ... }`(78-84행)에 zoom 추가:

```ts
const settings: AppSettings = persisted?.settings ?? {
  fishCount: FISH.default,
  brightness01: LIGHT.default01,
  hidden: false,
  clickThrough: false,
  sceneTransparency01: SCENE.defaultTransparency01,
  zoom: ZOOM.default,
}
```

- [ ] **Step 3: 초기 줌 적용**

`let currentAlwaysOnTop = ...`(85행) **다음 줄**에 추가(설정·sceneRoot 모두 존재하는 시점):

```ts
let currentAlwaysOnTop = persisted?.alwaysOnTop ?? true
sceneRoot.setZoom(settings.zoom)
```

- [ ] **Step 4: FoodLure/FishDialogue 술어를 computeInteractive로 통일**

FoodLure 생성(현재 203행):
```ts
  () => !settings.clickThrough && !settings.hidden,
```
→
```ts
  () => computeInteractive(settings.clickThrough, settings.hidden),
```

FishDialogue 생성(현재 318행):
```ts
  () => !settings.clickThrough && !settings.hidden && foodLure.mode === null,
```
→
```ts
  () => computeInteractive(settings.clickThrough, settings.hidden) && foodLure.mode === null,
```

- [ ] **Step 5: ControlPanel 초기 state에 zoom + onZoomChange 콜백 추가**

ControlPanel 생성 시 state 객체(209-216행)에 zoom 추가:

```ts
  {
    fishCount: settings.fishCount,
    brightness01: settings.brightness01,
    sceneTransparency01: settings.sceneTransparency01,
    hidden: settings.hidden,
    clickThrough: settings.clickThrough,
    alwaysOnTop: currentAlwaysOnTop,
    zoom: settings.zoom,
  },
```

콜백 객체에서 `onSceneTransparencyChange` 콜백(230-238행) 다음에 `onZoomChange` 추가:

```ts
    onZoomChange(factor: number) {
      settings.zoom = factor
      sceneRoot.setZoom(factor)
      persistSoon()
    },
```

- [ ] **Step 6: applyInteractive() 정의 + 토글 콜백에서 호출**

`onHiddenChange`/`onClickThroughChange`가 정의된 콜백 객체보다 `controlPanel`·`foodLure`가 먼저 생성되므로, **controlPanel 생성 블록 다음**(현재 303행 이후, `foodLure.onModeChange = ...` 부근)에 헬퍼를 정의:

```ts
// 인터랙션 가용성(투과/숨김)에 따라 패널 컨트롤 비활성·안내 + armed lure 해제.
function applyInteractive(): void {
  const interactive = computeInteractive(settings.clickThrough, settings.hidden)
  controlPanel.setInteractive(interactive)
  if (!interactive) foodLure.setMode(null)
}
```

`onHiddenChange`의 `persistSoon()` 호출 직전(256행 부근)에 `applyInteractive()` 추가:

```ts
      applyMouseIgnore()
      applyInteractive()
      persistSoon()
```

`onClickThroughChange`(258-262행)도 동일하게:

```ts
    onClickThroughChange(enabled: boolean) {
      settings.clickThrough = enabled
      applyMouseIgnore()
      applyInteractive()
      persistSoon()
    },
```

- [ ] **Step 7: 휠 줌 리스너 등록**

`foodLure.onModeChange = ...` 및 `applyInteractive` 정의 다음(controlPanel/sceneRoot/canvas 모두 존재)에 추가:

```ts
// ── 마우스 휠 줌 ──
// 인터랙티브(투과 OFF·숨김 OFF)일 때만 캔버스 휠로 확대/축소. 그 외엔 기본 스크롤 보존.
canvas?.addEventListener(
  'wheel',
  (e: WheelEvent) => {
    if (!computeInteractive(settings.clickThrough, settings.hidden)) return
    const next = zoomFromWheel(settings.zoom, e.deltaY)
    if (next === settings.zoom) {
      e.preventDefault()
      return
    }
    e.preventDefault()
    settings.zoom = next
    sceneRoot.setZoom(next)
    controlPanel.setZoom(next)
    persistSoon()
  },
  { passive: false },
)
```

- [ ] **Step 8: 시작 시 초기 인터랙션 상태 반영**

파일 맨 끝(현재 356-375행의 `if (persisted) { ... }` 블록) **다음**에 추가(persisted 유무와 무관하게 항상):

```ts
// 시작 시 패널 비활성 상태를 현재 설정에 맞춰 반영(예: 투과/숨김이 복원된 경우).
applyInteractive()
```

- [ ] **Step 9: 컴파일 + 전체 테스트**

Run: `npx tsc --noEmit`
Expected: 에러 없음

Run: `npm run test && npm run lint && npm run build`
Expected: 전부 PASS

- [ ] **Step 10: Commit**

```bash
git add src/renderer/main.ts
git commit -m "feat(main): 휠/슬라이더 줌 배선 + 투과·숨김 시 인터랙션 비활성 + 술어 통일"
```

---

## Task 8: 렌더 검증 + 라이브 QA

**Files:** (코드 변경 없음 — 검증)

- [ ] **Step 1: smoke (렌더 무결성 — 자기보고 불신 규칙)**

Run: `npm run smoke`
Expected: `pass=true`. 줌 기본값 1.0이라 렌더가 기존과 동일해야 하고 콘솔 에러·헬스 이상 없음.

- [ ] **Step 2: dev 라이브 QA (smoke로 안 잡히는 인터랙션)**

먼저 기존 dev 인스턴스 정리: `pkill -f electron` (있으면)
Run: `npm run dev`

확인 항목:
- 투과 **OFF**: 캔버스 위에서 마우스 휠 → 수조 확대/축소되고 패널 "확대" 슬라이더 값이 따라 움직인다. 확대 상태에서 물고기 클릭·먹이주기 좌표가 정확하다(Raycaster 줌 반영).
- 슬라이더로 확대 → 휠과 동일하게 동작, 영속화(재시작 후 유지).
- 투과 **ON**(또는 수조 숨김 ON): 먹이주기·놀래키기 버튼과 확대 슬라이더가 흐려지고(클릭 불가), 그 아래 "…사용할 수 없어요" 안내문이 표시된다. 휠을 돌려도 수조가 확대되지 않는다(투과 시 뒤 화면 스크롤).
- 투과 다시 OFF → 컨트롤 복구·안내문 사라짐. armed 상태였던 먹이/놀래키기 모드는 해제되어 있다.
- 리사이즈(우하단 그립 드래그) 후에도 줌 배율이 유지된다.

- [ ] **Step 3: 검증 결과를 HANDOFF에 반영 (선택)**

라이브 QA를 통과하면 `docs/HANDOFF.md`에 이 기능의 상태를 한 단락 추가하고 커밋한다(다음 세션 인계용). 미검증 항목이 있으면 명시한다.

```bash
git add docs/HANDOFF.md
git commit -m "docs: 줌·인터랙션 가용성 UX 구현 상태 핸드오프 갱신"
```

---

## 자기 검토 메모 (계획 작성자)

- **스펙 커버리지:** camera.zoom 방식(Task 4), 휠+슬라이더(Task 2/6/7), computeInteractive 단일 진실 원천(Task 3, Task 7서 술어 통일), 비활성 흐리게+클릭불가+안내문(Task 6), 안내문을 컨트롤 바로 아래(Task 6 배치), armed 해제(Task 7 applyInteractive), 영속화·하위호환(Task 5), 테스트/스모크/라이브(Task 8) — 모두 태스크로 매핑됨.
- **타입 일관성:** `onZoomChange(factor)`, `ControlPanelState.zoom`, `AppSettings.zoom`, `setZoom(factor)`, `setInteractive(enabled)` 전 태스크 동일 시그니처.
- **하위호환:** zoom은 하드 가드에 넣지 않음(Task 5) — 기존 저장본 무효화 방지.
