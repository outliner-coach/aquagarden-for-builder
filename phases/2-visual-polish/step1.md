# Step 1: plants-richness

## 읽어야 할 파일

- `/docs/superpowers/specs/2026-05-24-aquagarden-visual-quality-design.md` (§3.3 수초 — 알파컷아웃 카드+버텍스 스웨이+인스턴싱, "풍성하게")
- `/CLAUDE.md` (수초는 버텍스 셰이더 애니메이션, 매직넘버 금지)
- `/requirement.md` (§3 낮은 수초·물고기 시야 보존, §7 버텍스 셰이더)
- `/reference_image.png` (참고 톤)
- `src/renderer/entities/Aquascape.ts` (`_buildGrassCards`, `GRASS_CARD_VERT/FRAG`, `createGrassCardGeometry`, `createLeafAlphaTexture`)
- `src/renderer/entities/aquascapeHelpers.ts` (`generatePlantInstances`, `swayHeightFactor`) + `__tests__`
- `src/shared/config.ts` (`PLANT`)

## 작업

비전 eval에서 plants가 낮다(작고 단조롭다). 수초를 **더 밀집·다양·풍성**하게 만든다. 단 물고기 유영 공간(상단)을 가리지 않게 낮게 유지하고, 흔들림은 반드시 버텍스 셰이더로 한다.

1. `PLANT.species`(config): 군락 개수(count)와 높이/스케일을 늘려 풍성하게. 종(레이어)을 더 다양하게(색·높이 변주 폭 확대). 단 maxHeight는 시야 보존 한도 내.
2. 카드 형태(`createGrassCardGeometry`) 다양화(교차 quad 수, 폭)로 잎이 더 자연스럽게. 잎 알파 텍스처를 약간 다듬어도 좋다(여전히 CanvasTexture, 외부 파일 금지).
3. 버텍스 스웨이를 더 살아있게(끝만 흔들림 유지, 높이가중) 미세 튜닝.
4. `generatePlantInstances`/`swayHeightFactor`는 순수·결정적 유지.

## Acceptance Criteria

```bash
npm run test
npm run build
npm run lint
npm run smoke
```

## 검증 절차

1. AC 4개 종료코드 0. `npm run smoke` pass.
2. aquascapeHelpers 순수 함수 테스트(배치 결정성·범위, swayHeightFactor) 통과 유지.
3. 체크리스트:
   - 수초가 더 풍성·다양해 보이는가? 끝만 흔들리고 루트 고정인가?(버텍스 셰이더)
   - 물고기 유영 공간(상단)을 가리지 않는가?
   - `InstancedMesh`로 드로우콜 절약, `alphaTest`로 정렬 비용 회피 유지?
   - 외부 이미지 에셋 추가 안 함? 매직넘버 대신 config?
4. **런타임 eval 게이트**: 완료 후 execute.py가 스모크+비전 eval 자동 실행, 통과해야 진행.
5. `phases/2-visual-polish/index.json`의 step 1 갱신(completed/error/blocked 규칙 동일).

## 금지사항

- 정점 흔들림을 CPU(JS 루프)에서 계산하지 마라. 이유: requirement §7.
- 수초를 높고 빽빽하게 해 물고기 시야를 가리지 마라. 이유: 시선은 물고기에.
- 외부 텍스처 파일 추가 금지(CanvasTexture/절차적).
- 물고기/하드스케이프/커스틱/물 효과 로직을 바꾸지 마라.
- 기존 테스트를 깨뜨리지 마라.
