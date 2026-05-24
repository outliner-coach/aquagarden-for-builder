# Step 3: overlay-ipc

## 읽어야 할 파일

- `/docs/ARCHITECTURE.md` (데이터 흐름: renderer → preload → ipcMain → window/overlay)
- `/CLAUDE.md` (CRITICAL: OS 제어는 main에서만, preload contextBridge 화이트리스트, nodeIntegration 금지)
- `src/shared/ipc-channels.ts`, `src/shared/types.ts` (채널·페이로드·AquaBridge 정의)
- `src/main/window.ts` (setOverlayVisible/setAlwaysOnTop 재사용)
- `src/main/index.ts`, `src/preload/index.ts`

## 작업

OS 윈도우 동작을 renderer가 안전하게 요청할 수 있도록 IPC 브리지를 완성한다. **click-through**와 **창 이동**이 핵심.

1. **`src/main/overlay.ts`**
   - `setClickThrough(win, enabled: boolean): void` — `win.setIgnoreMouseEvents(enabled, { forward: true })`. 활성 시 수조 뒤 바탕화면/타 앱을 클릭 가능하게 패스스루. `{forward:true}`로 hover 이벤트는 받아 UI 재진입이 가능하도록.
   - `moveWindowBy(win, dx: number, dy: number): void` — 현재 `win.getBounds()`에 dx/dy를 더해 `win.setBounds()`. (플로팅 버튼 드래그로 창 전체 이동 — PRD 기능 6)
   - **순수 헬퍼(테스트 대상)**: `applyDelta(bounds, dx, dy): newBounds` 를 export. 경계 클램프가 필요하면 여기 포함.

2. **`src/main/ipc.ts`**
   - `registerIpcHandlers(win: BrowserWindow): void` — `ipcMain.on`/`handle`로 `IPC` 채널을 등록한다. **화이트리스트만**:
     - `IPC.MOVE_WINDOW_BY` → `moveWindowBy(win, dx, dy)`
     - `IPC.SET_CLICK_THROUGH` → `setClickThrough(win, enabled)`
     - `IPC.TOGGLE_VISIBILITY` → `setOverlayVisible(win, hidden)` (window.ts)
     - `IPC.SET_ALWAYS_ON_TOP` → `setAlwaysOnTop(win, enabled)` (window.ts)
   - 페이로드는 `src/shared/types.ts` 타입으로 검증/구조분해. 알 수 없는 채널은 등록하지 않는다.
   - `index.ts`에서 창 생성 직후 `registerIpcHandlers(win)` 호출.

3. **`src/preload/index.ts`**
   - `contextBridge.exposeInMainWorld('aqua', bridge)` 로 `AquaBridge` 구현 노출. 각 메서드는 `ipcRenderer.send(IPC.*, payload)` 로 위임.
   - renderer 전역 타입: `src/renderer/global.d.ts`에 `declare global { interface Window { aqua: AquaBridge } }` 추가.
   - CRITICAL: 임의의 채널을 노출하는 범용 `send(channel, ...args)`를 만들지 마라. 정의된 4개 메서드만 노출.

## Acceptance Criteria

```bash
npm run build
npm run test    # applyDelta 단위 테스트 통과
npm run lint
```

## 검증 절차

1. AC 실행, 모두 0 확인.
2. 체크리스트:
   - preload가 화이트리스트 4개 메서드만 노출하는가? 범용 send가 없는가? (보안 CRITICAL)
   - 모든 `setIgnoreMouseEvents`/`setBounds` 호출이 main에만 있는가? renderer엔 없는가?
   - `applyDelta`가 electron 없이 테스트되는가?
3. 가능하면 `npm run dev`로, renderer에서 `window.aqua.moveWindowBy(10,0)`를 콘솔 호출해 창이 움직이는지 **수동 확인**. (선택)
4. `phases/0-mvp/index.json`의 step 3 업데이트:
   - 성공 → `completed` + `summary`에 "노출된 window.aqua API 4종, overlay.ts/ipc.ts export, click-through 호출 방식" 요약.

## 금지사항

- renderer에서 직접 electron/ipcRenderer를 import하지 마라. 이유: contextIsolation 위반·보안 CRITICAL. 반드시 `window.aqua`를 통한다.
- 범용 패스스루 IPC(`invoke(channel, args)`)를 노출하지 마라. 이유: 임의 채널 호출은 보안 구멍.
- UI(슬라이더/버튼)를 만들지 마라. 이유: step 9 소관. 여기선 브리지/핸들러만.
- 기존 테스트를 깨뜨리지 마라.
