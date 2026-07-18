# Step 2: coral-density — 리프 피복·뭉게 마운드 산호

## 읽어야 할 파일

- `/CLAUDE.md` (렌더링 함정)
- `docs/media/reference/README.md` + **`ref-coral-reef.jpg`(Read로 반드시 볼 것 — 이 step의 목표 화면)**
- `src/renderer/entities/coralHelpers.ts`·`Aquascape.ts`(`_buildCoral`), `terrainHelpers.ts`(step 0 — 마운드 표면 높이 `sandHeightAt`)
- `src/shared/config.ts`(CORAL·THEME coral-reef), phases/9-theme-quality/index.json의 step 0·1 summary

## 배경 (사용자 피드백 + 레퍼런스 관찰)

사용자 평가: 밀도가 낮다. 현재 5클러스터가 맨모래에 띄엄띄엄 — 레퍼런스(Palmyra)는:
1. **리프 피복**: 산호가 리프 마운드 표면을 **수십 개 콜로니로 빈틈없이 뒤덮는다**. 맨모래는 마운드 주변 채널로만.
2. **주역 형태 = 뭉게 마운드(cauliflower)**: 분홍/마젠타 nub 덩어리 돔이 다수. 가지/부채는 조연.
3. **크기 다양성**: 대형 몇 개 + 중소형 다수가 겹치듯 인접.
4. **색 분포**: 분홍/마젠타 다수 + 크림/골드 + 라벤더 소수(현 팔레트에 크림/골드 추가).

## 작업

1. **뭉게 마운드 산호 타입 추가** — 기존 뇌 산호 변위 반구를 발전: nub 노이즈를 더 굵고 깊게(displaceRockPositions 고빈도·strength ↑ 또는 전용 nub 변위), 반구 여러 개 클램프 병합으로 뭉게 실루엣. `coralHelpers`에 타입 `'mound'` 추가(TDD: 결정성·크기 분포).
2. **리프 피복 배치** — `generateCoralClusters`를 확장해 **step 0 마운드 표면 위에** 콜로니를 뿌린다: `sandHeightAt(x,z)`로 y를 지형에 스냅, 마운드 반경 내 밀집 배치(마운드당 12~20 콜로니, 마운드 2개 + 채널 가장자리 소수 = **총 30~45 콜로니**). 크기 분포: 대형(기존 스케일) 20% / 중형 40% / 소형 40%. 타입 믹스: mound 50%·branch 20%·brain 15%·fan 15%.
3. **성능**: 콜로니 지오메트리는 타입·팔레트별로 **병합**(mergeGeometries)해 드로우콜을 타입×색 수준으로 유지(개별 mesh 30개 금지). fan은 기존 InstancedMesh 확장.
4. **팔레트**: 분홍/마젠타 비중 ↑ + 크림/골드 `0xf0e0b8`대 추가, 라벤더는 소수로. emissive 0.3 규약 유지(심야 색조).
5. 모든 수치 config. 미학 반복을 **레퍼런스처럼 "리프가 살아있다"고 읽힐 때까지**(피복감·크기 다양성·색 분포) 수행. 중앙 물고기 스테이지는 유지.

## Acceptance Criteria

```bash
npm run test
npm run lint
npm run build
npm run smoke
AQUA_SMOKE_THEME=coral-reef AQUA_SMOKE_SHOT=eval-theme-coral.png AQUA_SMOKE_REPORT=eval-theme-coral.json npm run smoke
AQUA_SMOKE_THEME=coral-reef AQUA_SMOKE_MOOD=1 AQUA_SMOKE_MOOD_HOUR=23.5 AQUA_SMOKE_SHOT=eval-theme-coral-night.png AQUA_SMOKE_REPORT=eval-theme-coral-night.json npm run smoke
AQUA_SMOKE_THEME=coral-reef AQUA_SMOKE_BRIGHTNESS=1 AQUA_SMOKE_SHOT=eval-theme-coral-bright.png AQUA_SMOKE_REPORT=eval-theme-coral-bright.json npm run smoke
python3 scripts/eval_vision.py eval-theme-coral.png docs/media/reference/ref-coral-reef.jpg --min-score 62 --intent "산호초: 솟은 리프 마운드 표면을 30개 이상의 콜로니(뭉게 마운드 다수+가지/뇌/부채)가 뒤덮고, 분홍·마젠타 중심에 크림·골드가 섞임. 크기 다양. 모래는 채널로만. 중앙 물고기 시야 확보."
```

## 검증 절차

1. AC 전부 종료코드 0 (미니멀 무회귀 포함). 스모크 리포트 frames 급감 없음(병합 드로우콜 확인).
2. 캡처와 `ref-coral-reef.jpg`를 **나란히 Read** 비교: 피복감(맨모래 아님)/뭉게 주역/크기 다양성/색 분포 4가지가 읽히는가. 심야 캡처에서 색조 유지, 고밝기 캡처 아티팩트 없음.
3. index.json step 2 갱신 후 커밋: `feat(9-theme-quality): step 2 — coral-density`.
4. **phase 마감은 오케스트레이터가 수행**(HANDOFF/CLAUDE.md 문서 갱신 포함) — 이 step에서 문서는 건드리지 않는다.

## 금지사항

- 다시마 숲·미니멀 구성 변경 금지. 외부 GLB 다운로드 금지(절차적 범위).
- 콜로니를 개별 Mesh 수십 개로 만들지 마라. 이유: 드로우콜 폭증 — 병합/인스턴싱 필수.
- additive·반투명 대형 평면 금지, `Math.random` 금지, 기존 테스트 파괴 금지.
