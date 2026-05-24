# 핸드오프 — 인터랙션 UX 수정 (2026-05-25, 업데이트)

다음 세션이 이어서 작업할 수 있도록 현재 상태를 정리한다.
먼저 `CLAUDE.md`(렌더링 함정·eval 규칙)와 `docs/ARCHITECTURE.md`를 읽을 것.

## 현재 상태

- 브랜치: **`feat-4-fish-interactions`** (main 미병합).
- 검증: `npm run test`(361) · `lint` · `build` · `smoke`(pass=true) 모두 통과.
- 이번 세션에서 핸드오프의 인터랙션 UX 이슈 6건 + 발견된 패널 잘림 버그 1건을 모두 처리했다.

## 후속 세션 작업 (2026-05-25, 추가) — 버그 3건 + 신규 기능 2건

### 버그 수정 (완료)
1. **멀티모니터 창 강제 이동** — `setWindowSize`가 `getPrimaryDisplay()`로 클램프 → 보조 모니터 창이
   주 모니터로 끌려옴. `getDisplayMatching(win.getBounds()).workArea` 기준으로 변경 + 순수 함수
   `clampSizeToDisplay`로 분리(유닛테스트). ⚠ 실 멀티모니터 체감은 미검증(smoke 단일 디스플레이).
1b. **보조 모니터로 드래그 후 버튼 클릭 무반응(복귀해도 지속)** — `setupButtonDrag`/`setupPanelDrag`에
   `lostpointercapture` 정리·`releasePointerCapture`가 없어, 멀티모니터 드래그 중 캡처/`pointerup`이
   유실되면 `dragging`이 true로 고착 → 이후 클릭 무반응(0-A 클릭 무반응의 실제 트리거). resizeHandles에
   이미 있던 정리 패턴을 버튼/패널 드래그에도 적용. mock 엘리먼트 기반 회귀 테스트 3개.
   ✅ dev에서 드래그 후 클릭 정상(회귀 없음) 확인. ⚠ 실 cross-monitor 드래그 자체는 사용자 확인 권장.
2. **고밝기 수평선 잔상** — 격리 캡처로 원인 확정: 베일/IBL 아님, **모래 평면 먼 가장자리**(뷰 깊이≈16)가
   알파 페이드 포화(`depthFar=10`) 후 하드 컷. 알파 페이드를 틴트와 분리(`WATER.alphaDepthFar=15`,
   `maxAlphaFade=1.0`, `uWaterAlphaFar`)해 가장자리를 0으로 용해. delta ±36→~6.
   **(2차)** 선형 페이드로는 부족 — 지평선 근처 원근 압축으로 마지막 1~2px에서 알파가 ~0.09→0
   급강하해 delta~6 잔선이 남았다(밝은 배경+최대 밝기에서 재현). 알파 페이드에 **smoothstep**(기울기 0
   으로 0 도달) 적용 → 전체폭 모래 선 제거(cov 0.99 선 소멸). 순수 헬퍼·GLSL 동기화.
   추가로 `Aquascape._buildGlassEdge`(유리 엣지 흰 라인 2개, opacity 0.05)도 **제거** — smoothstep 후
   유일하게 남은 전체폭 선(화면 최상단, delta~8)이라 같은 클래스. `AQUASCAPE.glassEdgeOpacity` 삭제.
   ✅ 밝은배경+최대밝기 격리 캡처에서 **전체폭(cov≥0.9) 인공 선 0개** 확인.

### 신규 기능 (완료, dev 실기기 확인)
3. **패널 자동 위/아래 열기** — 패널 펼침 시 하단 공간이 부족하면 창을 강제 이동하던 것을, **위로 펼침**으로
   전환. `panelLayout.choosePanelDirection`(순수, 테스트)으로 방향 결정. 'up'이면 `setWindowSize(...,
   anchorBottom=true)`로 하단 앵커 + 캔버스/베일을 창 하단에 붙이고(`position:fixed`+top/bottom),
   `ControlPanel.setOpenDirection`이 버튼 위로 패널을 펼침. `WINDOW.expandedHeight`→`panelExtra`(바+여백).
   ✅ dev로 상단=아래로/하단=위로 열림·바 제자리 유지 확인.
