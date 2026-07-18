# Step 4: coral

## 읽어야 할 파일

- `/CLAUDE.md` (렌더링 함정 — 특히 additive/반투명 평면·varying)
- `/docs/superpowers/specs/2026-07-17-background-themes-design.md` §3.3 (산호 3종 + 격상 경로)
- `src/renderer/entities/Aquascape.ts` (그래스/켈프 카드 셰이더 경로, `_buildHardscape`의 머티리얼 등록 흐름)
- `src/renderer/entities/kelpHelpers.ts`·`rockHelpers`(step 2·3 산출 — 변위 헬퍼 재사용)
- `src/shared/config.ts` (`THEME`·`KELP`)
- `/docs/EVAL.md` (비전 채점·심야 무드 캡처 훅)
- `phases/8-background-themes/index.json`의 step 0~3 `summary`

## 배경

산호초 테마를 완성하는 step. 산호 3종을 **절차적으로 1차 구현**하고, 테마 전용 비전 채점(≥62)을 통과할 때까지 형태·색·배치를 조정한다. 절차적 품질이 한계면(3회 소진) **격상 경로**(블렌더 절차 GLB — `docs/SHRIMP_REPORT.md` 파이프라인, 또는 CC0 소싱)를 error_message에 권고로 남긴다 — 격상 자체는 사용자 결정이므로 이 step에서 임의로 진행하지 않는다.

산호색은 무드 틴트와 **곱연산**되므로 심야(23.5h)에 탁해질 수 있다 — 심야 캡처 확인이 AC에 포함된다.

## 작업

1. **`src/renderer/entities/coralHelpers.ts` 신설 (순수 함수, TDD 선행)**
   - `generateBranchCoral(seed: number, params: { depth: number; childCount: [min,max]; spreadAngle: number; lengthDecay: number; radiusDecay: number }): BranchSpec[]`
     - `BranchSpec = { start: [x,y,z]; end: [x,y,z]; radius: number }` 평탄 리스트. 재귀 분기(depth 2~3).
     - 테스트: 같은 시드 → 동일 출력 / 자식 `start` === 부모 `end`(연결성) / radius·길이가 깊이에 따라 단조 감소 / 분기 수가 childCount 범위와 depth 공식에 부합.
   - `generateCoralClusters(seed, count, area): ClusterSpec[]` — 클러스터 배치 + 타입 믹스(branch/brain/fan) + 팔레트 인덱스. 결정성·area 내 테스트.
2. **렌더 (`Aquascape._buildCoral(cfg)`)**
   - **가지 산호**: BranchSpec들을 `CylinderGeometry(radialSegments 5)`로 만들어 **병합**(three `BufferGeometryUtils.mergeGeometries` — 클러스터당 드로우콜 1). `MeshStandardMaterial`(roughness ~0.8) + caustic/depth 헬퍼 + `_opaqueMaterials` 등록.
   - **뇌 산호**: 반구(`SphereGeometry(..., thetaLength π/2)`) + step 3 변위 헬퍼(작은 strength·고빈도 파라미터) — flat 아닌 smooth 셰이딩으로 둥글게.
   - **부채 산호**: 켈프/그래스 카드 경로 재사용 — 부채꼴+잎맥 컷 알파 캔버스 텍스처, 스웨이 진폭은 아주 작게. 머티리얼은 `_grassMaterials` 편승(무드/투명 자동).
   - 초기 팔레트: 주황 `0xff7a4d`·분홍 `0xff6f9c`·보라 `0x9d6bff`(config 상수로, 채점 보며 조정).
3. **THEME `coral-reef` 완성** — 밝은 산호모래(초기 `0xd8c9a8`), 카펫 수초 축소, 암반(step 3) + 산호 클러스터 3~5. 모든 수치 config.
4. **미학 반복** — 산호초 캡처 → 비전 채점 → 형태 파라미터(spreadAngle·radiusDecay·팔레트·클러스터 배치) 조정 반복. 이 반복이 이 step의 본질 작업이다.

## Acceptance Criteria

```bash
npm run test
npm run lint
npm run build
npm run smoke
AQUA_SMOKE_THEME=coral-reef AQUA_SMOKE_SHOT=eval-theme-coral.png AQUA_SMOKE_REPORT=eval-theme-coral.json npm run smoke
AQUA_SMOKE_THEME=coral-reef AQUA_SMOKE_MOOD=1 AQUA_SMOKE_MOOD_HOUR=23.5 AQUA_SMOKE_SHOT=eval-theme-coral-night.png AQUA_SMOKE_REPORT=eval-theme-coral-night.json npm run smoke
AQUA_SMOKE_THEME=coral-reef AQUA_SMOKE_BRIGHTNESS=1 AQUA_SMOKE_SHOT=eval-theme-coral-bright.png AQUA_SMOKE_REPORT=eval-theme-coral-bright.json npm run smoke
python3 scripts/eval_vision.py eval-theme-coral.png --min-score 62 --intent "산호초 테마의 투명 오버레이 수족관: 가지·뇌·부채 산호가 암반 주변에 클러스터로 모여 있고, 밝은 산호모래 위에 주황·분홍·보라 색감이 생기 있게 어우러진다. 물고기 시야(중앙)는 트여 있고 산호가 화면을 과하게 채우지 않는다."
```

## 검증 절차

1. AC 전부 종료코드 0 (`npm run smoke` 단독 = 미니멀 무회귀).
2. 체크리스트:
   - 가지 산호가 클러스터당 병합 지오메트리인가(개별 실린더 수십 개 드로우콜 아님)?
   - 산호가 `_opaqueMaterials` 또는 `_grassMaterials` 중 알맞은 쪽에 등록돼 투명 슬라이더·무드가 동작하는가?
   - 심야 캡처(`eval-theme-coral-night.png`)에서 산호가 완전히 죽은 회색으로 탁해지지 않는가? 탁하면 팔레트 채도/명도를 조정.
   - 고밝기 캡처에서 사각형/수평선 아티팩트 없음(부채 산호 카드 포함, 필요시 `AQUA_SMOKE_BG` 밝은 배경 합성으로 재확인)?
3. **eval(harness smoke + step 비전)**: 산호초 캡처 62점 이상.
4. **격상 판정**: 3회 시도에도 62 미달이면 `error`로 종료하되, `error_message`에 최종 점수·부족 항목·"블렌더 절차 GLB(SHRIMP_REPORT 파이프라인) 또는 CC0 소싱 격상 권고"를 명시한다(자동 격상 금지 — 사용자 결정).
5. index.json step 4 상태 갱신(규칙 동일).

## 금지사항

- 외부 GLB 다운로드/추가를 이 step에서 하지 마라. 이유: 격상은 사용자 결정 사항 — 절차적 1차가 이 step의 범위.
- additive 블렌딩·반투명 대형 평면·`UnrealBloomPass` 금지. 이유: 투명 오버레이 함정.
- 다시마 숲·미니멀 테마 구성을 바꾸지 마라. 이유: scope(무회귀는 AC 가드).
- 비전 임계값(62)을 낮춰 통과시키지 마라. 이유: 게이트 신뢰성 — 미달이면 격상 권고로 종료가 정상 경로.
- `Math.random` 금지, 기존 테스트 파괴 금지.
