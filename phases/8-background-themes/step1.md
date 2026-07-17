# Step 1: theme-eval-hooks

## 읽어야 할 파일

- `/CLAUDE.md` (런타임 eval 규칙 — 자기보고 불신, 스모크는 localStorage를 비움)
- `/docs/EVAL.md` (3층 eval 구조 — 갱신 대상이기도 함)
- `src/main/smoke.ts` (**AQUA_SMOKE_MOOD 훅 패턴** — env 읽기 → executeJavaScript로 renderer 구동 → 리드백 검증. 헤더 주석의 env 문서 형식도 참고)
- `src/main/smokeEval.ts` (판정 순수 함수 — 단위 테스트됨. 실패 케이스 추가 위치)
- `src/renderer/main.ts` (`__AQUA_MOOD_HOUR__` 수신부 — 테마 훅도 같은 방식)
- `src/renderer/health.ts` (`window.__AQUA_HEALTH__` — theme 리드백 필드 추가 대상)
- `scripts/eval_vision.py` (CLI `main()` — 플래그 확장 대상. `judge_visual`은 이미 `intent` 파라미터 보유)
- `src/renderer/entities/themeRegistry.ts` (step 0 산출 — 유효 테마 id 목록)
- `phases/8-background-themes/index.json`의 step 0 `summary`

## 배경

이후 step(2·4·6)의 AC가 "테마별 스모크 + 테마별 비전 채점" 커맨드를 사용한다. 이 step이 그 인프라를 만든다.

물고기 위치가 실행마다 달라 **단순 캡처 diff로는 테마 전환을 검증할 수 없다** → 적용된 테마 id를 health로 **리드백**해 요청값과 대조한다(무드 off→on 재적용·`moodHook` 리드백과 같은 선례). 이 시점의 kelp-forest/coral-reef는 모래색·바위 구성 차이만 있는 상태라, 스모크는 "전환이 실제 적용됨(리드백 일치) + 무깨짐"만 보장하면 된다. 미학은 step 2/4의 비전 게이트가 담당.

## 작업

1. **renderer — 테마 리드백 + 강제 훅**
   - `health.ts`: `__AQUA_HEALTH__`에 `theme: string`(적용된 테마 id) 필드 추가. `main.ts`에서 초기 적용·`setTheme` 시 갱신.
   - 스모크 전용 강제 훅: `AQUA_SMOKE_MOOD`의 `__AQUA_MOOD_HOUR__` 패턴과 일관된 방식으로, smoke가 renderer에 테마 적용을 지시할 수 있는 전역 훅(예: `window.__AQUA_APPLY_THEME__(id)`)을 노출. 존재하지 않는 id는 무시하고 콘솔 경고(스모크가 에러로 잡지 않도록 `console.warn`).

2. **`src/main/smoke.ts` — `AQUA_SMOKE_THEME` env**
   - 값이 있으면 위 훅 호출 → settle 후 캡처(기존 무드 훅 처리 흐름과 동일한 위치·순서).
   - 헤더 주석 env 문서에 `AQUA_SMOKE_THEME` 한 줄 추가.

3. **`src/main/smokeEval.ts` — 리드백 판정**
   - 판정 입력에 "요청 테마 id"와 "health.theme"을 추가하고, **요청했는데 불일치면 fail** 케이스를 순수 함수에 추가. 단위 테스트(요청 없음/일치/불일치 3케이스 이상).

4. **`scripts/eval_vision.py` — CLI 플래그 확장** (execute.py는 수정하지 않는다)
   - `--intent "<text>"`: 기본 `DEFAULT_INTENT`를 대체해 `judge_visual`의 `intent`로 전달.
   - `--min-score N`: 이 실행의 종합 임계값을 override(`AQUA_EVAL_MIN_SCORE`보다 우선).
   - **기존 위치 인자 호출(`eval_vision.py <shot> [reference]`) 하위호환 유지** — execute.py가 이 형식으로 호출한다.

5. **`docs/EVAL.md` 갱신** — `AQUA_SMOKE_THEME` 훅과 `--intent`/`--min-score` 플래그를 3~5줄로 문서화.

## Acceptance Criteria

```bash
npm run test
npm run lint
npm run build
AQUA_SMOKE_THEME=minimal npm run smoke
AQUA_SMOKE_THEME=kelp-forest AQUA_SMOKE_SHOT=eval-theme-kelp.png AQUA_SMOKE_REPORT=eval-theme-kelp.json npm run smoke
AQUA_SMOKE_THEME=coral-reef AQUA_SMOKE_SHOT=eval-theme-coral.png AQUA_SMOKE_REPORT=eval-theme-coral.json npm run smoke
python3 scripts/eval_vision.py eval-theme-kelp.png --min-score 0
```

(마지막 커맨드는 플래그 파싱·하위호환 확인용 — claude CLI 부재 시 skipped 통과가 정상.)

## 검증 절차

1. AC 전부 종료코드 0.
2. 체크리스트:
   - 테마 리드백 불일치가 실제로 fail을 내는가? (smokeEval 단위 테스트로 가드 — 일부러 유령 id를 요청하는 케이스 포함)
   - `AQUA_SMOKE_THEME` 미설정 시 기존 스모크 동작이 완전히 동일한가?
   - eval_vision.py를 위치 인자만으로 호출했을 때(구 형식) 동작이 변하지 않았는가?
3. **eval(harness smoke)**: 기본 스모크 무회귀.
4. index.json step 1 상태 갱신(규칙은 step 0과 동일).

## 금지사항

- `scripts/execute.py`를 수정하지 마라. 이유: 게이트 러너 자체를 바꾸면 검증의 신뢰성이 훼손된다 — 테마별 게이트는 step AC 커맨드로 충분.
- 비전 판정의 기본 임계값(62)·핵심항목 로직을 바꾸지 마라. 이유: 기존 phase 게이트와의 정합.
- 스모크의 localStorage 초기화(결정적 평가)를 우회하지 마라. 이유: 사용자 영속 상태가 끼면 캡처 비교가 무의미(과거 사고).
- 기존 테스트를 깨뜨리지 마라.
