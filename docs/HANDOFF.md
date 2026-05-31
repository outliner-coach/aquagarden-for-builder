# 핸드오프 — 인터랙션 UX 수정 (2026-05-25, 업데이트)

다음 세션이 이어서 작업할 수 있도록 현재 상태를 정리한다.
먼저 `CLAUDE.md`(렌더링 함정·eval 규칙)와 `docs/ARCHITECTURE.md`를 읽을 것.

## 신규 개체 (2026-05-31) — 새우(아마노 새우) 추가 + 크기/거동 차별화 완료 (브랜치 `feat-5-shrimp`, main 미병합)

상세 리포트: `docs/SHRIMP_REPORT.md`. **블렌더 절차적 새우 GLB 제작 → 앱 통합 → 미학 개선 → 크기 1/4 축소 → 바닥 기는 청소부 거동**까지 완료. (직전 세션이 마지막 2건을 미완료로 중단했던 것을 이어받아 처리함.)

### 완료된 부분 (커밋됨)
- **GLB**: Blender 절차적 생성(`/tmp/shrimp_amano/build.py` v32 보존). 커밋본 `src/renderer/assets/fish/shrimp.glb` = **588,576 bytes** (md5 `a4288fc…`), 스킨 메시 1개(`Shrimp`, 7,740 verts) + 보조 메시 1개(총 7,782 verts), **아마처 7본(b00–b06) + neutral_bone**, `"Swim"` 클립 1–48프레임, 머티리얼 2개(텍스처드 바디).
- **방향**: bbox `x −3.432..1.737, y −0.755..0.755, z −1.646..0.152`, 최장축 X(5.169) = 머리 −X 규약. 기존 어종과 동일하게 `Fish.ts`의 `_align.rotation.y=π/2`로 정렬, per-species `modelYaw` 불필요(스모크에서 측면 유영 없음).
- **레지스트리** `src/renderer/entities/speciesRegistry.ts`: `id:'shrimp'`, `kind:'individual'`, `category:'ambient'`, `baseScale:1.5`, `swimSpeed:0.5`, 한국어 대사 10줄(테스트로 고유성 가드). 앰비언트 풀에 등장(개체수 슬라이더로 스폰).
- **검증**: test **431 통과** · lint 클린 · build OK · `npm run smoke` **pass=true**(fishActive 31, health.errors=[]). 자체 미학 평가 **8/10**(1차 4/10 → 개선).
- **프리뷰**: `docs/media/shrimp/shrimp_preview.png`(실제 커밋 GLB 렌더와 일치하도록 갱신·커밋됨).
- 커밋 흐름: `7e7795d`(추가) → `4be40f7`(메시 미학) → `aaaf53f`(텍스처드 재동기화) → `62e5c88`(개선판 재동기화) → `88a9303`(프리뷰 갱신, 최종 HEAD).

### ✅ 크기·거동 차별화 (2026-05-31 완료)
1. **[완료] 새우 크기 1/4 축소.** 사용자 요청대로 `baseScale: 1.5 → 0.375`([speciesRegistry.ts](../src/renderer/entities/speciesRegistry.ts)). 최종 스케일 ≈ 0.06~0.08. smoke pass=true(사라지지 않음 확인).
2. **[완료] 새우 전용 "바닥 기는 청소부" 거동.** 사용자가 선택한 ①안 구현. 다른 어종의 자유 유영과 차별화:
   - `FishSpecies.behavior?: 'swim' | 'crawler'` 종별 분기(새우만 crawler, 다른 어종 경로 불변).
   - 바닥 띠 부착(수직 스프링 `floorBiasForce`) + 수직 방랑 제거 + 종종거림(scuttle 속도 envelope `scuttleSpeedFactor`).
   - 매직넘버 금지: `SHRIMP` config 상수 + 순수 헬퍼 `crawlerHelpers.ts` + TDD(`crawlerHelpers.test` 8 + `Fish.crawler.test` 5).
   - 검증: test **446**·lint·build·smoke(pass=true, errors=[]) 통과.

> 보존 산출물: `/tmp/shrimp_amano/`(build.py v32·v31 백업·렌더/검사 스크립트, preview.png). **`/tmp`는 재부팅 시 소실될 수 있음** — 재생성이 필요하면 `build.py`를 `/Applications/Blender.app/Contents/MacOS/Blender -b -P build.py`로 실행.
>
> 후속(선택): 새우 크기가 매우 작아졌으니(≈0.06~0.08) 실제 오버레이에서 가시성·클릭 픽킹이 적절한지 `npm run dev` 라이브 확인 권장. main 병합(merge/PR)도 미진행.

## 신규 기능 (2026-05-28) — 컨트롤 패널 2열 재구성 + 잘림 근본 수정 (브랜치 `feat-panel-2col`, main 미병합)

