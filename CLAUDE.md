# 프로젝트: 3D 디지털 아쿠아가든 (Aquagarden Overlay)

화면 상단에 가로 바 형태로 떠 있는 **데스크톱 오버레이 위젯**. 다른 작업 중에도 항상 위에 노출되며, 바탕화면이 투과되어 비치는 미니멀 3D 수족관.

## 기술 스택
- Electron (데스크톱 셸, 투명 창 + always-on-top + click-through)
- Three.js (WebGL 3D 렌더링)
- TypeScript (strict mode)
- Vite (renderer 번들러 + dev 서버)
- Vitest (테스트), ESLint (린트)

## 아키텍처 규칙
- CRITICAL: OS 윈도우 제어(always-on-top, click-through, 창 이동, show/hide)는 **반드시 main 프로세스에서만** 수행한다. renderer는 IPC(preload contextBridge)를 통해서만 요청한다.
- CRITICAL: renderer에서 `nodeIntegration`을 켜지 않는다. 모든 IPC는 preload의 `contextBridge.exposeInMainWorld`로 노출된 화이트리스트 API만 사용한다. (보안)
- CRITICAL: 창이 숨겨진(hidden) 상태에서는 Three.js 렌더 루프(`requestAnimationFrame`)를 **반드시 정지**한다. 힐링 위젯이므로 유휴 시 CPU/GPU 점유를 0에 가깝게 유지한다.
- CRITICAL: 물고기 오브젝트는 풀링(pooling)으로 재사용한다. 개체수 슬라이더 변경 시 매번 생성/파괴하지 말고 풀에서 활성/비활성 전환한다. 생성은 프레임 드랍을 막기 위해 비동기/분할 처리한다.
- 3D 코드는 `src/renderer/`, OS 제어는 `src/main/`, 공유 타입/상수는 `src/shared/`에 둔다. 레이어를 섞지 않는다.
- 매직 넘버 대신 `src/shared/config.ts`의 상수를 사용한다.

## 개발 프로세스
- CRITICAL: 새 기능 구현 시 순수 로직(boids 벡터 계산, 풀 grow/shrink, 밝기→intensity 매핑 등)은 반드시 테스트를 먼저 작성하고 통과시키는 구현을 작성한다 (TDD). 렌더링·OS 제어 같은 부수효과 코드는 순수 함수로 분리해 테스트한다.
- 커밋 메시지는 conventional commits 형식을 따른다 (feat:, fix:, docs:, refactor:, chore:).

## 명령어
npm run dev      # Electron + Vite 개발 모드 (창 자동 실행)
npm run build    # TypeScript 컴파일 + renderer 프로덕션 번들
npm run lint     # ESLint
npm run test     # Vitest (1회 실행)
npm run smoke    # 빌드 + headless 런타임 eval (셰이더/렌더 깨짐·물고기·투과·블랭크 자동 검증)

## 현재 구현 상태 (2026-05-24)
방향 **B(스타일라이즈드 리치)** 구현 완료. 설계 문서: `docs/superpowers/specs/2026-05-24-aquagarden-visual-quality-design.md`.
- 물고기: CC0 GLB 5종(`src/renderer/assets/fish/`) — **스켈레탈 애니메이션**(원본 본 클립을 `AnimationMixer`로 재생, 절차적 메시·셰이더 벤딩 아님). boids 군집 + 풀링 유지.
- 조명: IBL(PMREM+RoomEnvironment) + 밝기 슬라이더가 directional/ambient/`environmentIntensity` 동시 구동.
- 분위기: 커스틱(절차적, 모래·물고기·돌 투사), 라이트 샤프트(additive), 깊이 틴트, 수중 베일(DOM 그라디언트), 소프트 기포·글로우 스프라이트.
- 진행한 phase: `phases/0-mvp`, `phases/1-visual-quality`, `phases/2-visual-polish` (모두 완료, main 병합됨).

