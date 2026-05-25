# 설계: 수조 줌(휠+슬라이더) + 인터랙션 가용성 UX

- 날짜: 2026-05-26
- 브랜치: `feat-4-fish-interactions` (예정)
- 관련: `docs/HANDOFF.md`(인터랙션 UX), `CLAUDE.md`(렌더링 함정·TDD·eval 규칙)

## 배경 / 목적

사용자가 물고기를 더 가까이 보고 싶어 한다. **수조 확대(줌)** 기능을 추가하되, 조작은 **마우스 휠**로 직관적으로 한다(슬라이더 보조).

동시에, 마우스 투과(click-through)·수조 숨김 상태에서는 줌·먹이주기·놀래키기 같은 인터랙션이 **구조적으로 동작 불가**하다(Electron이 투과 시 마우스/휠 입력을 무시, 숨김 시 캔버스 미렌더). 현재는 버튼이 멀쩡해 보여 눌러도 반응이 없어 혼란을 준다. 이 상태를 **패널에 명확히 비활성으로 표시**하고 이유를 설명한다.

## 범위

- 줌 기능(휠 + 슬라이더) 신규 구현
- 투과·숨김 시 인터랙션 컨트롤 비활성 UX

비범위: 줌 외 카메라 이동/회전(OrbitControls 등), 투과 중 휠을 가로채는 전역 후킹.

## 핵심 결정

### 1. 줌은 `camera.fov`가 아니라 `camera.zoom`으로 구현한다

리사이즈 로직(`SceneRoot.resizePreservingScale`, `SceneRoot.ts:73`)이 창 크기 변경 시 `camera.fov`를 매번 재계산해 덮어쓴다. FOV로 줌을 구현하면 리사이즈 시 줌이 풀린다. `camera.zoom`은 이와 독립적이고 `updateProjectionMatrix()` 한 번으로 적용되며, **Raycaster(클릭·먹이주기)가 투영행렬을 통해 줌을 자동 반영**하므로 픽킹 보정이 불필요하다.

### 2. 인터랙션 가용성의 단일 진실 원천

`computeInteractive(clickThrough, hidden) = !clickThrough && !hidden`. `FoodLure`/`FishDialogue`의 `_isInteractive`와 정확히 같은 식이라 UI 표시와 실제 동작이 어긋날 수 없다.

### 3. 줌 슬라이더를 둔다

휠이 주 조작이지만, 슬라이더가 있어야 (a) 현재 줌 레벨을 보여주고 (b) **비활성 상태에서 흐리게 표시할 시각 대상**이 생긴다. 휠만 있으면 줌 비활성을 보여줄 컨트롤이 없다.

## 컴포넌트 설계

### config.ts

```ts
export const ZOOM = {
  min: 1.0,
  max: 2.0,
  default: 1.0,
  wheelStep: 0.1, // 휠 한 칸당 줌 증감
} as const
```

### 순수 헬퍼 (TDD — 테스트 먼저)

신규 모듈(예: `src/renderer/core/zoomHelpers.ts` 또는 기존 헬퍼 파일에 추가):

- `zoomFromWheel(current: number, deltaY: number, step: number, min: number, max: number): number`
  - `deltaY < 0`(휠 업) → 확대(줌↑), `deltaY > 0` → 축소(줌↓)
  - 결과를 `[min, max]`로 클램프
- `zoomToSliderPercent(factor) → number` / `sliderPercentToZoom(percent) → number`
  - 100% ↔ 1.0, 200% ↔ 2.0 (선형)
- `computeInteractive(clickThrough: boolean, hidden: boolean): boolean`

### SceneRoot

- `setZoom(factor: number): void` → `this.camera.zoom = factor; this.camera.updateProjectionMatrix()`
- 생성자에서 초기 줌 적용(복원값 또는 default)

### 휠 입력

