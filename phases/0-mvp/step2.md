# Step 2: main-window

## 읽어야 할 파일

- `/docs/ARCHITECTURE.md` (`src/main/window.ts` 역할)
- `/docs/PRD.md` (핵심기능 1·2·3: 와이드 바, always-on-top, show/hide)
- `/CLAUDE.md` (OS 제어는 main에서만 — CRITICAL)
- `src/main/index.ts` (step 0의 창 생성 코드 — 여기서 추출/정교화)
- `src/shared/config.ts` (WINDOW 상수)

## 작업

step 0에서 `index.ts`에 인라인으로 둔 창 생성 로직을 `src/main/window.ts`로 추출하고, 와이드 바 지오메트리·show/hide·always-on-top 토글을 정식 구현한다.

1. **`src/main/window.ts`**
   - `createOverlayWindow(): BrowserWindow` — `screen.getPrimaryDisplay().workAreaSize`로 폭을 잡아 화면 상단 가로 바를 만든다.
     - `width = workArea.width`, `height = config.WINDOW.height`, `x = 0`, `y = config.WINDOW.topMargin`.
     - `transparent:true, frame:false, alwaysOnTop:true, resizable:false, contextIsolation:true, nodeIntegration:false, preload 연결`.
     - `alwaysOnTop`은 `win.setAlwaysOnTop(true, 'screen-saver')` 수준으로 강하게 띄운다.
   - `setOverlayVisible(win, hidden: boolean): void` — `hidden`이면 `win.hide()`(또는 콘텐츠만 숨기는 방식이면 renderer에 위임). **여기서는 창 자체 show/hide로 구현**하되, 제어용 플로팅 버튼 유지는 step 9에서 renderer가 별도 처리하므로, 이 step에서는 `win.hide()/show()` API만 제공한다.
   - `setAlwaysOnTop(win, enabled: boolean): void`.
   - **순수 헬퍼 분리(테스트 대상)**: `computeBarBounds(workArea: {width:number;height:number}, cfg): {x,y,width,height}` 를 별도 export. 디스플레이 크기 입력 → 창 bounds 계산을 순수 함수로.

2. **`src/main/index.ts` 리팩터링**
   - 창 생성은 `createOverlayWindow()` 호출로 대체. electron 라이프사이클(`whenReady`, `window-all-closed` 등)만 남긴다.
   - 단, **힐링 위젯 특성상 모든 창을 닫아도 즉시 종료하지 않는 정책**은 step 9에서 트레이 등과 함께 다룬다. 이 step은 표준 동작 유지로 충분.

## Acceptance Criteria

```bash
npm run build
npm run test    # computeBarBounds 단위 테스트 통과
npm run lint
```

## 검증 절차

1. AC 실행, 모두 0 확인.
2. `npm run dev`로 창이 화면 상단에 가로 바 형태(투명·프레임 없음)로 뜨는지 **수동 확인**한다. (자동 테스트 불가 — ADR-004)
3. 체크리스트:
   - 창 옵션에 `contextIsolation:true`, `nodeIntegration:false` 유지되는가?
   - `computeBarBounds`가 electron 없이 테스트 가능한 순수 함수인가?
   - WINDOW 상수를 config에서 가져오는가? (매직넘버 금지)
4. `phases/0-mvp/index.json`의 step 2 업데이트:
   - 성공 → `completed` + `summary`에 "window.ts export 목록(createOverlayWindow/setOverlayVisible/setAlwaysOnTop/computeBarBounds)과 index.ts 변경점" 요약.

## 금지사항

- click-through(`setIgnoreMouseEvents`)와 창 이동(moveBy)은 여기서 구현하지 마라. 이유: 그것들은 step 3(overlay-ipc) 소관. 이 step은 창 생성/표시/always-on-top까지만.
- renderer/preload를 수정하지 마라. 이유: 레이어 분리.
- 기존 테스트를 깨뜨리지 마라.