### 진행한 phase (2026-05-25 — 브랜치 `feat-4-fish-interactions`, main 미병합)
- `phases/3-quick-fixes`(완료): 테두리 옅게, 비-물고기 투명 슬라이더, 밝기 네모 버그(원인=**라이트샤프트**, 제거함), 창 크기(모서리 드래그 리사이즈로 재설계).
- `phases/4-fish-interactions`(완료, 투과 OFF에서만): 어종/수초 레지스트리, 물고기 클릭 대사(어종당 10), 먹이주기/놀래키기.
- **다음 작업(인터랙션 UX 수정)은 `docs/HANDOFF.md` 참고** — 리사이즈 핸들 안 보임(P0), 먹이/놀래키기 활성표시(P1), 클릭 핸들러 겹침(P2) 등.

### 새우 개체 추가 (2026-05-31 — 브랜치 `feat-5-shrimp`, main 미병합)
- 블렌더 절차적 새우(아마노 새우) GLB(스켈레톤 7본+"Swim" 클립) 제작 → 앱 통합 → 미학 8/10 → **크기 1/4 축소(baseScale 0.375)** → **바닥 기는 청소부 거동(crawler)** 까지 완료. test **446**·lint·build·smoke pass. 리포트: `docs/SHRIMP_REPORT.md`.
- 새우 거동은 `SHRIMP` config 상수 + 순수 헬퍼 `crawlerHelpers.ts`(`floorBiasForce`/`scuttleSpeedFactor`) + `FishSpecies.behavior:'crawler'` 종별 분기로 구현(다른 어종 유영 경로 불변, TDD 가드). 미병합·라이브 가시성 확인은 `docs/HANDOFF.md` 최상단 참고.

### 사용자 평가 피드백 반영 (2026-07-17 — v0.8.0, 브랜치 `fix-7-eval-feedback`)
라이브 QA 기반 사용자 관점 평가에서 나온 개선 13건 반영. test **486**·lint·build·smoke pass. 요약:
- **P0 UX**: 투과 중 패널 첫 클릭이 뒤로 새는 문제(패널 펼침 동안 투과 일시 해제 — `computeMouseIgnore` 3번째 인자), 힌트 등장/소멸로 패널이 밀려 오클릭(고정 높이 단일 힌트 슬롯), 창 상단 이탈로 패널 헤더가 메뉴바에 잘림(`clampTopToWorkAreas` + 버튼 드래그 시 패널 자동 접기), 전역 복구 단축키 `SHORTCUTS.recovery`(⌥⌘A).
- **무드 강화**: 키프레임 강화(심야 0.42, 테스트 가드) + 1.5초 전환(`Lighting.update` 지수 수렴) + **비조명 요소 연동**(수초 `uMoodColor`·커스틱 `uCausticMood` — 조명만으론 체감이 안 됐던 근본 원인).
- **시각**: 캔버스 좌우 페이드(mask-composite:intersect), z유영 상한 `FISH.maxZSpeed`(정면 실루엣 억제, crawler 제외), 새우 baseScale 0.6, 말풍선 화자 꼬리.
- **절전**: `RENDER.maxFps=30` 프레임 캡(`shouldTick`) + WebGL `powerPreference:'low-power'`.
- **기타**: lure 20초 무활동 자동 해제, 도움말 항목 보강(확대·시간대·대사·단축키)·우측 정렬.

### 테마 품질 개선 phase 9 (2026-07-18 — v0.9.0로 main 병합됨)
사용자 라이브 평가("밀도 부족·테마별 지형 필요") 반영. 레퍼런스 기준: `docs/media/reference/`(CC0/PD 실사 2장+관찰 노트).
- **지형**: `terrainHelpers.sandHeightAt`(순수·결정적 — edge taper·front-flat(z>−1.5, 크롤러 보호)·마운드 높이≤0.6(물고기 클리핑 방지) TDD 가드). 다시마 숲=암반 기복+큰바위 9개, 산호초=리프 마운드 2개+모래 채널, 미니멀=무변위(하위호환).
- **다시마 군락화**: `generateKelpClusters` — 홀드패스트 18포기×4~6가닥=~86가닥, 원근 레이어(z→청록 헤이즈 색 lerp, 알파 불변), 황금-올리브 톤, leaflet 잎 실루엣.
- **산호 피복**: `generateReefColonies` — 콜로니 30+개(뭉게 마운드 주역+가지 thicket, 대20/중40/소40)를 타입×팔레트 병합 렌더. fan은 빨간 세로선 아티팩트로 제거. 분홍/마젠타+크림/골드 팔레트.
- 게이트: test **621**·lint·build·테마별 smoke·비전 채점(인증 복구, 실채점) 통과. 미결: 마운드 융기감이 높이 상한 탓에 약함(비전 hardscape 45 지적, 라이브 확인 항목).

