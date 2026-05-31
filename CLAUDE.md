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

### 새우 개체 추가 (2026-05-31 — 브랜치 `feat-5-shrimp`, main 미병합, 현재 HEAD `88a9303`)
- 블렌더 절차적 새우(아마노 새우) GLB(스켈레톤 7본+"Swim" 클립) 제작 → 앱 통합 → 미학 8/10까지 완료. test 431·lint·build·smoke pass. 리포트: `docs/SHRIMP_REPORT.md`.
- ⚠ **미완료 2건(다음 작업)**: ① 새우 크기 1/4 축소(`baseScale 1.5→0.375`) 코드 미반영, ② 새우 전용 거동(현재 다른 어종과 동일 유영) 미구현·스타일 사용자 선택 대기. 상세는 **`docs/HANDOFF.md` 최상단** 참고.

## 런타임 eval (CRITICAL — 자기보고 불신)
**`build/test/lint` 통과만으로 "동작/표시됨"을 단정하지 마라.** 그것들은 순수 로직만 검증하며, 실제 렌더가 깨져도 통과한다(과거 셰이더 컴파일 오류가 전 항목 통과 상태로 빠져나간 사고의 원인). 시각 변경 후엔 반드시 `npm run smoke`로 실제 렌더를 검증한다. 상세: **`docs/EVAL.md`**.
- 스모크: `src/main/smoke.ts`+`smokeEval.ts` (`AQUA_SMOKE=1`). 콘솔 에러·헬스(`src/renderer/health.ts`)·`capturePage` 픽셀 분석.
- 비전: `scripts/eval_vision.py` (항목별 채점, phase끝). 하네스 `scripts/execute.py`가 `"eval":true` step·phase끝에서 자동 게이트·반복.

## 렌더링 컨벤션·함정 (재발 방지 — 실제로 겪은 버그들)
- **투명 캔버스 셰이더 함정**: `THREE.Fog` 금지(불투명 안개 사각형). 풀스크린 블룸/`UnrealBloomPass` 금지(알파를 1로 강제 → 검은 배경). additive 효과는 **알파도 누적**해야 보인다(`blendSrcAlpha`를 Zero로 두면 색만 더해지고 OS premultiplied 합성에서 사라짐 — 라이트샤프트가 그랬다).
- **셰이더 청크 이름(three r184)**: 프래그먼트 출력 청크는 `#include <opaque_fragment>` (구 `output_fragment`는 없음 — `.replace`가 조용히 실패해 효과 누락).
- **커스텀 셰이더 varying 선언**: vertex에서 쓴 varying은 fragment에서도 반드시 선언(누락 시 컴파일 실패 → 무효 프로그램이 투명 패스 전체를 깨뜨려 물고기까지 미표시).
- **GLB 추출**: 노드(scene-graph) 변환을 무시하면 모델이 누운/뒤집힌 자세가 된다. 스킨 씬은 그대로 클론(SkeletonUtils)해 원본 변환·머티리얼(색)·리그를 유지한다.
- **물고기 방향**: geometry/정렬 규약은 **머리 +X**. `Fish.update`의 `headingYaw`가 +X를 속도 방향에 맞춘다. 이 "머리-선행" 불변식은 **결정적 유닛테스트(`fishHelpers.headingYaw`)로 가드**한다(정적 비전 eval은 모션 방향을 못 봄).
- **밝기↑ 시 "네모/수평선" = 반투명 평면**: 투명 오버레이 위에선 반투명/additive 평면(라이트샤프트 등)이 임의의 바탕화면 위에 사각형·수평선으로 비친다. 특히 불투명도를 밝기에 연동하면 밝기를 올릴수록 형태가 드러난다. 셰이더 페더링으로도 완전히 못 없앤다 → 라이트샤프트는 **제거**했다. (스모크는 기본 밝기·어두운 합성배경이라 이 아티팩트를 못 잡음 — 고밝기+밝은 배경 캡처로 격리 검증.)
- **비전 eval은 노이즈가 있다**: 객관적으로 보장 가능한 것(방향·깨짐·투과)은 스모크/유닛테스트로, 미적인 것만 비전으로. `fishPose`는 참고(non-critical).
- 매직넘버 금지 — `src/shared/config.ts` 상수 사용(PLANT·HARDSCAPE·CAUSTIC·WATER·GLOW 등).
