# Step 9: control-panel

## 읽어야 할 파일

- `/docs/PRD.md` (핵심기능 3·4·6·7·8·12)
- `/docs/UI_GUIDE.md` (플로팅 버튼/패널/슬라이더/토글 스펙, 색상, 안티슬롭)
- `/docs/ARCHITECTURE.md` (`ui/ControlPanel.ts`, `ui/drag.ts`, 데이터 흐름)
- `/CLAUDE.md` (CRITICAL: OS 동작은 window.aqua 통해서만, hidden 시 렌더 정지)
- `src/preload/index.ts` / `src/renderer/global.d.ts` (`window.aqua` API)
- `src/renderer/entities/FishSchool.ts` (`setCount`), `src/renderer/lighting/Lighting.ts` (`setBrightness01`)
- `src/renderer/core/RenderLoop.ts` (`start/stop`), `src/renderer/main.ts`
- `src/shared/config.ts`, `src/shared/types.ts` (AppSettings)

## 작업

사용자 제어 UI를 만들고 전체를 배선한다. 이 step에서 앱이 요구사항대로 동작하게 완성된다.

1. **`src/renderer/ui/ControlPanel.ts`** (plain DOM + CSS, UI_GUIDE 준수)
   - **플로팅 버튼**(40px 원형): 클릭 시 확장 패널 토글(150ms ease-out). 숨김 상태에서도 화면에 남는다.
   - **확장 패널** 내용:
     - **개체수 슬라이더**(`config.FISH.min~max`) → 변경 시 `fishSchool.setCount(v)`, 현재 수치 표시.
     - **밝기 슬라이더**(0~1) → 변경 시 `lighting.setBrightness01(v)`.
     - **Hide/Show 토글** → `window.aqua.toggleVisibility(hidden)`. 숨김 시 수조 콘텐츠를 가리고 렌더 루프 정지(아래 3번), 플로팅 버튼은 유지.
     - **Click-through 토글** → `window.aqua.setClickThrough(enabled)`.
     - (선택) Always-on-top 토글 → `window.aqua.setAlwaysOnTop`.
   - UI_GUIDE 색/스펙 준수. 안티슬롭(네온 글로우, 보라색, gradient orb 등) 금지.

2. **`src/renderer/ui/drag.ts`** — 독립적 드래그(PRD 기능 6)
   - **플로팅 버튼 드래그 → 창 전체 이동**: pointer 이벤트의 이동 델타를 `window.aqua.moveWindowBy(dx, dy)`로 보낸다. (창은 main이 옮김)
   - **패널 드래그 → 패널만 이동**: 패널 DOM의 CSS transform/left-top만 갱신(창은 그대로). 두 드래그가 서로 간섭하지 않게 분리.
   - **순수 헬퍼(테스트 대상)**: `dragDelta(prev:{x,y}, cur:{x,y}): {dx,dy}`, 패널 위치 클램프 `clampPanelPos(pos, viewport, panelSize): pos` 등을 순수 함수로 분리해 테스트.

3. **앱 상태 배선 (`main.ts`)**
   - 단일 `AppSettings` 객체 보유. UI 변경 → settings 갱신 → 해당 엔티티/IPC 반영.
   - **Hidden 시 렌더 정지(CRITICAL)**: `toggleVisibility(true)` 경로에서 `renderLoop.stop()`, 콘텐츠 캔버스 숨김. show 시 `renderLoop.start()`. (성능 — PRD 12)
   - 초기값은 config 기본값으로 패널·엔티티 동기화.

4. **성능 마무리 확인**
   - 숨김 상태에서 rAF가 실제로 멈춰 CPU 점유가 떨어지는지 확인(개발자도구/작업관리자 — 수동).
   - 개체수 슬라이더를 빠르게 올려도 분할 스폰(step 6)으로 큰 프레임 드랍이 없는지 확인.

## Acceptance Criteria

```bash
npm run build
npm run test    # dragDelta, clampPanelPos 등 순수 헬퍼 테스트 통과
npm run lint
```

## 검증 절차

1. AC 실행, 모두 0 확인. (Stop 훅이 lint+build+test를 전부 통과시켜야 함)
2. `npm run dev`로 아래를 **수동 확인**:
   - 플로팅 버튼 클릭 → 패널 확장/접힘.
   - 개체수 슬라이더 → 물고기 실시간 증감(렉 없음).
   - 밝기 슬라이더 → 밤↔낮 조명 전환.
   - Hide 토글 → 수조 사라지고 버튼만 남음, 다시 Show 가능, 숨김 중 CPU 저점유.
   - Click-through 토글 ON → 수조 뒤 바탕화면 아이콘 클릭 가능.
   - 버튼 드래그 → 창 전체 이동 / 패널 드래그 → 패널만 이동.
3. 체크리스트:
   - 모든 OS 동작이 `window.aqua`를 통하는가? (renderer에서 electron 직접 import 없음 — 보안 CRITICAL)
   - hidden 시 `renderLoop.stop()`이 호출되는가? (성능 CRITICAL)
   - UI_GUIDE 안티슬롭을 위반하지 않았는가?
4. `phases/0-mvp/index.json`의 step 9 업데이트:
   - 성공 → `completed` + `summary`에 "ControlPanel/drag API, AppSettings 배선, hidden→stop 연결, 최종 수동 검증 결과" 요약.

## 금지사항

- renderer에서 `require('electron')`/`ipcRenderer`를 직접 쓰지 마라. 이유: contextIsolation·보안 CRITICAL. 반드시 `window.aqua`.
- 버튼 드래그와 패널 드래그를 한 핸들러로 합치지 마라. 이유: PRD 기능 6은 "독립적" 이동을 요구.
- 숨김 시 렌더 루프를 계속 돌리지 마라. 이유: 힐링 위젯 저점유 요구사항(PRD 12) 위반.
- UI_GUIDE 금지 패턴(네온 글로우 애니메이션, 보라색, gradient orb, 과한 글래스 효과)을 쓰지 마라.
- 기존 테스트를 깨뜨리지 마라.
