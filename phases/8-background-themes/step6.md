# Step 6: polish-docs

## 읽어야 할 파일

- `/CLAUDE.md` (갱신 대상 — "현재 구현 상태" 섹션 형식)
- `/docs/HANDOFF.md` (갱신 대상 — "현재 상태" 블록 형식: 최신 블록이 이력 위에 옴)
- `/docs/EVAL.md` (step 1에서 갱신했는지 정합 확인)
- `/README.md`·`/docs/UI_GUIDE.md` (기능 목록·패널 가이드 갱신 대상)
- `/docs/superpowers/specs/2026-07-17-background-themes-design.md` (라이브 QA 항목 근거)
- `phases/8-background-themes/index.json`의 step 0~5 `summary` 전부
- 직전 step들이 남긴 `eval-theme-*.png` 캡처들(재생성해도 됨)

## 배경

마무리 step. ① 3테마를 나란히 놓고 최종 조율(config 값만) ② 문서 정합성 갱신 ③ 하위호환 재확인. 이 step 완료 후 execute.py가 **phase 끝 자동 게이트**(스모크 + 종합 비전 임계값)를 독립 실행한다.

## 작업

1. **3테마 최종 조율** — 테마 3종 캡처를 갱신해 나란히 비교: 다시마 가림 정도, 산호 색 균형, 테마 간 밝기 일관성. 조정은 **config 값만**(코드 구조 변경 금지). 각 테마 비전 채점이 62 이상을 유지하는지 재확인.
2. **문서 갱신**
   - `CLAUDE.md` "현재 구현 상태"에 배경 테마 섹션 추가: 테마 3종·`AQUA_SMOKE_THEME` 훅·`eval_vision.py --intent/--min-score`·주요 파일(themeRegistry/kelpHelpers/coralHelpers) 요약. 기존 섹션 형식(날짜·브랜치 표기)을 따른다.
   - `HANDOFF.md` "현재 상태" 블록 갱신 + **라이브 QA 미검증 항목** 추가: ① 테마 전환 체감(리빌드 순간 프레임 드랍 여부) ② 다시마 흔들림 자연스러움(정적 캡처로 판정 불가 — 유닛테스트만 가드) ③ 산호 심야 무드 색감 체감 ④ 테마별 투명 슬라이더 체감. (라이브 QA는 사용자 동의 후 — 컴퓨터유즈는 사용자 컴퓨터를 점유.)
   - `README.md` 기능 목록에 배경 테마 1~2줄, `docs/UI_GUIDE.md`에 패널 '배경 테마' 섹션.
3. **하위호환 재확인** — 스모크는 localStorage를 비우고 시작하므로, 기본 스모크 리포트에서 적용 테마가 `minimal`인지 확인(fresh 사용자 = 미니멀). `AQUA_SMOKE_THEME` 미설정 기본 실행으로 검증.
4. (선택) 대표 캡처 3장을 `docs/media/themes/`에 커밋해 문서에서 참조.

## Acceptance Criteria

```bash
npm run test
npm run lint
npm run build
npm run smoke
AQUA_SMOKE_THEME=kelp-forest AQUA_SMOKE_SHOT=eval-theme-kelp.png AQUA_SMOKE_REPORT=eval-theme-kelp.json npm run smoke
AQUA_SMOKE_THEME=coral-reef AQUA_SMOKE_SHOT=eval-theme-coral.png AQUA_SMOKE_REPORT=eval-theme-coral.json npm run smoke
python3 scripts/eval_vision.py eval-theme-kelp.png --min-score 62 --intent "다시마 숲 테마의 투명 오버레이 수족관: 세로로 긴 다시마 리본이 좌우 가장자리와 뒤쪽에 무리지어 서 있고, 중앙은 트여 물고기가 잘 보인다. 초록-갈색의 차분한 수중림 톤."
python3 scripts/eval_vision.py eval-theme-coral.png --min-score 62 --intent "산호초 테마의 투명 오버레이 수족관: 가지·뇌·부채 산호가 암반 주변에 클러스터로 모여 있고, 밝은 산호모래 위에 주황·분홍·보라 색감이 생기 있게 어우러진다. 물고기 시야는 트여 있다."
```

## 검증 절차

1. AC 전부 종료코드 0.
2. 체크리스트:
   - 기본 스모크 리포트의 적용 테마가 `minimal`인가(fresh 하위호환)?
   - CLAUDE.md/HANDOFF의 기존 섹션 형식·정합성 유지(낡은 "미병합" 표기를 새로 만들지 않기 — HANDOFF 최신 블록이 진실)?
   - 라이브 QA 미검증 항목이 HANDOFF에 명시됐는가?
3. **eval(harness smoke + phase 비전)**: 이 step 후 phase 끝 게이트가 자동 실행된다 — 종합 비전이 임계 미달이면 phase가 error로 표시되니, 미니멀 기본 캡처 품질(기존 항목: plants/hardscape/waterAtmosphere)이 회귀하지 않았는지 미리 확인.
4. index.json step 6 상태 갱신(규칙 동일). phase 전체 완료 시 `phases/index.json`의 본 phase 항목은 execute.py가 갱신한다.

## 금지사항

- 새 기능·새 시각 요소를 추가하지 마라. 이유: 이 step은 조율·문서·정합성만.
- 비전 임계값이나 스모크 판정 로직을 완화하지 마라. 이유: 게이트 신뢰성.
- 문서의 이력(append 로그) 섹션을 삭제하지 마라. 이유: HANDOFF는 시점별 기록 + 최신 블록 구조.
- 기존 테스트를 깨뜨리지 마라.