### 배경 테마 시스템 추가 (2026-07-18 — v0.9.0로 main 병합됨)
배경(아쿠아스케이프)을 **교체형 테마 3종**으로 확장. 설계: `docs/superpowers/specs/2026-07-17-background-themes-design.md`, 하네스 `phases/8-background-themes`(step 0~6). test **572**·lint·build·smoke pass. 요약:
- **테마 3종**: 미니멀(기존 그대로, 기본값·하위호환)·다시마 숲(절차적 리본 26개, 가장자리·뒤쪽 집중 배치+버텍스 셰이더 벤딩으로 굽이침)·산호초(가지·뇌·부채 산호 클러스터+밝은 낮은 암반). `THEME` 상수(`src/shared/config.ts`)+`themeRegistry.ts`(조회·기본값·하위호환 로드)로 데이터 정의, `Aquascape.setTheme()`이 dispose→rebuild. 순수 헬퍼: `kelpHelpers.ts`(배치 폴오프·벤딩), `coralHelpers.ts`(가지 분기 트리·클러스터 배치), `rockHelpers.ts`(변위 바위 — 다시마숲 큰 바위·산호초 암반 공용).
- **UI·영속**: 패널 '배경 테마' 세그먼트(`themeSegment.ts`, `THEME_REGISTRY` 순회라 테마 추가 시 버튼 자동 반영)에서 전환, `persistence.ts`가 `themeId` 저장(미저장 시 미니멀).
- **eval 훅**: `AQUA_SMOKE_THEME=<id>`로 headless 테마 강제 전환(`window.__AQUA_APPLY_THEME__`, `health.theme` 리드백을 요청값과 대조해 불일치 시 스모크 실패). `scripts/eval_vision.py`에 `--intent "<text>"`/`--min-score N` 플래그 추가(테마별 설계 의도·임계값 override, 기존 위치 인자 호출은 하위호환 — 상세 `docs/EVAL.md`).
- **미학 조율(step6)**: 가지 산호가 마른 나뭇가지처럼 앙상해 보이던 것을 `CORAL.branch`(childCount/radiusDecay/spreadAngle) 소폭 상향으로, 부채 산호가 성게처럼 읽히던 것을 `CORAL.fan`(veinCount/veinGapRatio/fanHalfAngle/yawJitter) 소폭 조정으로 완화(캡처 비교로 확정, 컬러 팝·클러스터 중앙 트임은 원래도 양호해 그대로 둠). 패널 '다시마 숲' 라벨 2줄 줌바꿈은 한글이 공백 없이도 음절 경계에서 줄바꿈되는 특성 때문에 표시명 변경만으론 해결이 안 돼, `.cp__theme-btn`에 `white-space:nowrap`+폰트/패딩 소폭 축소로 해결.
- 라이브 QA 미검증 항목은 `docs/HANDOFF.md` "현재 상태" 참고.

