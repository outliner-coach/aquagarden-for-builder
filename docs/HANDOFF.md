# 핸드오프 — 인터랙션 UX 수정 (2026-05-25, 업데이트)

다음 세션이 이어서 작업할 수 있도록 현재 상태를 정리한다.
먼저 `CLAUDE.md`(렌더링 함정·eval 규칙)와 `docs/ARCHITECTURE.md`를 읽을 것.

## 현재 상태

- 브랜치: **`feat-4-fish-interactions`** (main 미병합).
- 검증: `npm run test`(334) · `lint` · `build` · `smoke`(pass=true) 모두 통과.
- 이번 세션에서 핸드오프의 인터랙션 UX 이슈 6건 + 발견된 패널 잘림 버그 1건을 모두 처리했다.

## 이번 세션에서 처리한 이슈 (모두 완료)

### 0-A. 패널/버튼 클릭 무반응 (P0) — 사용성 개선으로 대응
- **기본 상태에서 코드 버그는 재현되지 않았다.** 렌더러 콘솔을 main으로 포워딩하는 계측으로
  `button pointerdown → endDrag(moved=false) → _togglePanel → 패널 열림`을 확인. 초기 "무반응"은
  버튼이 작고(40px) 메뉴바 바로 아래에 붙어 클릭이 빗나간 **타게팅 문제**였다.
- 조치: 플로팅 버튼 `40→44px`, `cp` root `top:36→40`(메뉴바 여유). resize 핸들에
  `lostpointercapture` 정리 추가 → 드래그 캡처 고착으로 인한 무반응 경로 차단.

### 0-B. 종료(Quit) 버튼 (P0)
- `src/shared/ipc-channels.ts`에 `QUIT_APP`, `types.ts` `AquaBridge.quitApp()`,
  `preload/index.ts` `ipcRenderer.send`, `main/ipc.ts`에서 `app.quit()`(OS 제어는 main에서만).
- `ControlPanel` 하단에 빨간 **종료** 버튼(파괴적, 2단계 확인: 1클릭 무장 "한 번 더 누르면 종료"
  → 3초 내 재클릭 시 종료). 색은 `COLORS.danger/dangerFill`.
- ⚠️ 라이브에서 버튼 표시·스타일·도달성은 확인했으나, **무장 텍스트 전환만은 hi-DPI 화면에서
  computer-use 픽셀 타게팅 한계로 확정 캡처하지 못함**(동작 정상인 먹이주기 버튼과 동일한 click 패턴).
  실제 마우스로 한 번 확인 권장.

### 1. 보이는 리사이즈 그립 (P0)
- `resizeHandles.ts`: 우하단에 **보이는 빗금 그립**(`repeating-linear-gradient`, hover 시 진하게),
  히트영역 가장자리 12px·코너 24px. 패널과는 스택 컨텍스트상 충돌 없음.
- ✅ 라이브로 그립이 보이고 드래그로 실제 리사이즈됨(고착 없음).

### 2. 먹이/놀래키기 활성 표시 (P1)
- `.cp__lure-btn--active`: 테두리만 → **배경 청록 채움 + 어두운 글자**. + "○○ 모드: 화면을
  클릭하세요" 힌트(`_lureHint`). ✅ 라이브 확인.

### 3. 클릭 핸들러 겹침 (P2)
- `main.ts`에서 FishDialogue 술어에 `&& foodLure.mode === null` 추가 → lure armed 시 대사 억제.

### 4. 패널 토글 안정화 (P3)
- `setupButtonDrag`: 미세 지터를 드래그로 오인해 토글이 스킵되던 문제. 순수 함수
  `exceedsThreshold`(거리 > `DRAG.clickThresholdPx`=4px) 도입, 임계값 넘기 전엔 클릭으로 유지.
  유닛 테스트 5개 추가. ✅ 토글 개/폐 반복 정상.

### (추가 발견·수정) 패널 잘림 → 종료 버튼 클릭 불가
- 종료 버튼+힌트가 패널 내용을 `max-height`(=`calc(100vh-96px)`) 너머로 밀어내, **힌트 표시 시
  종료 버튼이 스크롤 영역으로 밀려 잘림**. `WINDOW.expandedHeight` `480→540`으로 해결.
  ✅ 라이브로 힌트 표시 상태에서도 종료 버튼 잘림 없이 전부 보임.

## 남은 알려진 이슈 (별도 후속 — 미착수)
- 멀티모니터에서 패널 열면 보조모니터의 창이 주 모니터로 강제 이동. 원인: `src/main/window.ts`의
  `setWindowSize`/`setWindowHeight`가 `screen.getPrimaryDisplay()` 기준 클램프 →
  `getDisplayMatching(win.getBounds())`로 변경 필요.
- 밝기 올리면 옅은 수평선 하나가 움직임(라이트샤프트 제거 후 잔여). 용의자: 수중 베일 DOM
  그라디언트 밴딩(`main.ts setWaterVeil`)/IBL. systematic-debugging으로 격리.

## 테스트 절차

```bash
npm run test && npm run lint && npm run build && npm run smoke   # 로직·렌더 깨짐
npm run dev   # 실제 오버레이 구동 (상단 바 + 우상단 플로팅 버튼)
```
- **인터랙션·리사이즈는 smoke로 검증 안 됨** → `npm run dev` 후 직접/computer-use로:
  물고기 클릭 → 말풍선 / 먹이·놀래키기 → 화면 클릭 / 우하단 그립 드래그 리사이즈 / 종료 버튼 2단계.
- computer-use는 hi-DPI 외장 모니터에서 좌표 스케일(스크린샷↔렌더러 client ≈ ×1.32)·창 하단
  소형 버튼 타게팅이 까다롭다. 정확 클릭이 필요하면 렌더러 콘솔 포워딩(임시 계측)으로 좌표를 검증.

## 주의
- `npm run dev` 인스턴스가 백그라운드로 떠 있을 수 있음 → 새로 시작 전 정리(`pkill -f electron` 등).
- 아키텍처 규칙 준수: OS 창 제어는 main에서만, renderer는 preload IPC만. 매직넘버는
  `src/shared/config.ts`. 시각 변경 후 `npm run smoke` 필수(자기보고 불신).
