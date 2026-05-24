# Step 5: caustics

## 읽어야 할 파일

- `/docs/superpowers/specs/2026-05-24-aquagarden-visual-quality-design.md` (§3.3 커스틱 — 모래 일렁임 + 물고기/돌 투사, 2중 UV 스크롤)
- `/docs/ADR.md` (ADR-002 투명, 경량)
- `/CLAUDE.md` (매직넘버 금지, 순수 분리)
- `src/renderer/entities/Aquascape.ts` (step 0/4에서 lit·디테일 적용된 모래 — 여기에 커스틱 주입)
- `src/renderer/entities/Fish.ts` (step 2에서 onBeforeCompile 사용 중 — 물고기에 커스틱 투사 추가 가능)
- `src/renderer/entities/aquascapeHelpers.ts` + `__tests__`
- `src/shared/config.ts`

## 작업

수중 느낌을 결정짓는 **커스틱(빛 그물)** 을 추가한다. 모래에 일렁이는 커스틱을 입히고, 같은 패턴을 위에서 물고기·돌에 투사해 빛이 표면을 가로지르게 한다.

1. **커스틱 텍스처/패턴**
   - 절차적 커스틱을 셰이더에서 계산하거나(예: voronoi/`abs(sin)` 셀룰러), 코드로 만든 타일링 `CanvasTexture`를 쓴다. 외부 이미지 금지.
   - **2중 UV 스크롤**: 서로 다른 속도·방향으로 2회 샘플해 곱/합 → 명백한 타일링 반복을 깬다.

2. **모래에 적용**
   - 모래 머티리얼에 `onBeforeCompile`로 커스틱을 더한다(emissive/diffuse에 가산). `uTime`으로 애니메이션.
   - 밝기 슬라이더(step 0)와 어울리게 과하지 않은 세기. config 상수로 세기 노출.

3. **물고기·돌에 투사(top-down)**
   - 월드 XZ 좌표로 커스틱 텍스처를 위에서 투영해 물고기·바위 표면에 같은 일렁임을 더한다(좌표를 fragment에서 world position 기반으로 샘플).
   - Fish/Aquascape 머티리얼의 onBeforeCompile에 공유 가능한 GLSL 청크로 주입. 코드 중복을 줄이도록 커스틱 GLSL 문자열·uniform 셋업을 한 곳(`src/renderer/entities/caustics.ts` 등)에 모은다.

4. **시간 동기화**
   - 모든 커스틱 uniform `uTime`이 동일 시계로 갱신되도록 한다(엔티티 update에서 공유 시간 전달). 빛 그물이 일관되게 움직여야 한다.

5. **순수 헬퍼 (TDD 먼저)**
   - 커스틱 UV 애니메이션 오프셋 계산 `causticUvOffset(time, speed, dir): {x,y}` 같은 순수 함수를 분리해 테스트(주기성/결정성).
   - `aquascapeHelpers.ts` 또는 `caustics.ts` + `__tests__`.

## Acceptance Criteria

```bash
npm run test
npm run build
npm run lint
```

## 검증 절차

1. AC 3개 종료코드 0. 커스틱 UV 오프셋 순수 함수 테스트 통과.
2. `npm run dev` **수동 확인**: (a) 모래 위에 빛 그물 패턴이 부드럽게 일렁이고, (b) 같은 패턴이 물고기·바위 표면에도 지나가며, (c) 명백한 타일 반복이 보이지 않고(2중 스크롤), (d) 세기가 과하지 않고 밝기 슬라이더와 어울리며 투명 배경 유지.
3. 아키텍처 체크리스트:
   - 커스틱이 셰이더(GPU)에서 계산되는가? 영향 표면당 텍스처 페치 1~2개 수준으로 가벼운가?
   - 투사가 world XZ 기반으로 물고기·돌·모래에서 일관된가?
   - 커스틱 GLSL/uniform이 한 곳에 모여 중복이 적은가?
   - 외부 이미지 에셋을 추가하지 않았는가?
   - 순수 헬퍼가 테스트되는가?
4. `phases/1-visual-quality/index.json`의 step 5 갱신:
   - 성공 → `completed` + `summary`에 "절차적/CanvasTexture 커스틱 2중 UV 스크롤, 모래+물고기+바위 top-down 투사(공유 GLSL 청크), causticUvOffset 순수함수+테스트, 밝기 연동 세기" 요약.
   - 실패 3회 → `error`. 사용자 개입 → `blocked`.

## 금지사항

- 커스틱을 CPU에서 픽셀 단위로 계산하지 마라. 이유: GPU 셰이더가 맞다(경량).
- 풀스크린 포스트프로세싱으로 구현하지 마라. 이유: 투명 창 알파 이슈 + 비용. 표면 머티리얼에 주입한다.
- 외부 커스틱 이미지 파일을 추가하지 마라.
- 물고기 헤엄 로직(step 2)·수초(step 3)의 동작을 바꾸지 마라(커스틱 가산만 추가).
- 기존 테스트를 깨뜨리지 마라.
