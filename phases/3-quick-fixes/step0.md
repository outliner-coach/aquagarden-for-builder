# Step 0: brightness-square-artifact-fix

## 읽어야 할 파일

- `/CLAUDE.md` (투명 캔버스 셰이더 함정, 매직넘버 금지, 런타임 eval 자기보고 불신)
- `/docs/ARCHITECTURE.md` (렌더링 파이프라인: `scene.environment`=PMREM/RoomEnvironment IBL, `background`=null)
- `src/renderer/core/SceneRoot.ts` (`PMREMGenerator.fromScene(new RoomEnvironment(), 0.04)`, `environmentIntensity`)
- `src/renderer/lighting/Lighting.ts` + `src/renderer/lighting/lightingHelpers.ts` (`setBrightness01` → directional/ambient/`environmentIntensity` 동시 구동)
- `src/shared/config.ts` (`LIGHT` — `maxEnvIntensity` 1.2 등)
- `src/renderer/entities/Aquascape.ts` (모래/바위 머티리얼 — roughness/metalness)
- `docs/EVAL.md` (스모크가 무엇을 잡고 못 잡나)

## 작업

**버그**: 밝기 슬라이더를 일정 이상으로 올리면 **화면 중앙에 네모(사각형) 모양의 밝은 선/면**이 나타난다. 없어져야 한다. 단 밝기 슬라이더의 본래 기능(밤↔낮 디밍)과 투과(투명)는 그대로 유지한다.

systematic-debugging 절차를 따른다. 추측만으로 고치지 말고 **먼저 재현·원인 규명** 후 최소 수정한다.

1. **재현**: `npm run dev`로 띄워 밝기 슬라이더를 100%까지 올려 네모 아티팩트를 눈으로 확인한다. (스모크는 기본 밝기로 렌더하므로 이 버그를 자동으로는 못 잡는다 — 수동 확인 필수.)
2. **원인 규명**: 밝기와 함께 커지는 값은 directional·ambient·`scene.environmentIntensity` 세 가지다. 유력 가설은 **IBL(`RoomEnvironment`) 반사**다 — RoomEnvironment은 직사각형 emissive 라이트 패널로 구성된 박스라, `environmentIntensity`가 커지면 광택(낮은 roughness)·평평한 표면(특히 위를 향한 모래 바닥)이 그 사각 라이트 패널을 **거울처럼 반사**해 화면 중앙에 사각형으로 비친다. 가설을 실제로 확인하라(예: `environmentIntensity`만 0으로 둬보거나, 모래 roughness를 1로 올려보며 아티팩트가 사라지는지 격리 테스트).
3. **최소 수정**: 원인이 확정되면 그 원인만 제거한다. 가능한 방향(원인에 맞는 것 택1 또는 조합):
   - 평평·대면적 표면(모래 등)의 머티리얼 `roughness=1`, `metalness=0`으로 두어 거울 반사를 없앤다(난반사만).
   - `LIGHT.maxEnvIntensity`를 아티팩트가 안 보이는 수준으로 하향(예: 1.2 → 0.8 부근). 단 IBL이 주는 입체감/밝기는 유지되게.
   - PMREM 블러(현재 `0.04`)를 키워 환경맵 반사를 부드럽게.
   - 위 수치는 모두 `LIGHT`/관련 config 상수로 두고 매직넘버 금지.
4. 밝기 0~100% 전 구간에서 directional/ambient/env가 여전히 단조 증가하며 낮↔밤 분위기가 동작하는지 확인한다(회귀 방지).

## Acceptance Criteria

```bash
npm run test
npm run build
npm run lint
npm run smoke
```
추가(수동): `npm run dev`로 밝기 100%에서 화면 중앙 네모 아티팩트가 **사라졌는지** 직접 확인.

## 검증 절차

1. AC 4개 종료코드 0. `npm run smoke` pass(투과 보존·블랭크 아님·콘솔 에러 0).
2. `lightingHelpers` 순수 함수 테스트 통과 유지(밝기→intensity 매핑이 단조). 상수를 바꿨다면 해당 테스트도 갱신.
3. 체크리스트:
   - 밝기 100%에서 중앙 네모 아티팩트가 사라졌는가? (수동 dev 확인)
   - 밝기 슬라이더의 디밍(밤↔낮)이 여전히 동작하는가?
   - `scene.background`=null·투과 유지? `THREE.Fog`/풀스크린 블룸 미도입?
   - 매직넘버 대신 config 상수? 기존 테스트 유지?
4. **런타임 eval 게이트**: 완료 후 execute.py가 스모크 자동 실행(per-step). 통과해야 `completed`.
5. `phases/3-quick-fixes/index.json`의 step 0 갱신: 성공 시 `completed` + `summary`(원인 + 적용한 수정 한 줄), 3회 실패 시 `error` + `error_message`.

## 금지사항

- 원인 규명 없이 밝기 슬라이더 상한을 깎아 버그를 가리지 마라. 이유: 밝기 디밍은 핵심 기능. 아티팩트의 실제 원인(반사 등)을 제거하라.
- IBL(`scene.environment`)을 통째로 제거하지 마라. 이유: 물고기/씬 입체감이 IBL에 의존한다. 강도/반사 특성만 조정.
- `scene.background`에 색을 넣지 마라. 이유: 투과(투명 창) 깨짐.
- 기존 테스트를 깨뜨리지 마라.