설계 `docs/superpowers/specs/2026-05-28-panel-2column-layout-design.md`,
계획 `docs/superpowers/plans/2026-05-28-panel-2column-layout.md`. 서브에이전트 주도로 구현.
- **잘림 근본 수정**: 창을 키울 때 고정 `panelExtra(400)` 대신 **패널 실제 높이를 측정**(`getPanelHeight`=scrollHeight)
  해 `requiredPanelExtra`(순수, 가용공간 클램프)로 창 높이를 산정. 위/아래 펼침·창 크기 무관하게 안 잘림.
  fallback으로 `max-height`+`overflow-y:auto` 유지. `WINDOW.panelExtra`는 fallback, `panelGap=60` 추가.
- **레이아웃**: 섹션별 2열 grid(`cp__body`). 왼쪽 "어종"(개체수 슬라이더+특별개체 칩), 오른쪽 "표시·조명"
  (밝기·투명도·확대 슬라이더+숨김/투과/Always 토글), 하단 전폭(힌트→먹이/놀래키기→안내→종료). 패널 폭 220→310px.
- **특별 개체 = 채움 칩**: 접이식 그룹 제거, 항상 표시. `<button.cp__feature-chip aria-pressed>`(ON=청록 채움+점●,
  OFF=테두리○). 빌더(`_createSlider`/`_createToggle`/`_appendSectionLabel`)가 부모 인자를 받고, 슬라이더는 `unit` 인자.
- 검증: test **413**·lint·build·smoke(pass=true, `AQUA_SMOKE_FEATURES` 칩 클릭으로 갱신) 통과.
  **데스크톱 라이브 QA 완료**(computer-use): 2열 정렬·칩 ON/OFF 토글·스폰/디스폰·숨김 중 어종 활성/확대·먹이·놀래키기
  비활성·**전 상태 잘림 0**·영속 복원 확인.
- 후속(코드리뷰 Minor, 미적용): 칩 `:focus-visible` 링 없음(키보드 a11y), hover색 `rgba(15,23,28,0.76)` 매직넘버
  3중복(`COLORS.buttonBgHover`로 추출 검토).

## 신규 기능 (2026-05-27) — 어종 4종 추가 + 하이브리드 종 선택 (main 병합됨)

설계 `docs/superpowers/specs/2026-05-27-fish-species-addition-design.md`,
계획 `docs/superpowers/plans/2026-05-27-fish-species-addition.md`, 하네스 `phases/5-fish-species`.
- **어종 4종**: 만타가오리·고래·돌고래·상어(`src/renderer/assets/fish/`, Quaternius CC0, 스켈레탈 swim).
  레지스트리 `category: 'ambient' | 'feature'` 도입, `pickSpecies`는 ambient만 후보.
- **하이브리드 스폰**: 앰비언트 5종은 개체수 슬라이더(현행), 특별 4종은 토글 ON=1마리(화면 안 즉시 등장).
  단일풀 + `_ambientFish` 명시 추적 + `_featureActive` 맵. 순수함수 `reconcileFeatures`/`featureSpawnPosition`.
- **단일 진실 원천 `availableFeatures`**(로드된 프로토타입만): UI 토글·영속 교집합·reconcile 모두 여기에 맞춰 유령 차단.
- **UI**: "어종" 섹션, `개체수 (작은 물고기)`, 접이식 "특별 개체" 그룹. `setInteractive`에서 종/개체수 제외(투과·숨김 중 조작 가능).
- **영속**: `AppSettings.enabledFeatures: string[]`(하위호환), 복원 시 availableFeatures 교집합.
- **smoke 훅**: `AQUA_SMOKE_FEATURES=1`로 특별 개체 렌더를 headless 검증 가능(토글 DOM 구동).
- 검증: test **409**·lint·build·smoke pass. 헤드리스 캡처로 **ON→fishActive 22·머리 자세 정상·셰이더 무결**,
  **OFF→18(release)** 확인.
- ✅ **데스크톱 라이브 QA 2건 완료**(2026-05-27, computer-use 실기기):
  ① 재시작 후 토글 상태 복원 — 만타가오리+상어 ON·개체수 0·밝기 93%·확대 200%로 두고 종료 버튼(2단계)
     으로 종료 후 재시작 → 토글·개체수·기타 설정 모두 복원, 특별 개체 재스폰 확인.
  ② 투과/숨김 중 종/개체수 조작 — 수조 숨김 ON 중 만타 토글 ON(해제 후 실제 스폰 확인), 마우스 투과 ON 중
     상어 토글 ON·개체수 슬라이더 60→0 드래그 모두 동작(패널 hover로 click-through 중 컨트롤 재활성).
  - 부수 확인: 종료 버튼 3초 자동 disarm, per-종 reconcile(만타만 OFF 시 상어 유지).

## 현재 상태

- 브랜치: **`feat-4-fish-interactions`** (main 미병합).
- 검증: `npm run test`(361) · `lint` · `build` · `smoke`(pass=true) 모두 통과.
- 이번 세션에서 핸드오프의 인터랙션 UX 이슈 6건 + 발견된 패널 잘림 버그 1건을 모두 처리했다.

## 신규 기능 (2026-05-26) — 수조 줌 + 인터랙션 가용성 UX

