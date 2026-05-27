# 컨트롤 패널 2열 재구성 + 잘림 근본 수정 설계

- 날짜: 2026-05-28
- 상태: 설계 합의 완료(브레인스토밍)
- 관련: `src/renderer/ui/ControlPanel.ts`, `src/renderer/ui/panelLayout.ts`, `src/renderer/main.ts`, `src/shared/config.ts`

## 1. 배경 / 문제

컨트롤 패널은 펼칠 때 OS 창 높이를 `바높이 + 고정 panelExtra(=400px)`로 키워 잘림을 막는다(`syncWindowSize`→`expandedWindowHeight`). 그런데 `panelExtra`가 **고정 상수**라 패널 실제 콘텐츠 높이와 어긋난다. 특히:

- "특별 개체"를 펼치면 토글 4행이 더해져 패널이 400px를 초과한다.
- 패널이 **위로 펼쳐질 때**('up') 초과분이 창(=화면) 상단 밖으로 나가고, `overflow-y:auto`로도 스크롤이 닿지 않아 상단(헤더·어종·개체수)이 잘린다.

사용자가 창을 크게/세로로 길게 쓰는 상황에서 재현된다(라이브 QA 중 스크린샷으로 확인).

## 2. 목표 / 비목표

**목표**
- 창 크기·펼침 방향과 무관하게 패널이 잘리지 않는다.
- 패널 세로 길이를 줄여 미니멀한 오버레이 성격을 유지한다(2열 재구성).
- 특별 개체 컨트롤이 폭을 적게 차지한다.

**비목표**
- 컨트롤 항목 추가/삭제(기능 변경) 없음 — 배치·표현만 변경.
- 바(수조) 자체 크기/리사이즈 동작 변경 없음.
- 영속(persistence) 스키마 변경 없음.

## 3. 레이아웃 설계 — 섹션별 2열

패널 폭 `220px → ~310px`. 본문을 CSS grid(`grid-template-columns:1fr 1fr`)로 2열 구성.

- **헤더(전폭)**: `Aquagarden` + `?`(이용 가이드). 드래그 핸들 유지.
- **왼쪽 칼럼 "어종"**
  - 개체수 (작은 물고기) 슬라이더 + 값.
  - 특별 개체 4종(만타가오리·고래·돌고래·상어) — **채움 칩 버튼**(아래 3.1). 기존 "특별 개체" 접이식 그룹(`_featureExpanded`)은 **제거**하고 항상 표시.
- **오른쪽 칼럼 "표시 · 조명"**
  - 밝기 슬라이더, 배경 투명도 슬라이더, 확대 슬라이더.
  - 수조 숨김 · 마우스 투과 · Always on Top — **기존 토글 스위치 유지**(모드성 스위치).
- **하단(전폭)**: 상태/안내 힌트(`_statusHint`/`_interactionNotice`/`_lureHint`) → 먹이주기·놀래키기(2열 버튼) → 종료(전폭, 파괴적·2단계 확인 유지).

트레이드오프: 2열이라 각 슬라이더 트랙이 ~135px로 다소 짧다. 폭을 310px로 잡아 최대한 확보하고 수용한다.

유지: 헤더 드래그, 컨트롤 hover 시 click-through 재활성(`onControlsHoverChange`), `setInteractive`의 확대·먹이·놀래키기 비활성 게이트, 줌 슬라이더 동기화.

### 3.1 특별 개체 = 채움 칩 버튼

토글 스위치(폭 30px) 대신 **눌리는 칩 버튼**으로 교체한다.

- 구조: `<button>` 안에 작은 상태 점(dot) + 종 이름.
- OFF: 테두리(`COLORS.border`)만, 글자 흐림. 점은 테두리 원(○).
- ON: 청록 배경(`rgba(teal,.15)`) + 청록 테두리 + 밝은 글자, 점 채움(●). "눌린 버튼" 느낌으로 활성 상태가 한눈에.
- 클릭 = 토글. `aria-pressed`로 상태 노출(접근성).
- 콜백은 기존 `onEnabledFeaturesChange(ids)` 그대로 — DOM 쿼리가 체크박스→버튼으로 바뀌므로 `_emitEnabledFeatures`/`setFeatureSpecies`의 선택자만 갱신(`[data-species-id]` + `aria-pressed`/클래스 기준).

## 4. 잘림 근본 수정 — 동적 높이 맞춤