- 캔버스(`renderer.domElement`)에 `wheel` 리스너 등록
- 핸들러: 인터랙티브 상태일 때만 동작 — `zoomFromWheel`로 새 값 계산 → `SceneRoot.setZoom` + 콜백으로 패널 슬라이더 동기화 + 영속화
- 비활성 상태에서는 핸들러가 아무것도 하지 않음(투과 시엔 애초에 이벤트가 도달하지 않음; 숨김 시엔 가드)
- `preventDefault`는 인터랙티브하게 줌을 처리한 경우에만(뒤 화면 스크롤 간섭 최소화)

### ControlPanel

- 신규 "확대" 슬라이더(100%~200%) — `_createSlider` 재사용, `onZoomChange(factor)` 콜백
- 휠로 줌이 바뀌면 외부에서 슬라이더 값 동기화(`syncState` 또는 전용 `setZoom`)
- `setInteractive(enabled: boolean)` 메서드:
  - 비활성 시 **먹이주기·놀래키기 버튼 + 확대 슬라이더**에 `.cp__control--disabled` 적용
    (opacity↓, `pointer-events:none`, `cursor:not-allowed`)
  - **비활성 컨트롤 바로 아래** 전용 안내 문구 표시(비활성일 때만):
    예) "마우스 투과·수조 숨김 중에는 먹이주기·놀래키기·확대를 사용할 수 없어요."
  - 비활성 진입 시 lure 모드가 armed면 `null`로 해제(매달린 armed 방지)
  - 인터랙티브 복귀 시 전부 원상복구
- 상단 기존 `_statusHint`(투과/숨김 안내)는 현 역할 그대로 유지

### 배선 (main.ts / types.ts / persistence.ts)

- `types.ts`
  - `AppSettings`에 `zoom: number` 추가
  - `ControlPanelCallbacks`에 `onZoomChange(factor: number)` 추가
- `main.ts`
  - 시작·`onClickThroughChange`·`onHiddenChange`에서 `computeInteractive(...)` 계산 → `controlPanel.setInteractive(...)`
  - `onZoomChange` → `sceneRoot.setZoom(...)` + `persistSoon()`
  - 휠 콜백 배선(SceneRoot ↔ ControlPanel 동기화)
- `persistence.ts`
  - `PersistedState`/검증·복원에 `zoom` 포함. 누락·범위 밖이면 default(1.0)
  - 시작 시 `settings.zoom` 복원 → SceneRoot 초기 줌·슬라이더 초기값

## 데이터 흐름

- 휠/슬라이더 → 줌 값 변경 → `SceneRoot.setZoom`(렌더 반영) + 슬라이더/영속화 동기화
- 투과/숨김 토글 → `computeInteractive` → `setInteractive` → 컨트롤 비활성/복구 + 안내문 토글
- Raycaster는 `camera.zoom`을 자동 반영 → 줌 상태에서도 클릭·먹이 좌표 정확

## 엣지 케이스

- 줌은 투과/숨김을 토글해도 값이 유지된다(조작만 불가, 리셋 아님)
- 비활성 진입 시 armed lure 모드 해제
- 휠은 캔버스 hover + 인터랙티브일 때만 줌; 그 외엔 기본 스크롤 동작 보존

## 테스트 / 검증

- 순수 헬퍼 유닛테스트 먼저: `zoomFromWheel`(증감·클램프 경계), 슬라이더↔줌 매핑, `computeInteractive` 진실표
- `npm run test && npm run lint && npm run build`
- **`npm run smoke`**(시각 변경 — 줌이 투명 패스·렌더를 깨뜨리지 않는지)
- **`npm run dev` 라이브 확인**(smoke로 안 잡힘):
  - 투과 OFF → 휠로 확대/축소, 슬라이더 동기화, 물고기 클릭·먹이 좌표 정확
  - 투과 ON 또는 숨김 ON → 먹이·놀래키기·확대 슬라이더 흐려짐 + 안내문 표시 + 휠 무반응

## 검증 한계

휠 줌·비활성 인터랙션·실제 픽킹 정확도는 헤드리스 smoke로 검증되지 않는다 → dev 라이브 QA 필수.
