# Step 5: aquascape

## 읽어야 할 파일

- `/docs/PRD.md` (핵심기능 9: 미니멀 아쿠아스케이프 — 모래/낮은 수초/작은 바위)
- `/docs/ARCHITECTURE.md` (`src/renderer/entities/Aquascape.ts`, SceneEntity 인터페이스)
- `/docs/ADR.md` (경량·미니멀 철학; 수초는 vertex shader 애니메이션)
- `/reference_image.png` (구현 목표 외관 — **이미지를 직접 열어 보고** 모래색/수초 형태/바위 배치를 맞춰라)
- `src/renderer/core/SceneRoot.ts` (SceneEntity 인터페이스, add 방식)
- `src/shared/config.ts`
- `src/renderer/main.ts`

## 작업

물고기의 무대가 될 미니멀 환경을 만든다. **시선이 물고기에 가도록 구조물은 최소화**(PRD 디자인 의도).

1. **`src/renderer/entities/Aquascape.ts`** — `SceneEntity` 구현. 내부에 `THREE.Group`(object3d). 레퍼런스 이미지의 외관을 목표로 한다.
   - **바닥재(모래)**: 넓고 낮은 평면 또는 약한 굴곡 plane. **밝은 베이지/화이트 모래색**(레퍼런스). 카메라 하단에 깔린다.
   - **낮은 수초**: 화면 하단을 가리지 않도록 **아주 낮게**. 레퍼런스처럼 **초록 잔디형 수초가 곳곳에 작은 군락**으로. 흔들림은 **vertex shader**로 구현(ADR: 연산 부담 최소화). `THREE.ShaderMaterial` 또는 `onBeforeCompile`로 시간 uniform 기반 좌우 sway.
   - **작은 바위/자갈**: 로우폴리 바위 1~3개 + 작은 자갈 몇 개. 장식 최소.
   - **글래스 박스(선택, 권장)**: 레퍼런스의 "유리 수조" 느낌을 위해, 수조 전면/상단 림에 **아주 미묘한 엣지 하이라이트**(반투명 흰 라인/약한 specular)를 넣는다. 단 물 전체를 불투명/진한 색으로 채우지 마라 — 투과가 깨진다.
   - `update(dt)`에서 셰이더 `uTime` uniform을 누적 갱신.
   - `dispose()`에서 geometry/material 정리.

2. **순수 헬퍼(테스트 대상)** — 셰이더 코드 자체는 테스트 어려우므로, **시간 누적/sway 위상 계산 같은 순수 로직**을 분리한다. 예: `swayOffset(time:number, phase:number, amplitude:number): number` (사인 기반). Aquascape는 이를 사용하거나, 최소한 `advanceTime(prev:number, dt:number): number` 같은 함수를 export해 테스트.

3. **`main.ts`에 등록** — step 4의 임시 와이어프레임 제거하고 `Aquascape` 인스턴스를 `sceneRoot.add(...)`.

## Acceptance Criteria

```bash
npm run build
npm run test    # swayOffset/advanceTime 등 순수 로직 테스트 통과
npm run lint
```

## 검증 절차

1. AC 실행, 모두 0 확인.
2. `npm run dev`로 바닥/낮은 수초/바위가 **화면 하단에 낮게** 깔리고 수초가 부드럽게 흔들리는지, 상단 시야는 비어(물고기 자리) 있는지 **수동 확인**.
3. 체크리스트:
   - 구조물이 상단·중앙 시야를 가리지 않는가? (PRD: 물고기에 시선 집중)
   - 수초 흔들림이 vertex shader인가? (CPU 본 애니메이션 아님 — ADR)
   - 투명 배경 유지(바탕화면 비침)가 깨지지 않았는가?
4. `phases/0-mvp/index.json`의 step 5 업데이트:
   - 성공 → `completed` + `summary`에 "Aquascape가 생성하는 오브젝트(모래/수초/바위), sway 셰이더 방식, 노출한 순수 헬퍼" 요약.

## 금지사항

- 물고기/조명/파티클을 만들지 마라. 이유: step 6~8 소관.
- 수초·유목을 풍성하게 채우지 마라. 이유: PRD 디자인 의도(시선은 물고기). 미니멀 유지.
- 불투명 배경/스카이박스를 넣지 마라. 이유: 바탕화면 투과(알파 투명)가 깨진다.
- 기존 테스트를 깨뜨리지 마라.
