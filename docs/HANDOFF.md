# 핸드오프 — 인터랙션 UX 수정 (2026-05-25)

다음 세션이 이어서 작업할 수 있도록 현재 상태와 **고쳐야 할 이슈**를 정리한다.
먼저 `CLAUDE.md`(렌더링 함정·eval 규칙)와 `docs/ARCHITECTURE.md`를 읽을 것.

## 현재 상태

- 브랜치: **`feat-4-fish-interactions`** (main 미병합). phase 3 수정 위에 phase 4가 쌓여 있다.
- 검증: `npm run test`(329) · `lint` · `build` · `smoke` 모두 통과. 실제 앱 구동 시 크래시·시각 깨짐·프리즈 없음.
- 완료된 기능: 테두리 옅게 / 비-물고기 투명 슬라이더 / 물고기 클릭 대사 / 먹이·놀래키기 / 어종·수초 레지스트리 / 밝기 네모(라이트샤프트) 제거.
- 주요 커밋: `8bd03fb`(네모 제거+모서리 리사이즈), phase4 step 커밋들(`fe06a79`/`e1d3f8d`/`90f2a82`).

### 실기기 테스트로 확인된 것 (computer-use)
- ✅ 물고기 클릭 → 한국어 말풍선 표시. ✅ 패널 열림(잘림 없음). ✅ 먹이/놀래키기 시 물고기 반응. ✅ 투과·렌더 정상.
- 불안정의 정체는 JS 에러가 아니라 **인터랙션 UX**다(아래 이슈).

## 고쳐야 할 이슈 (우선순위 순)

### 1. (P0) 창 모서리 리사이즈가 사실상 안 됨
- 증상: 핸들이 **보이지 않는 8px 투명 띠**라 잡기가 거의 불가능. 픽셀 단위로 조준해도 리사이즈 실패. 우상단 모서리는 패널과 겹친다.
- 위치: `src/renderer/ui/resizeHandles.ts` — `HANDLE_THICKNESS=8`, `CORNER_SIZE=16`, `makeHandle()`가 배경 없는 투명 div 생성. `src/renderer/main.ts`의 `setupResizeHandles(container, ...)`로 배선(핸들은 `#app` 컨테이너=바 높이의 자식).
- 제안:
  - 우하단에 **보이는 그립**(빗금/삼각형 아이콘, hover 시 강조)을 두고 히트영역을 16~24px로 키운다.
  - 핸들이 패널(우상단, `ControlPanel._root` z-index:9999)에 가리지/겹치지 않도록 위치·z-index 조정. 우하단 코너를 메인 핸들로.
  - **검증은 headless 불가** — `npm run dev` + computer-use로 직접 드래그해 확인해야 한다(아래 테스트 절차).

### 2. (P1) 먹이/놀래키기 활성(armed) 표시가 거의 안 보임
- 증상: 어떤 모드가 켜졌는지 구분 불가. 같은 버튼 재클릭=해제 토글이라 더 헷갈림.
- 위치: `src/renderer/ui/ControlPanel.ts` — `.cp__lure-btn--active`(약 L385)가 **테두리+글자색만** 옅은 청록(`COLORS.point`)으로. `setLureMode()`(L201)가 클래스 토글. 토글 로직은 `src/renderer/entities/FoodLure.ts` `setMode()`.
- 제안: 활성 버튼은 **배경을 청록으로 채움**(글자 어둡게) + 필요시 "○○ 모드: 화면을 클릭하세요" 힌트.

### 3. (P2) 클릭 핸들러 겹침
- 증상: 먹이/놀래키기 모드를 켜도 물고기를 클릭하면 **대사도 같이** 뜬다(한 `pointerdown`에 두 핸들러 발동).
- 위치: `src/renderer/entities/FishDialogue.ts`와 `FoodLure.ts`가 **둘 다** `canvas`의 `pointerdown`을 듣는다. FishDialogue는 lure 모드 여부를 모른다.
- 제안: lure 모드가 armed일 때는 FishDialogue가 무시하도록 공유 술어 전달(예: FishDialogue에 `() => foodLure.mode === null`를 추가 조건으로). 또는 main에서 단일 클릭 디스패처로 합치기.

### 4. (P3) 플로팅 버튼으로 패널이 안 닫히는 경우
- 증상: 버튼 클릭 시 패널 토글이 가끔 안 됨.
- 위치: `ControlPanel._togglePanel()` ← `setupButtonDrag`(`src/renderer/ui/drag.ts`)의 click 콜백. 드래그/클릭 임계값 의심.

## 참고: 남은 알려진 이슈(별도 후속 — 이미 task 칩으로 등록됨)
- 멀티모니터에서 패널 열면/보조모니터에서 창이 주 모니터로 강제 이동. 원인: `src/main/window.ts`의 `setWindowSize`/`setWindowHeight`가 `screen.getPrimaryDisplay()` 기준 클램프 → `getDisplayMatching(win.getBounds())`로 변경 필요.
- 밝기 올리면 옅은 수평선 하나가 움직임(라이트샤프트 제거 후 잔여). 용의자: 수중 베일 DOM 그라디언트 밴딩(`main.ts setWaterVeil`)/IBL. systematic-debugging으로 격리.

## 테스트 절차

```bash
npm run test && npm run lint && npm run build && npm run smoke   # 로직·렌더 깨짐
npm run dev   # 실제 오버레이 구동 (상단 바 + 우상단 플로팅 버튼)
```
- **인터랙션·리사이즈는 smoke로 검증 안 됨** → `npm run dev` 후 computer-use(또는 직접)로:
  - 물고기 클릭 → 말풍선 / 패널 버튼 먹이주기·놀래키기 → 바 클릭 / 모서리 드래그 리사이즈.
- **고밝기/밝은배경 아티팩트 격리 캡처 기법**(네모 디버깅에 썼음):
  - `LIGHT.default01`을 임시 1.0으로, `AQUA_SMOKE_SHOT=./diag.png npm run smoke` 후 PNG를 Read.
  - 밝은 배경에서 보이는 아티팩트는 `src/main/smoke.ts`의 `compositeOverBackground` 배경색을 임시로 밝게(BGR `[235,175,120]`) → 캡처. **조사 후 임시 변경 원복 필수.**

## 주의
- `npm run dev` 인스턴스가 백그라운드로 떠 있을 수 있음 → 새로 시작 전 정리(`pkill -f electron` 등).
- 아키텍처 규칙 준수: OS 창 제어는 main에서만, renderer는 preload IPC만. 매직넘버는 `src/shared/config.ts`. 시각 변경 후 `npm run smoke` 필수(자기보고 불신).
