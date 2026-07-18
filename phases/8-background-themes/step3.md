# Step 3: rocks-upgrade

## 읽어야 할 파일

- `/CLAUDE.md` (렌더링 함정·매직넘버 금지)
- `/docs/superpowers/specs/2026-07-17-background-themes-design.md` §3.2
- `src/renderer/entities/Aquascape.ts` (`_buildHardscape` — 정12면체 바위·자갈·유목 생성 흐름, caustic/depth/`_opaqueMaterials` 등록)
- `src/renderer/entities/aquascapeHelpers.ts` (`generateHardscape` — 배치 로직 재사용)
- `src/shared/config.ts` (`HARDSCAPE`·`THEME`)
- `phases/8-background-themes/index.json`의 step 0~2 `summary`

## 배경

현 바위는 `DodecahedronGeometry(1,0)` 그대로라 인공적인 다면체 느낌이다. 신규 테마용으로 **노이즈 변위 로우폴리 바위**(자연스러운 울퉁불퉁 + flat shading)를 만든다. 다시마 숲에는 큰 바위 3~5개, 산호초에는 낮고 넓은 암반(다음 step에서 산호가 그 위/주변에 얹힌다).

**미니멀 테마는 기존 지오메트리를 그대로 유지한다**(무변화 원칙) — 테마 config에 바위 스타일 분기를 둔다.

## 작업

1. **변위 헬퍼 (순수 함수, TDD 선행)** — `aquascapeHelpers.ts` 확장 또는 `rockHelpers.ts` 신설:
   - `displaceRockPositions(basePositions: ArrayLike<number>, seed: number, strength: number): Float32Array`
   - 버텍스별 **위치 기반 해시 노이즈**로 반경 방향 변위. 요건: 같은 시드 → 동일 출력 / |변위| ≤ strength / NaN 없음.
   - **CRITICAL: flat-shading용 지오메트리는 같은 위치의 버텍스가 면마다 중복**된다 — 변위를 버텍스 인덱스가 아니라 **위치 값 기반 해시**로 계산해야 같은 자리 버텍스가 같은 변위를 받아 면이 찢어지지 않는다. 이를 가드하는 테스트(동일 좌표 입력 → 동일 변위)를 반드시 작성.
2. **`Aquascape._buildHardscape` 분기**
   - 테마 hardscape config에 `rockStyle: 'classic' | 'displaced'` — `classic`(미니멀)은 기존 정12면체 경로 그대로, `displaced`는 `IcosahedronGeometry(1, 1)` + 변위 + `computeVertexNormals()` + `flatShading: true`.
   - 기존과 동일하게 `MeshStandardMaterial` + `applyCausticToStandardMaterial` + `applyWaterDepthToMaterial` + `_opaqueMaterials` 등록.
3. **THEME 구성값**
   - `kelp-forest`: 큰 바위 3~5개(스케일 상향, 어두운 회갈 계열 colors), 자갈/유목은 기존 수준.
   - `coral-reef`: 낮고 넓은 암반(scaleY 납작, 밝은 석회색 계열) — 개수·배치 초기값. 산호는 이 step에서 만들지 않는다.
   - 스케일·색은 config 상수로(매직넘버 금지).

## Acceptance Criteria

```bash
npm run test
npm run lint
npm run build
npm run smoke
AQUA_SMOKE_THEME=kelp-forest AQUA_SMOKE_SHOT=eval-theme-kelp.png AQUA_SMOKE_REPORT=eval-theme-kelp.json npm run smoke
AQUA_SMOKE_THEME=coral-reef AQUA_SMOKE_SHOT=eval-theme-coral.png AQUA_SMOKE_REPORT=eval-theme-coral.json npm run smoke
```

## 검증 절차

1. AC 전부 종료코드 0 (`npm run smoke` 단독 = 미니멀 무회귀 — classic 경로가 안 바뀌었는지).
2. 체크리스트:
   - 동일 위치 버텍스 → 동일 변위 테스트가 있는가(면 찢어짐 가드)?
   - `displaced` 바위가 caustic/depth/투명 슬라이더에 연동되는가(`_opaqueMaterials` 등록)?
   - 캡처에서 바위 실루엣이 자연스러운가(찢어짐/뾰족 스파이크 없음)?
3. **eval(harness smoke)**: 테마 2종 캡처에서 바위/암반이 보이고 무깨짐.
4. index.json step 3 상태 갱신(규칙 동일).

## 금지사항

- 미니멀 테마의 바위 스타일을 바꾸지 마라. 이유: 기본값 무변화 원칙.
- 자갈(pebble)·유목(driftwood) 생성 로직을 바꾸지 마라. 이유: scope — 바위만.
- `generateHardscape`의 시드/배치 알고리즘을 바꾸지 마라(구성값 추가만). 이유: 미니멀 배치 결정성 회귀.
- `Math.random` 금지, 기존 테스트 파괴 금지.