고정 `panelExtra` 대신 **패널 실제 높이를 측정**해 창을 맞춘다.

- 펼칠 때(`onExpandedChange`/`syncWindowSize`) 패널의 실제 높이를 측정한다: `panel.scrollHeight`(+ 패널 top 오프셋·여백). 측정은 패널을 펼쳐(보이게) 둔 상태에서 수행(레이아웃 확정 후 `requestAnimationFrame` 1프레임).
- 측정값을 **클램프**: 필요한 패널 밴드 높이가 작업영역에서 바를 뺀 가용 높이를 넘으면 가용 높이로 제한.
- 이 클램프된 값을 기존 순수 함수들의 `panelExtra` 인자로 그대로 전달한다(시그니처 유지). 즉 `choosePanelDirection`·`expandedWindowHeight`·`canvasTopOffset`는 변경 없이 **동적 값**을 받는다.
- fallback: 클램프로도 부족한 초소형 화면을 위해 패널의 `max-height:calc(100vh - 96px)` + `overflow-y:auto`는 유지. 2열로 높이가 줄어 실제 스크롤 발생은 드물다.

### 4.1 순수 함수 추가

`panelLayout.ts`에 측정→밴드높이 매핑을 순수 함수로 추가(테스트 대상):

```
requiredPanelExtra(measuredPanelPx: number, availTop: number, availHeight: number,
                   winTop: number, barHeight: number, dir?: PanelDirection): number
```

- 방향에 따라 가용 공간(아래/위)을 계산하고 `min(measured, 가용)`으로 클램프해 반환.
- 측정(DOM read)은 호출부(main)에서 얇게 수행하고, 계산은 이 함수로 위임.

`WINDOW.panelExtra`(상수)는 **측정 실패/초기 fallback 기본값**으로만 남긴다(예: 측정 전 1프레임).

## 5. 영향 범위 / 파일

- `src/renderer/ui/ControlPanel.ts` — 2열 레이아웃, 채움 칩(특별개체), 접이식 그룹 제거, 선택자 갱신. (가장 큰 변경)
- `src/renderer/ui/panelLayout.ts` — `requiredPanelExtra` 추가(순수).
- `src/renderer/main.ts` — `syncWindowSize`/`applyCanvasAnchor`/`onExpandedChange`가 측정 높이를 구해 `requiredPanelExtra`로 클램프한 값을 사용.
- `src/shared/config.ts` — `WINDOW.panelExtra`를 fallback 기본값으로 의미 재정의(주석), 필요 시 패널 폭 상수 추가.
- `src/main/smoke.ts`/`smokeEval.ts` — `AQUA_SMOKE_FEATURES` 훅이 "특별 개체" 펼침에 의존하면, 그룹 제거에 맞춰 칩 버튼을 직접 클릭하도록 갱신.

## 6. 테스트

- **순수(유닛, TDD 선작성)**: `requiredPanelExtra` — 측정값이 가용보다 작으면 그대로, 크면 클램프; up/down 방향별 가용 계산; 경계값. 기존 `panelLayout.test.ts`의 `expandedWindowHeight`/`choosePanelDirection`는 동적 인자로도 정상(테스트 보강).
- **smoke(필수)**: `npm run smoke`로 셰이더/렌더 무결 회귀 없음 확인. 특별개체 칩 렌더(`AQUA_SMOKE_FEATURES`) 검증 갱신.
- **데스크톱 라이브 QA**: 다양한 창 높이 + 위/아래 펼침 + 특별개체 ON 다수에서 **패널 잘림 0**, 칩 토글 동작, 2열 정렬, 슬라이더 조작감 확인. (CLAUDE.md: build/test/lint 통과만으로 표시됨 단정 금지)

## 7. 리스크 / 트레이드오프

- 슬라이더 트랙 단축(~135px): 미세조절 체감 저하 가능 — 폭 310px로 완화, 라이브 QA에서 확인.
- 높이 측정 타이밍: 펼침 애니메이션(150ms) 중 측정하면 값이 작게 나올 수 있음 → 측정은 transition 무시하고 `scrollHeight`(레이아웃 높이) 사용하므로 애니메이션과 무관. 1프레임 지연으로 레이아웃 확정 후 읽기.
- 칩으로 바꾸며 체크박스 기반 접근성/선택자 변경 — `aria-pressed` + `data-species-id`로 대체, 회귀 주의.