4. **이용 가이드** — `ControlPanel` 헤더에 '?' 버튼, 클릭 시 앱 내 DOM 모달(`cp__help-*`)로 각 컨트롤
   사용법 안내(백드롭/✕ 닫기). ✅ dev 확인.

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
- ✅ 버튼 표시·스타일·도달성, **2단계 무장 텍스트 전환("한 번 더 누르면 종료")까지 사용자 실기기 확인 완료.**

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

## 남은 알려진 이슈 (별도 후속)
- (완료) ~~멀티모니터에서 보조모니터 창이 주 모니터로 강제 이동.~~ 원인은 `src/main/window.ts`의
  `setWindowSize`가 `screen.getPrimaryDisplay().workAreaSize`(주 모니터 기준, x/y 오프셋 없음)로
  x/y/width/height를 클램프한 것. `screen.getDisplayMatching(win.getBounds()).workArea`(전역 좌표,
  창이 놓인 디스플레이 기준)로 변경하고, 클램프를 순수 함수 `clampSizeToDisplay`로 분리해 유닛테스트
  7개 추가. `setWindowHeight`/`moveWindowBy`는 primary를 참조하지 않아 이 버그 없음(미수정).
  ⚠ **실 멀티모니터 검증 미완료** — smoke는 단일 가상 디스플레이라 못 잡음. 순수 로직만 유닛테스트로
  가드됨. 실기기(보조 모니터에서 리사이즈) 확인 필요.
- (완료) ~~밝기 올리면 옅은 수평선 하나가 움직임.~~ **격리 캡처(고밝기+흰배경, 후보 요소 토글)로
  근본 원인 확정**: 핸드오프가 지목한 베일·IBL은 무관(베일만 남긴 캡처에선 수평선 0개). 실제 원인은
  **모래 평면(`Aquascape._buildSand`, `PlaneGeometry 200×14`)의 먼 가장자리**. 카메라 z=5·모래 z=-4라
  먼 가장자리 뷰 깊이≈16인데, 알파 페이드가 `depthFar=10`에서 포화(55% 불투명)된 뒤 가장자리에서
  0.55→0 하드 컷 → 전체 폭 수평선. 커스틱 스크롤이 얹혀 "일렁임", 밝기↑ 시 대비 강화.
  - 조치: 알파 페이드를 틴트와 **분리**(`WATER.alphaDepthFar=15`, `maxAlphaFade 0.45→1.0`,
    `waterDepth.ts` GLSL에 `uWaterAlphaFar` 추가). 먼 가장자리(깊이 16)에서 알파가 0에 도달해
    하드 컷이 수중 헤이즈로 용해됨. 틴트(`depthFar=10`)는 그대로라 수중 무드 회귀 없음.
    순수 매핑 `waterDepthHelpers.waterDepthAlphaFactor` + "먼 가장자리 알파 0" 회귀 가드 테스트 5개.
  - 검증: 격리 캡처에서 해당 수평선 delta **±36→~3 (약 10배↓)**, 시각적으로 소프트 용해 확인.
    실 데스크톱(밝은 배경)에서의 최종 체감은 사용자 확인 권장.
- (잔여, 미수정) 위 수정 후 화면 **최상단(y≈12px)**의 더 옅은 **정적** 수평선이 상대적으로 두드러짐 —
  `Aquascape._buildGlassEdge`의 유리 엣지 하이라이트(`THREE.Line` y=2.2, `glassEdgeOpacity=0.05`).
  움직이지 않으므로 사용자가 보고한 "움직이는" 선과는 별개. 거슬리면 제거/추가 페이드 검토.

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