### 물고기 지형 회피 + 지형 융기 반영 (2026-07-18)
phase 9의 "지형 높이를 물고기 바닥(minY −1.2) 아래로 캡핑" 접근을 역전 — **물고기가 지형을 인지하고 피해 다닌다**. 미결이던 "마운드 융기감 약함(비전 hardscape 45)" 해소.
- **회피 2층**: ①소프트 — 로컬 바닥(지형 표면+`TERRAIN_AVOID.clearance`) 기준 상승 조향(`terrainClimbForce`, 전방 예측 `lookAheadPoint`로 경사 선제 상승) + 경사 수평 우회(`terrainDeflectXZ`, 내리막 방향 — 마운드를 옆으로 돌아가기). ②하드 — 이동 후 `localFloorY`로 y 클램프(관통 원천 차단). 순수 헬퍼는 `terrainHelpers.ts`(TDD), 배선은 `Fish.update`(swim/crawler 분기 — 새우는 clearance 0으로 표면을 타고 기어오름, 미니멀=terrain null이면 기존 평면 거동 그대로).
- **주입 경로**: main.ts `applyThemeById`(테마 적용 단일 경로) → `FishSchool.setTerrain` → 전 개체(+풀 성장분).
- **지형 상향**: coral-reef 마운드 0.51/0.44→**1.5/1.2**(radius 5.6/4.6, 정점 y≈−0.37 — 카메라 y0에서 모래 지평선 −6.4°를 ~4.4° 돌파해야 융기로 읽힘, 실측 근거는 config 주석), maxHeight 1.6, crestColorStrength 0.8. kelp-forest 기복 0.26→**0.38**, maxHeight 0.85. authoring 가드는 "캡 0.6"에서 "수면 여유"(sandY+maxHeight+clearance ≤ maxY−minHeadroom)로 교체(terrainHelpers.test).
- **런타임 관통 감시**: `FishSchool.terrainClipCount`(표면 아래 감지 누적) → `health.terrainClips` → **스모크가 0을 게이트**(정적 캡처는 모션 관통을 못 봄 — headingYaw 가드와 같은 원칙).
- 게이트: test **641**(+20: 회피 헬퍼·Fish 3000틱×3시드 무관통 불변식(유효고도 1.6 스트레스 지형)·smokeEval 게이트)·lint·build·테마 3종 smoke(관통 0, 최대 341프레임×40마리) 통과. 캡처: `eval-terrain-final-compare.png`(구 vs 신), `eval-terrain-zoom.png`(융기 확대). 비전 judge는 정지컷 융기 체감을 여전히 낮게 봄(52~62, 노이즈 대역) — 모션 확인은 라이브 QA로 수행(사용자 확인: "많이 나아졌다").

### 카메라 궤도 — 드래그 회전 + 검사용 훅 (2026-07-18, v0.10.0)
사용자 요청("다른 각도에서도 보고 싶다")로 추가. 프로덕트 카메라는 여전히 정면 고정 기본이되, 궤도 회전이 가능해졌다.
- **프로덕트**: 수조 캔버스 드래그=카메라 궤도(민감도·클램프는 `CAMERA.orbit.drag` — yaw ±25°·pitch −5~30°, 2026-07-18 각도 스윕에서 무대 세트가 성립하는 범위), 더블클릭=정면 복귀(returnRate 지수 수렴), 각도는 줌과 같은 영속 패턴(`settings.cameraYaw/Pitch`, 로드 시 클램프 보정). 순수 계산 `cameraHelpers.ts`(orbitCameraPose/applyOrbitDrag/approachAngle — yaw0·pitch0·기본거리=기존 고정 카메라와 일치하는 하위호환 앵커 테스트).
- **입력 중재(CRITICAL)**: FishDialogue·FoodLure는 원래 pointerdown 즉발이라 드래그 시작마다 오발동한다 — 둘 다 `handleTap(x,y)`로 이전하고 main.ts 탭/드래그 중재(클릭 임계 `DRAG.clickThresholdPx` 재사용, pointer capture로 창 밖 추적)가 탭에서만 호출한다. 캔버스에 pointerdown 즉발 리스너를 새로 달지 말 것(같은 충돌 재발).
- **QA**: `__AQUA_SET_CAMERA__`/`AQUA_SMOKE_CAM`은 프로덕트 궤도 상태와 동기화(훅은 클램프 없음 — 무대 세트 밖 점검용). 각도 스윕 결과와 한계는 `docs/EVAL.md`·`eval-camera-angles.png`. 데브 편의: `AQUA_DEVTOOLS=1 npm run dev`가 분리형 데브툴즈를 로드 완료 후 연다(로드 전에 열면 빈 컨텍스트에 붙음).

