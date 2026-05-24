# Step 3: window-size-slider

## 읽어야 할 파일

- `/CLAUDE.md` (CRITICAL: OS 윈도우 제어는 **main에서만**, renderer는 IPC로만 요청 / 매직넘버 금지)
- `/docs/ARCHITECTURE.md` (데이터 흐름: renderer UI → preload → ipcRenderer → ipcMain → window.ts. 창 크기 IPC 메모)
- `src/shared/ipc-channels.ts` (`IPC` 채널 상수), `src/shared/types.ts` (`AquaBridge`, payload 타입, `AppSettings`)
- `src/preload/index.ts` (`contextBridge` 화이트리스트 — 기존 `setWindowHeight` 패턴)
- `src/main/ipc.ts` (핸들러 등록), `src/main/window.ts` (`computeBarBounds`, `setWindowHeight` 패턴, `screen.workAreaSize`)
- `src/main/__tests__/window.test.ts` (순수 함수 테스트 패턴)
- `src/renderer/main.ts` (`container.style.height`=WINDOW.height 고정, `onExpandedChange`→`setWindowHeight`)
- `src/renderer/core/SceneRoot.ts` (`resize()` — parent clientWidth/height 기반)
- `src/renderer/ui/ControlPanel.ts`, `src/shared/config.ts` (`WINDOW`)

## 작업

제어 패널에 **크기 슬라이더**를 추가해 오버레이 바의 크기를 실시간으로 줄이거나 늘린다. (OS 창 bounds 변경은 반드시 main에서.)

**★ 핵심 거동 2가지(사용자 명시):**
- **(a) 중앙 정렬** — 오브제들이 화면 중앙에 모여 있으므로, 창 크기를 줄이면 창은 **work area 가로 중앙**에 정렬한다(top은 상단 고정 바 그대로). 좌측 고정 X.
- **(b) 내용 비축소(크롭)** — 오브제가 충분히 작으므로, 창이 줄어도 **화면에 구현된 부분(물고기/씬)의 픽셀 크기는 그대로 유지**되어야 한다. 즉 창 축소 = "줌아웃(내용 축소)"이 아니라 **중앙 기준 크롭**(보이는 영역만 좁아짐). world↔pixel 배율을 일정하게 유지한다.

1. **순수 함수**(`src/main/window.ts`에 export, TDD: `window.test.ts`에 케이스 추가):
   - `barSizeForScale(t: number, workArea: {width:number}, limits): { width: number; height: number }` — `t`∈[0,1]을 width·height로 선형 매핑 후 클램프. 예 limits: 최소 width=`WINDOW.minWidth`, 최대=`workArea.width`(전폭); 최소 height=`WINDOW.minHeight`, 최대=`WINDOW.maxHeight`. 단조 증가, 범위 밖 클램프. 한계값은 모두 `WINDOW` config 상수.
   - `centeredBarBounds(workArea: {width:number}, width: number, height: number, topMargin: number): {x:number;y:number;width:number;height:number}` — `x = round((workArea.width - width)/2)`(가로 중앙, 0 미만 클램프), `y = topMargin`. 중앙 정렬용. (테스트: 전폭이면 x=0, 절반폭이면 x=¼폭.)
   - `fovForHeight(baseFov: number, baseHeightPx: number, heightPx: number): number` — 세로 픽셀이 줄어도 world↔pixel 배율을 보존하도록 카메라 수직 FOV를 재계산. `fov = degrees( 2 * atan( tan(radians(baseFov)/2) * (heightPx / baseHeightPx) ) )`. (테스트: heightPx=baseHeightPx면 baseFov, 절반이면 더 좁은 fov로 단조 감소.)