설계 `docs/superpowers/specs/2026-05-26-...`, 계획 `docs/superpowers/plans/2026-05-26-...`.
- **줌**: 마우스 휠 + "확대" 슬라이더(100~200%). `camera.zoom` 방식(fov 재계산과 독립 → 리사이즈해도
  유지, Raycaster 자동 반영). 휠은 인터랙티브(투과 OFF·숨김 OFF)일 때만, 그 외엔 기본 스크롤 보존.
  `ZOOM` 상수, `SceneRoot.setZoom`, `zoomHelpers`(순수·테스트). 영속화(`AppSettings.zoom`, 하위호환).
- **인터랙션 비활성 UX**: 투과/숨김 ON이면 먹이주기·놀래키기·확대 슬라이더를 흐리게+클릭불가 처리하고
  그 아래 안내문 표시. armed lure 모드는 해제. 단일 진실 원천 `computeInteractive`(순수·테스트)로
  FoodLure/FishDialogue 게이트·휠·패널 표시를 통일.
- 검증: `npm run test`(387)·`lint`·`build`·`smoke`(pass=true) 통과. ⚠ **휠 줌 체감·비활성 시각
  표시·확대 상태 픽킹 정확도는 dev 라이브 QA 미완료** — 계획 Task 8 Step 2 체크리스트 참고.

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
   **(3차, 진짜 중간선)** 위 격리는 비-확장(창=바높이) 상태라 못 잡았다. 사용자가 본 "중간선"은
   **패널 펼침 시 노출되는 캔버스 하단 가장자리** — 캔버스는 바 높이만큼만 그려지는데, 창이 길어지면
   그 하단의 불투명 모래가 투명 확장 영역 위에 하드 컷(전체폭 선)으로 드러남. 캔버스에 하단 페이드
   마스크(`mask-image` linear-gradient, `WINDOW.canvasBottomFadePx=26`) 적용 → 모래가 부드럽게 용해.
   ✅ dev 밝기 100%·패널 펼침에서 선 사라짐 확인.
1c. **수조 숨김 시 베일 '레이어' 잔존** — `onHiddenChange`가 캔버스만 `display:none` 하고 water veil(DOM
   그라디언트)은 그대로 둬, 숨김 시 옅은 사각형 레이어가 바탕화면 위에 남음. 숨김/표시에 `waterVeil.style.
   display` 토글 추가. ✅ dev에서 숨김 시 상단 깨끗(레이어 없음) 확인.
1d. **리사이즈가 하단 앵커로 새서 창이 위로 사라짐(버튼 무반응)** — main 프로세스에 창 bounds 로깅을
   붙여 dev에서 재현: `currentPanelDir`가 패널을 닫은 뒤에도 'up'으로 남고, **리사이즈가 패널 토글과 같은
   `syncWindowSize`를 거쳐 그 값을 anchorBottom으로 사용** → 우하단 그립을 끌면 바닥이 고정되고 top이
   위로 기어올라(468→338…) 창이 화면 밖으로. 순수 함수 `shouldAnchorBottom('toggle'|'resize', expanded,
   dir)`로 분리: 하단 앵커는 'up'에서만, **리사이즈는 패널이 실제 펼쳐진 동안에만**(닫힌 채 리사이즈는
   좌상단 앵커). 회귀 테스트 4개. ✅ dev에서 리사이즈 시 top 고정·바닥 확장 확인(로그 anchorBottom=false).
   - 알려진 잔여: `moveWindowBy`(overlay.ts)는 클램프가 없어 버튼을 화면 밖으로 드래그하면 사라질 수 있음
     (별도 후속 — 화면 안으로 클램프 검토).

### 사용자 관점 QA 개선 (2026-05-25, v0.2.0) — 화면 잠금으로 라이브 검증 일부 보류
- **창 화면 밖 이탈 방지**: `moveWindowBy`가 `clampPositionToDisplay`(순수, 테스트)로 디스플레이
  work area 안에 머묾. 버튼째 사라져 복구 불가 되던 문제 차단.
- **메뉴바 트레이**(`src/main/tray.ts`): 보이기/숨기기·위치 초기화(상단 전폭)·로그인 시 시작·종료.
  mac은 `setTitle('🐠')`. 버튼 분실 시 유일 복구·종료 경로. (clean 기동 확인, 트레이 메뉴 동작은 라이브 미검증)
- **설정·창 영속화**(`src/renderer/persistence.ts`, localStorage): settings+alwaysOnTop+barW/H+창 위치.
  startup 복원(설정 적용 + `setWindowBounds`로 창 복원, main이 화면 안 클램프). 접힌(resting) 위치만
  저장(펼친 좌표 저장 안 함). 변경 시 디바운스 저장. **재시작 복원은 라이브 미검증(잠금).**
- **마우스 투과/수조 숨김 상태 힌트**: ControlPanel에 활성 시 안내 문구.
- 검증: test 371·lint·build·smoke pass + 트레이 포함 clean 기동 확인. ⚠ 영속 복원/트레이 메뉴/힌트
  표시는 화면 잠금 해제 후 dev 라이브 QA 필요.

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