## 런타임 eval (CRITICAL — 자기보고 불신)
**`build/test/lint` 통과만으로 "동작/표시됨"을 단정하지 마라.** 그것들은 순수 로직만 검증하며, 실제 렌더가 깨져도 통과한다(과거 셰이더 컴파일 오류가 전 항목 통과 상태로 빠져나간 사고의 원인). 시각 변경 후엔 반드시 `npm run smoke`로 실제 렌더를 검증한다. 상세: **`docs/EVAL.md`**.
- 스모크: `src/main/smoke.ts`+`smokeEval.ts` (`AQUA_SMOKE=1`). 콘솔 에러·헬스(`src/renderer/health.ts`)·`capturePage` 픽셀 분석.
- **스모크는 localStorage를 비우고 시작한다(결정적 평가).** 사용자 영속 상태를 물려받으면 개체수·투명도·무드가 세션마다 달라 캡처 비교가 무의미해진다(실제로 무드 캡처가 "무변화"로 오판된 사고). 상태 구동은 훅으로: `AQUA_SMOKE_FISH`(개체수)·`AQUA_SMOKE_BRIGHTNESS`·`AQUA_SMOKE_TRANSPARENCY`·`AQUA_SMOKE_MOOD`(+`_HOUR`, off→on 재적용·`moodHook` 리드백)·`AQUA_SMOKE_FEATURES`·`AQUA_SMOKE_OPEN_PANEL`·`AQUA_SMOKE_THEME`(배경 테마 id 강제, `health.theme` 리드백)·`AQUA_SMOKE_CAM="yaw,pitch[,dist]"`(검사용 궤도 카메라 — 씬은 정면 고정 authoring이므로 QA 전용, 렌더러 데브툴즈에선 `window.__AQUA_SET_CAMERA__(yaw,pitch,dist?)`, 인자 없이 호출하면 정면 복귀).
- 비전: `scripts/eval_vision.py` (항목별 채점, phase끝). `--intent "<text>"`/`--min-score N`로 테마별 설계 의도·임계값을 override(위치 인자 호출은 하위호환). 하네스 `scripts/execute.py`가 `"eval":true` step·phase끝에서 자동 게이트·반복.

## 렌더링 컨벤션·함정 (재발 방지 — 실제로 겪은 버그들)
- **투명 캔버스 셰이더 함정**: `THREE.Fog` 금지(불투명 안개 사각형). 풀스크린 블룸/`UnrealBloomPass` 금지(알파를 1로 강제 → 검은 배경). additive 효과는 **알파도 누적**해야 보인다(`blendSrcAlpha`를 Zero로 두면 색만 더해지고 OS premultiplied 합성에서 사라짐 — 라이트샤프트가 그랬다).
- **셰이더 청크 이름(three r184)**: 프래그먼트 출력 청크는 `#include <opaque_fragment>` (구 `output_fragment`는 없음 — `.replace`가 조용히 실패해 효과 누락).
- **커스텀 셰이더 varying 선언**: vertex에서 쓴 varying은 fragment에서도 반드시 선언(누락 시 컴파일 실패 → 무효 프로그램이 투명 패스 전체를 깨뜨려 물고기까지 미표시).
- **GLB 추출**: 노드(scene-graph) 변환을 무시하면 모델이 누운/뒤집힌 자세가 된다. 스킨 씬은 그대로 클론(SkeletonUtils)해 원본 변환·머티리얼(색)·리그를 유지한다.
- **물고기 방향**: geometry/정렬 규약은 **머리 +X**. `Fish.update`의 `headingYaw`가 +X를 속도 방향에 맞춘다. 이 "머리-선행" 불변식은 **결정적 유닛테스트(`fishHelpers.headingYaw`)로 가드**한다(정적 비전 eval은 모션 방향을 못 봄).
- **밝기↑ 시 "네모/수평선" = 반투명 평면**: 투명 오버레이 위에선 반투명/additive 평면(라이트샤프트 등)이 임의의 바탕화면 위에 사각형·수평선으로 비친다. 특히 불투명도를 밝기에 연동하면 밝기를 올릴수록 형태가 드러난다. 셰이더 페더링으로도 완전히 못 없앤다 → 라이트샤프트는 **제거**했다. (스모크는 기본 밝기·어두운 합성배경이라 이 아티팩트를 못 잡음 — 고밝기+밝은 배경 캡처로 격리 검증.)
- **비전 eval은 노이즈가 있다**: 객관적으로 보장 가능한 것(방향·깨짐·투과)은 스모크/유닛테스트로, 미적인 것만 비전으로. `fishPose`는 참고(non-critical).
- 매직넘버 금지 — `src/shared/config.ts` 상수 사용(PLANT·HARDSCAPE·CAUSTIC·WATER·GLOW 등).
