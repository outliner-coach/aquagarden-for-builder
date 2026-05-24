# Step 0: hardscape-richness

## 읽어야 할 파일

- `/docs/superpowers/specs/2026-05-24-aquagarden-visual-quality-design.md` (§3.3 하드스케이프, "풍성하게")
- `/CLAUDE.md` (매직넘버 금지→config, 레이어 규칙, hidden 시 렌더 정지)
- `/reference_image.png` (참고 톤 — 1:1 복제 아님)
- `src/renderer/entities/Aquascape.ts` (`_buildHardscape`, 절차적 유목 `createDriftwoodGeometry`)
- `src/renderer/entities/aquascapeHelpers.ts` (`generateHardscape`) + `__tests__`
- `src/shared/config.ts` (`HARDSCAPE`)

## 작업

비전 eval에서 hardscape 점수가 가장 낮다(바위·유목이 작고 식별이 어렵다). 바닥의 바위·유목을 **더 크고 풍성하며 또렷하게** 만든다. 단 물고기 유영 공간(상단)을 가리지 않게 하단에 둔다.

1. `HARDSCAPE`(config) 조정: 바위 크기(minScale/maxScale)와 개수를 키우되 과밀하지 않게. 유목을 더 크고 1~2개 더. 색 대비를 약간 높여 모래 위에서 식별되게.
2. `generateHardscape` 배치가 자연스러운 군락(클러스터)을 이루도록(완전 랜덤 산포 X) — 순수 함수 유지, 결정적.
3. 유목 형태(`createDriftwoodGeometry`)가 너무 가늘면 두께/굽이를 보강.
4. 매직넘버 금지 — `HARDSCAPE` 상수로.

## Acceptance Criteria

```bash
npm run test
npm run build
npm run lint
npm run smoke   # AQUA_SMOKE headless 런타임 검증 (셰이더/렌더 깨짐·물고기·투과·블랭크)
```

## 검증 절차

1. AC 4개 모두 종료코드 0. `npm run smoke`가 pass(eval-report.json) 여야 한다.
2. `generateHardscape` 순수 함수 테스트(결정성·범위·높이상한) 통과 유지/보강.
3. 체크리스트:
   - 바위·유목이 모래 위에서 또렷이 보이는가? 군락이 자연스러운가?
   - 모두 하단에 한정돼 물고기 시야를 가리지 않는가?
   - 외부 이미지/GLB 없이 절차적인가?
   - 매직넘버 대신 config를 썼는가? 기존 테스트 유지?
4. **런타임 eval 게이트**: execute.py가 이 step 완료 후 스모크+비전(자세) eval을 자동 실행한다. 통과해야 다음으로 넘어간다(실패 시 자동 재시도).
5. `phases/2-visual-polish/index.json`의 step 0 갱신: 성공→`completed`+`summary`. 3회 실패→`error`+`error_message`. 사용자 개입 필요→`blocked`+`blocked_reason`.

## 금지사항

- 하드스케이프를 높게/빽빽하게 만들어 물고기 시야를 가리지 마라. 이유: requirement §3 시선은 물고기에.
- 외부 텍스처/모델 파일 추가 금지. 이유: 번들 단순 유지(절차적으로 충분).
- 물고기/수초/커스틱/물 효과 로직을 바꾸지 마라. 이유: 각각 다른 step/이미 완료.
- 기존 테스트를 깨뜨리지 마라.
