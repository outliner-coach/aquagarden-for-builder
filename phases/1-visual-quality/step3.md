# Step 3: aquascape-plants

## 읽어야 할 파일

- `/docs/superpowers/specs/2026-05-24-aquagarden-visual-quality-design.md` (§3.3 수초 — 알파컷아웃 카드 + 버텍스 스웨이 + 인스턴싱 다종, "풍성하게")
- `/docs/ADR.md` (ADR-002 투명, 경량 우선)
- `/CLAUDE.md` (수초는 버텍스 셰이더 애니메이션, 매직넘버 금지)
- `/requirement.md` (§3 미니멀·아주 낮은 수초, §7 버텍스 셰이더)
- `src/renderer/entities/Aquascape.ts` (현재 grass = 삼각 블레이드 ShaderMaterial — 이걸 알파컷아웃 카드로 교체. sand/rocks는 step 0에서 lit 전환됨)
- `src/renderer/entities/aquascapeHelpers.ts` + `__tests__/aquascapeHelpers.test.ts` (순수 헬퍼)
- `src/shared/config.ts` (AQUASCAPE 상수)

## 작업

수초를 단색 삼각 블레이드에서 **알파컷아웃 텍스처 그래스 카드**로 교체하고, 버텍스 셰이더 스웨이를 제대로(루트 고정·끝만 흔들림) 만들고, 인스턴싱으로 2~4종을 레이어드해 "풍성하게" 만든다. 단 requirement의 "낮은 수초·물고기 시야 보존"은 지킨다.

1. **잎 알파 텍스처 생성(런타임, 외부 파일 금지)**
   - 잎 모양 알파를 코드로 만든다: `CanvasTexture`로 부드러운 세로 잎(끝이 뾰족한 그라디언트 알파)을 그리거나, 셰이더에서 절차적 알파를 계산. 외부 이미지 에셋을 추가하지 않는다(번들 단순 유지).
   - 알파 처리: `alphaTest`(예: 0.5)로 정렬 비용 없이 불투명 패스에서 컷아웃. `transparent:true` 풀 블렌딩은 피한다(정렬/오버드로 비용).

2. **그래스 카드 지오메트리 + 인스턴싱**
   - 한 포기 = 교차하는 2~3개 quad(카드). 카드 geometry를 1회 만들고 `InstancedMesh`로 다수 배치.
   - 종(레이어) 2~4개: 예) 전경 카펫(짧음), 중경 부쉬(중간), 배경 키큰 풀. 종별 InstancedMesh 또는 인스턴스 속성으로 구분.
   - 인스턴스별 속성(attribute): 위치, 회전(yaw), 높이/스케일, 위상 오프셋, 색 변주. `instancedBufferAttribute`로 셰이더에 전달.
   - 배치는 결정적 시드 기반(아래 순수 헬퍼). 모두 하단(모래 근처, 낮게)에 두고 물고기 유영 공간(상단)을 가리지 않게 한다.

3. **버텍스 셰이더 스웨이 (제대로)**
   - 흔들림을 **높이 가중**으로: 루트(uv.y=0 또는 로컬 y=0)는 고정, 끝(상단)만 흔들린다. `sway = sin(uTime * speed + worldX * k + uPhase) * heightFactor`, `heightFactor = pow(localHeight01, 2.0)` 정도.
   - uniform `uTime`은 `update(dt)`에서 갱신(기존 advanceTime 패턴 재사용).
   - 종별/인스턴스별 위상으로 일사불란하지 않게.

4. **순수 헬퍼 (TDD 먼저)** — `aquascapeHelpers.ts`에 추가
   - `generatePlantInstances(seed, count, area, speciesParams): InstanceData[]` — 결정적 배치(위치/회전/스케일/위상/색). 시야 보존을 위해 y(높이)·z 범위 제한.
   - `swayHeightFactor(height01: number): number` — 높이 가중 곡선(0→0, 1→1, 단조 증가).
   - `__tests__/aquascapeHelpers.test.ts`에 테스트 먼저: 인스턴스 개수·결정성(같은 시드→같은 결과)·범위(배치가 정의된 area·높이 한계 안), swayHeightFactor 경계.

## Acceptance Criteria

```bash
npm run test
npm run build
npm run lint
```

## 검증 절차

1. AC 3개 종료코드 0. aquascapeHelpers 테스트(배치 결정성·범위, swayHeightFactor) 통과.
2. `npm run dev` **수동 확인**: (a) 수초가 단색 삼각형이 아니라 잎 형태 카드로 보이고, (b) 2종 이상 레이어로 더 풍성하며, (c) 끝만 부드럽게 흔들리고 루트는 고정, (d) 물고기 유영 공간(상단)을 가리지 않으며 투명 배경 유지.
3. 아키텍처 체크리스트:
   - 스웨이가 **버텍스 셰이더**에서 일어나는가? (CPU 루프로 정점 이동 금지 — requirement §7)
   - `InstancedMesh`로 드로우콜을 절약하는가?
   - `alphaTest`로 정렬 비용을 피하는가?(풀 transparent 남용 금지)
   - 배치 헬퍼가 순수·결정적이며 테스트되는가?
   - 외부 이미지 에셋을 추가하지 않았는가?(CanvasTexture/절차적)
4. `phases/1-visual-quality/index.json`의 step 3 갱신:
   - 성공 → `completed` + `summary`에 "삼각 블레이드→알파컷아웃 그래스 카드(CanvasTexture, alphaTest), InstancedMesh 2~4종 레이어드, 높이가중 버텍스 스웨이, generatePlantInstances/swayHeightFactor 순수함수+테스트" 요약.
   - 실패 3회 → `error`. 사용자 개입 → `blocked`.

## 금지사항

- 정점 흔들림을 CPU(JS 루프)에서 계산하지 마라. 이유: requirement §7 — 버텍스 셰이더로 연산 부담 최소화.
- 수초를 높고 빽빽하게 만들어 물고기 시야를 가리지 마라. 이유: requirement §3 — 시선은 물고기에 집중.
- 외부 텍스처 이미지 파일을 추가하지 마라. 이유: 번들 단순 유지(CanvasTexture/절차적 알파로 충분).
- 물고기/모래/유목/커스틱/물 효과를 건드리지 마라. 이유: 각각 다른 step.
- 기존 테스트를 깨뜨리지 마라.
