# Step 1: glass-edge-softening

## 읽어야 할 파일

- `/CLAUDE.md` (매직넘버 금지 — `src/shared/config.ts` 상수 사용)
- `src/renderer/entities/Aquascape.ts` (`GLASS_EDGE_OPACITY` 상수, `_buildGlassEdge()` — 상/하단 흰 `THREE.Line`)
- `src/shared/config.ts` (상수 추가 위치)
- `/reference_image.png` (유리 박스 엣지가 아주 미묘하다 — 과하지 않게)

## 작업

화면 상/하단의 유리 테두리(흰 라인) 하이라이트가 지금보다 더 **연하고 옅게** 보여야 한다.

1. `Aquascape.ts` 파일 상단의 모듈 상수 `GLASS_EDGE_OPACITY = 0.12`를 `src/shared/config.ts`로 옮긴다. 예: `AQUASCAPE.glassEdgeOpacity`(기존 `AQUASCAPE` 객체에 필드 추가). `Aquascape.ts`는 config에서 import해 사용.
2. 값을 더 옅게 낮춘다(예: 0.12 → 0.05 부근). 완전히 0으로 만들지는 말 것 — "유리 박스" 느낌을 미세하게 남긴다(레퍼런스 의도).
3. 상/하단 라인 둘 다 동일 머티리얼 opacity를 쓰므로 한 곳만 바꾸면 된다.

## Acceptance Criteria

```bash
npm run test
npm run build
npm run lint
npm run smoke
```

## 검증 절차

1. AC 4개 종료코드 0. `npm run smoke` pass(투과 보존·블랭크 아님).
2. 체크리스트:
   - 테두리 라인이 이전보다 눈에 띄게 옅어졌는가? (0은 아님)
   - 값이 `config.ts` 상수로 이동했는가?(매직넘버 제거)
   - 다른 시각 요소(모래/수초/물고기)는 그대로인가?
3. **런타임 eval 게이트**: execute.py가 스모크 자동 실행(per-step). 통과해야 `completed`.
4. `phases/3-quick-fixes/index.json`의 step 1 갱신(성공 `completed`+`summary`, 실패 규칙 동일).

## 금지사항

- opacity를 0으로 만들어 라인을 완전히 제거하지 마라. 이유: 미세한 유리 엣지는 의도된 룩(PRD 비주얼 레퍼런스). 옅게만.
- 테두리 외 다른 머티리얼/지오메트리를 건드리지 마라. 이유: scope 최소화(이 step은 테두리만).
- 매직넘버를 코드에 직접 두지 마라(config 상수 사용).
- 기존 테스트를 깨뜨리지 마라.