2. **IPC 채널 추가** `SET_WINDOW_SIZE`(`ipc-channels.ts`) + payload 타입 `SetWindowSizePayload { width:number; height:number }`(`types.ts`) + `AquaBridge.setWindowSize(width, height)`(types + preload). preload는 기존 패턴대로 `ipcRenderer.send`.
3. **main 핸들러**(`ipc.ts`) → `window.ts`에 `setWindowSize(win, width, height)`: `screen.workAreaSize`로 `centeredBarBounds`를 계산해 bounds 적용(가로 중앙, top 고정). 화면 work area를 벗어나지 않게 width/height 클램프.
4. **renderer 배선**(`main.ts`):
   - 현재 바 height를 상태로 보관(기본 `WINDOW.height`). 슬라이더 변경 시 `barSizeForScale`로 {width,height} 계산 → `window.aqua.setWindowSize(...)` 호출.
   - **캔버스 리프레임(비축소 크롭)**: 바 height가 바뀌면 `container.style.height`를 새 height로 갱신(현재 캔버스가 `WINDOW.height`에 고정된 것을 "현재 바 height" 변수로 대체). 그다음 **카메라 FOV를 `fovForHeight(CAMERA.fov, WINDOW.height, 현재height)`로 설정**하고 `camera.aspect = width/height` 갱신 후 `updateProjectionMatrix()` + `renderer.setSize`. 이렇게 하면 창이 줄어도 물고기/씬은 같은 픽셀 크기로 남고 가장자리만 잘린다(중앙 기준). SceneRoot에 `resizePreservingScale(baseFov, baseHeightPx)` 같은 메서드를 추가하거나 `resize()`를 이 규칙으로 일반화한다.
   - **패널 확장 높이 상호작용**: `onExpandedChange`의 확장 높이를 `현재 바 height + 패널 여유분`으로 계산하도록 변경(기존 `WINDOW.expandedHeight` 고정값 → `현재바높이 + WINDOW.panelAllowance`). 접으면 현재 바 height로 복귀. 확장으로 창 height가 커져도 캔버스(바 height)·카메라 배율은 바뀌지 않는다.
   - `AppSettings`에 `windowScale01`(기본값) 추가, `ControlPanelState`/`syncState` 반영.
5. **ControlPanel**: 라벨 예 `창 크기` 슬라이더(0~100%) 추가, 콜백 `onWindowScaleChange(t01)`.
6. click-through 중에도 슬라이더는 컨트롤 hover 로직으로 조작 가능해야 한다(기존 `_root` hover 처리로 자동 충족 — 깨뜨리지 말 것).

## Acceptance Criteria

```bash
npm run test
npm run build
npm run lint
npm run smoke
```
추가(수동): `npm run dev`로 크기 슬라이더를 움직여 ① 창이 실시간으로 커지고/작아지며 **가로 중앙에 정렬**되는지, ② **물고기/오브제의 화면상 크기가 그대로**이고 가장자리만 잘리는지(줌아웃/축소 아님), ③ 종횡비 왜곡이 없고 패널 펼침이 여전히 잘리지 않는지 확인.

## 검증 절차

1. AC 4개 종료코드 0. `barSizeForScale`·`centeredBarBounds`·`fovForHeight` 테스트 통과(단조·클램프·중앙정렬·배율보존). `npm run smoke` pass.
2. 체크리스트:
   - 슬라이더로 창이 실시간 리사이즈되고 **가로 중앙 정렬**되는가?
   - 창이 줄어도 **물고기/오브제 픽셀 크기가 그대로**(중앙 크롭)이고 줌아웃·왜곡이 없는가?
   - 패널 확장 시 현재 바 height 기준으로 잘리지 않는가?
   - OS 창 제어가 전부 main에서 일어나는가?(renderer는 IPC만) preload 화이트리스트만 사용?
   - 매직넘버 제거(WINDOW 상수)? 투과 유지? 기존 테스트 유지?
3. **런타임 eval 게이트**: execute.py 스모크 자동 실행. 이 step은 **phase 마지막**이므로 phase-끝 비전 eval(레퍼런스 대비)도 통과해야 한다.
4. `phases/3-quick-fixes/index.json`의 step 3 갱신(성공 `completed`+`summary`, 실패 규칙 동일).

## 금지사항

- renderer에서 직접 `BrowserWindow`/`win.setBounds`를 호출하지 마라. 이유: 아키텍처 CRITICAL — OS 제어는 main 전용, renderer는 preload IPC만.
- `nodeIntegration`을 켜거나 화이트리스트 밖 IPC를 쓰지 마라. 이유: 보안 규칙.
- 창을 work area 밖으로 키우거나 0/음수 크기로 만들지 마라. 이유: 창 소실/크래시. 반드시 클램프.
- 창 축소 시 카메라를 그대로 둬 내용이 줌아웃(축소)되게 하지 마라. 이유: 사용자 명시 — 오브제는 같은 픽셀 크기로 유지하고 중앙 크롭해야 함(`fovForHeight`로 배율 보존).
- 창을 좌측 고정으로 두지 마라 — 가로 중앙 정렬(`centeredBarBounds`). 이유: 오브제가 중앙에 모여 있음.
- 기존 `setWindowHeight`(패널 확장용) 동작을 제거하지 마라 — 바 height 기준으로 일반화해 공존시켜라.
- 기존 테스트를 깨뜨리지 마라.
