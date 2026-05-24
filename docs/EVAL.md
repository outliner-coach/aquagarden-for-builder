# 런타임 eval 체계

## 왜 필요한가 (해결한 갭)

하네스(`scripts/execute.py`)의 합격 판정은 원래 **에이전트가 `index.json`에 `completed`를 스스로 적는 것**에만 의존했고, AC도 `build/test/lint`뿐이었다. 이것들은 **순수 로직만** 검증한다 → 셰이더 컴파일 오류로 화면이 통째로 깨져도 전 항목 초록불로 통과했다(실제 사고). eval은 **에이전트 자기보고를 신뢰하지 않고 실제 렌더를 독립 검증**해, 깨지면 자동으로 다시 시도하게 한다.

## 3개 층

### 1. 렌더러 헬스 훅 — `src/renderer/health.ts`
- `window.__AQUA_HEALTH__ = { ready, fishActive, errors[], frames }` 노출.
- `console.error`/`window.onerror`/`unhandledrejection`을 수집(THREE 셰이더 컴파일 에러 포함).
- `main.ts`가 `markReady()`(GLB 로드 후), `setFishActive()`·`tickFrame()`(루프)로 갱신.
- 신규 렌더 기능은 필요 시 헬스에 연결.

### 2. 스모크 하니스 (객관 "깨짐" 게이트) — `src/main/smoke.ts` + `smokeEval.ts`
`AQUA_SMOKE=1`이면 `main`이 오버레이를 **숨김 창**으로 띄워:
- `webContents.on('console-message')`로 셰이더 에러·`useProgram` 무효·WebGL 경고 수집
- `__AQUA_HEALTH__` 폴링(ready·물고기 수·errors·frames)
- `capturePage` 스크린샷 → 픽셀 분석(블랭크/단색/투과 보존) + **데스크톱 대용 짙은 회색 위에 합성**해 저장(투명 PNG가 흰/크림으로 평탄화돼 비전이 오판하는 것 방지)

판정 로직 `smokeEval.ts`는 **순수 함수**(단위 테스트됨). 실패 조건: 셰이더/런타임 에러, ready 미도달, `frames`/`fishActive` 미달, 블랭크/단색, 투과 픽셀 부족(`alpha<128`을 "투과"로 간주 — 반투명 베일 포함).

실행: `npm run smoke` (= `electron-vite build && AQUA_SMOKE=1 electron .`). 산출물: `eval-report.json`, `eval-screenshot.png`(환경변수 `AQUA_SMOKE_REPORT`/`AQUA_SMOKE_SHOT`로 경로 지정).

### 3. 비전 미적 판정 (LLM) — `scripts/eval_vision.py`
스크린샷을 `reference_image.png`·설계 의도와 비교해 `claude` 멀티모달로 채점. **두 모드**:
- `mode="step"`: per-step. "깨짐 없음 + 이 step의 목표가 보이는가"만(미구현 후속 기능 감점 X).
- `mode="phase"`: phase끝. 항목별 채점(notBroken/transparency/fish/fishPose/plants/hardscape/waterAtmosphere/caustics/lightShafts) + **종합 점수 임계값**.

합불은 LLM의 `pass` 불리언이 아니라 **점수에서 결정적으로 계산**: 종합 ≥ `AQUA_EVAL_MIN_SCORE`(기본 62) AND 핵심항목(`notBroken`/`fish`) ≥ `AQUA_EVAL_CRITICAL_MIN`(기본 60). claude CLI/이미지/파싱 실패 시 `skipped`로 통과(파이프라인 차단 방지).

> **임계값을 62로 낮춘 이유**: 투명 오버레이는 '물 부피' 색을 못 가져 불투명 어항(reference) 대비 분위기 점수가 구조적으로 낮다. 단, 핵심항목은 엄격 유지.
> **`fishPose`는 참고(non-critical)**: 방향/수평유영은 결정적 유닛테스트(`fishHelpers.headingYaw`)가 더 엄격히 보장한다. 노이즈 큰 비전 fishPose를 게이트로 두면 좋은 결과를 거짓 차단한다.

## execute.py 연동
- `index.json`의 step에 `"eval": true`를 붙이면, 그 step 완료 시 execute.py가 **빌드+스모크(+per-step 비전)** 를 독립 실행. 실패하면 step을 `pending`으로 되돌리고 eval 리포트를 다음 시도 피드백으로 **최대 3회 재시도**.
- phase 끝에는 **스모크+phase 비전(종합 임계값)** 게이트. 실패 시 phase `error`로 표시·중단(해당 step을 `pending`으로 되돌려 재실행).
- 끄기: `--no-eval` 또는 `AQUA_EVAL=0`. 비전만 끄기: `AQUA_EVAL_VISION=0`.
- 주의: eval은 GPU/디스플레이 필요(로컬 macOS OK, headless CI는 xvfb 등 필요).

## 무엇을 잡고 무엇을 못 잡나
- ✅ 스모크: 셰이더/런타임 에러, 블랭크, 물고기 부재, 투과 깨짐 (객관·결정적)
- ✅ 유닛테스트: 물고기 머리-선행 방향(`headingYaw`), 기타 순수 로직
- ✅ 비전(phase): 미적 풍성함·종 구분·분위기 (주관, 노이즈 있음 — 실행마다 ±수점)
- ❌ **모션/애니메이션 자연스러움**: 단일 정적 스크린샷이라 "움직임"은 판정 불가. (그래서 자연스러운 유영은 스켈레탈 애니메이션 도입으로 직접 해결했다.)

## eval이 발견·검증한 실제 버그 (history)
셰이더 `vUv` 미선언 → 투명 패스 붕괴, `output_fragment`→`opaque_fragment`, 물고기 미표시(프리미티브 일부만 추출+색 폐기), 물고기 머리-아래(노드 변환 무시), 라이트샤프트 미표시(알파 미누적 블렌드), 꼬리-앞 유영(정면축 반전). 자세한 컨벤션은 `CLAUDE.md`의 "렌더링 컨벤션·함정" 참고.
