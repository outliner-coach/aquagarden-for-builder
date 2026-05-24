# Step 4: hardscape-sand

## 읽어야 할 파일

- `/docs/superpowers/specs/2026-05-24-aquagarden-visual-quality-design.md` (§3.3 하드스케이프·모래 — 돌/유목 추가, 모래 색·노멀 변주, "풍성하게")
- `/docs/ADR.md` (ADR-002 투명, 경량 우선)
- `/CLAUDE.md` (매직넘버 금지→config, 레이어 규칙)
- `/requirement.md` (§3 바닥재·작은 바위, 미니멀하지만 이번 결정은 "좀 더 풍성하게")
- `src/renderer/entities/Aquascape.ts` (step 0에서 sand/rocks가 lit로 전환됨, step 3에서 grass가 카드로 교체됨 — 이번엔 모래 디테일 + 유목/바위 군락 확장)
- `src/renderer/entities/aquascapeHelpers.ts` + `__tests__` (배치 헬퍼)
- `src/shared/config.ts` (AQUASCAPE 상수)

## 작업

하드스케이프(돌·유목)와 모래 바닥의 디테일을 올려 바닥을 풍성하게 한다. 단 모두 하단에 낮게 배치해 물고기 시야는 보존한다.

1. **모래 디테일**
   - step 0에서 lit(MeshStandard/Lambert)로 바뀐 모래에 (a) 미세한 색 변주(버텍스 컬러 또는 노이즈 기반 약한 색 그라디언트)와 (b) 약한 노멀맵(코드 생성 노멀 텍스처 또는 절차적 노멀)으로 표면 요철감을 준다.
   - 외부 이미지 에셋 금지: `CanvasTexture` 또는 절차적 노이즈로 노멀/색을 만든다.
   - 커스틱이 모래에 투사될 자리이므로(step 5), 모래 머티리얼은 커스틱 셰이더 주입이 가능하도록 둔다(과한 반짝임 X).

2. **바위 군락 확장**
   - 기존 ROCKS/PEBBLES를 늘려 자연스러운 군락(여러 크기, 결정적 시드 배치)으로. lit 재질로 음영. 색 변주 약간.

3. **유목(driftwood) 추가**
   - 유목 1~2개를 절차적으로(가늘고 긴 실린더/구부린 형태의 조합, 또는 단순 가지 형태) 만든다. 외부 GLB 없이 코드 생성.
   - 갈색 계열 lit 재질. 수초/물고기와 자연스럽게 어울리게 하단~중하단 배치, 시야 보존.

4. **순수 헬퍼 (TDD 먼저)** — `aquascapeHelpers.ts`에 추가
   - `generateHardscape(seed, area): { rocks: Placement[]; driftwood: Placement[] }` — 결정적 배치(위치/스케일/회전), y·z 범위로 하단 한정.
   - `Placement` 타입과 범위 제약을 테스트로 검증(결정성, 시야 보존을 위한 높이 상한).
   - `__tests__/aquascapeHelpers.test.ts`에 추가.

## Acceptance Criteria

```bash
npm run test
npm run build
npm run lint
```

## 검증 절차

1. AC 3개 종료코드 0. generateHardscape 테스트(결정성·범위) 통과.
2. `npm run dev` **수동 확인**: (a) 모래에 미세한 요철·색감이 보이고(단조로운 단색 아님), (b) 바위 군락 + 유목이 추가돼 바닥이 풍성하며, (c) 모두 하단에 낮게 있어 물고기 유영 공간을 가리지 않고, (d) 조명/그림자가 자연스럽고 투명 배경 유지.
3. 아키텍처 체크리스트:
   - 매직넘버 대신 config/헬퍼를 썼는가?
   - 배치가 순수·결정적이며 테스트되는가?
   - 외부 이미지/GLB 에셋을 추가하지 않았는가?(절차적/CanvasTexture)
   - 하드스케이프가 하단에 한정돼 시야를 보존하는가?
4. `phases/1-visual-quality/index.json`의 step 4 갱신:
   - 성공 → `completed` + `summary`에 "모래 색·노멀 변주(절차적), 바위 군락 확장, 절차적 유목 추가, generateHardscape 순수함수+테스트, 커스틱 주입 대비 모래 머티리얼 준비" 요약.
   - 실패 3회 → `error`. 사용자 개입 → `blocked`.

## 금지사항

- 하드스케이프를 높게/빽빽하게 배치하지 마라. 이유: 물고기 시야 보존(requirement §3).
- 외부 텍스처/모델 파일을 추가하지 마라. 이유: 번들 단순 유지(절차적으로 충분).
- 물고기/수초 카드(step 3)/커스틱(step 5)/물 효과를 건드리지 마라.
- 모래를 과하게 반짝이게(metalness 높게) 만들지 마라. 이유: step 5 커스틱과 겹쳐 과해진다.
- 기존 테스트를 깨뜨리지 마라.
