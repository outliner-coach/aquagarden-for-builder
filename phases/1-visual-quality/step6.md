# Step 6: water-atmosphere

## 읽어야 할 파일

- `/docs/superpowers/specs/2026-05-24-aquagarden-visual-quality-design.md` (§3.4 물 분위기 — 깊이 틴트(THREE.Fog 금지), 라이트 샤프트)
- `/docs/ADR.md` (ADR-002 투명 — 검증된 함정)
- `/CLAUDE.md` (매직넘버 금지, 순수 분리)
- `src/renderer/core/SceneRoot.ts` (scene/카메라 — 깊이 기준)
- `src/renderer/entities/Fish.ts`, `Aquascape.ts` (onBeforeCompile에 깊이 틴트 주입 대상)
- `src/renderer/lighting/lightingHelpers.ts` 또는 신규 헬퍼 (순수 매핑)
- `src/shared/config.ts`

## 작업

물속에 있는 듯한 분위기를 투명 창을 깨지 않고 만든다. **THREE.Fog는 쓰지 않는다**(투명 배경에서 불투명 안개 사각형 + ShaderMaterial 무시 문제). 대신 깊이 기반 색 틴트 + 알파 페이드를 셰이더에 주입하고, 위에서 내려오는 라이트 샤프트를 더한다.

1. **물 깊이 틴트 (THREE.Fog 대체)**
   - 물고기·아쿠아스케이프 머티리얼의 `onBeforeCompile`(이미 step 2/5에서 사용 중)에 깊이 기반 처리를 추가:
     - (a) 카메라로부터의 거리(view-space depth)에 따라 표면색을 틸(teal) 워터 색으로 lerp.
     - (b) 먼 지오메트리는 **알파를 낮춰** 바탕화면으로 자연스럽게 페이드(불투명 색으로 페이드 금지 — 투명 가장자리 클린 유지).
   - 틸 색·시작/끝 거리·최대 페이드는 config 상수로.

2. **라이트 샤프트(god rays)**
   - 위에서 비스듬히 내려오는 반투명 cone/quad 평면 2~3장을 추가. `AdditiveBlending`, `depthWrite:false`, 부드러운 수직 그라디언트(위 밝고 아래 사라짐).
   - UV 또는 위치를 아주 천천히 드리프트시켜 미세하게 일렁이게(`uTime`).
   - 물고기·수초를 가리지 않도록 얇고 은은하게. 밝기 슬라이더와 연동(어두울 때 약하게).

3. **순수 헬퍼 (TDD 먼저)**
   - `depthToWaterTint(depth, near, far): { mix: number; alpha: number }` — 깊이→틴트 혼합비·알파 계수. 순수·단조·클램프.
   - 샤프트 드리프트 오프셋 계산도 필요시 순수 함수로.
   - `__tests__`에 테스트 먼저: 경계(near→mix 0, far→mix 최대), 클램프, 단조성.

## Acceptance Criteria

```bash
npm run test
npm run build
npm run lint
```

## 검증 절차

1. AC 3개 종료코드 0. depthToWaterTint 등 순수 함수 테스트 통과.
2. `npm run dev` **수동 확인**: (a) 먼 쪽 오브제가 틸 색으로 물들며 부드럽게 옅어지고(불투명 사각 안개 없음), (b) 위에서 내려오는 은은한 라이트 샤프트가 보이며 미세하게 움직이고, (c) 투명 가장자리가 깨끗하고 바탕화면이 자연스럽게 비치며, (d) 밝기 슬라이더에 따라 분위기가 변한다.
3. 아키텍처 체크리스트:
   - `THREE.Fog`/`FogExp2`를 쓰지 않았는가? (CRITICAL — 투명 함정)
   - 먼 지오메트리가 불투명 색이 아니라 **알파**로 페이드하는가?
   - 샤프트가 additive·depthWrite:false로 투명 호환인가?
   - 순수 매핑이 테스트되는가? config 상수를 썼는가?
4. `phases/1-visual-quality/index.json`의 step 6 갱신:
   - 성공 → `completed` + `summary`에 "깊이 기반 틸 틴트+알파 페이드(onBeforeCompile, Fog 미사용), additive 라이트 샤프트 2~3장(밝기 연동), depthToWaterTint 순수함수+테스트" 요약.
   - 실패 3회 → `error`. 사용자 개입 → `blocked`.

## 금지사항

- `THREE.Fog`/`FogExp2`를 사용하지 마라. 이유: 투명 배경에서 불투명 안개 사각형이 생기고 ShaderMaterial에 무시된다(설계 §3.4, 검증된 함정).
- 먼 오브제를 불투명 색으로 페이드하지 마라. 이유: 투명 가장자리가 더러워진다 — 알파 페이드로.
- 풀스크린 포스트프로세싱(블룸/God-ray pass)을 도입하지 마라. 이유: 투명 창 알파 깨짐 + 비용. 샤프트는 additive 지오메트리로.
- 물고기/수초/모래/커스틱의 기존 동작을 훼손하지 마라(가산만).
- 기존 테스트를 깨뜨리지 마라.
