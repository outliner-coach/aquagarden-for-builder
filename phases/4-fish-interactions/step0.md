# Step 0: species-plant-registry

## 읽어야 할 파일

- `/CLAUDE.md` (TDD — 순수 로직 테스트 우선, 매직넘버 금지, 레이어 분리)
- `/docs/ARCHITECTURE.md` (`speciesRegistry.ts`/`plantRegistry.ts` 확장 진입점 메모, 컴포넌트형 엔티티)
- `src/renderer/entities/fishAssets.ts` (`FISH_SPECIES`, `SpeciesId`, `pickSpecies` — 현재 어종 메타 소스)
- `src/renderer/entities/Fish.ts` (`pickSpecies` 사용처), `src/renderer/entities/FishSchool.ts`
- `src/shared/config.ts` (`PLANT.species` 배열 — 현재 수초 메타 소스)
- `src/renderer/entities/Aquascape.ts` + `aquascapeHelpers.ts` (`PLANT.species` 소비처 — 깨뜨리지 말 것)

## 작업

추후 **어종·수초 종류를 손쉽게 추가**할 수 있도록 메타데이터를 단일 레지스트리로 정리한다(확장성 사전 대비). 이 step은 순수 데이터/타입 정리 — 시각 변화 없음.

1. **`src/renderer/entities/speciesRegistry.ts`** 생성:
   - 기존 `FISH_SPECIES`(fishAssets.ts)를 이 파일로 **이전**하고, 각 항목에 확장 필드를 추가한다:
     - `id: SpeciesId`, `file`, `kind`, `baseScale`, `swimSpeed`(기존)
     - `displayName: string`(한국어 표시명, 예 '흰동가리', '나비고기', '쏠배감펭', '네온테트라' 등)
     - `dialogue: readonly string[]`(어종별 대사 — 이 step에서는 **빈 배열 또는 1~2개 placeholder**로 두고, 실제 ≥10개는 step 1에서 채운다)
   - `SpeciesId` 타입·`FISH_SPECIES`·`pickSpecies`·`computeNormalizeTransform`은 그대로 동작해야 한다. `fishAssets.ts`는 `speciesRegistry`에서 import해 재사용(기존 export 경로를 깨지 않도록 re-export 허용).
   - 파일 상단에 **"새 어종 추가 방법"** 주석 가이드(이 배열에 항목 1개 추가 + GLB를 assets/fish에 두고 ?url import 등록 → 끝).
   - 헬퍼 `getSpecies(id): FishSpecies`(없으면 throw).
2. **`src/renderer/entities/plantRegistry.ts`** 생성:
   - `config.ts`의 `PLANT.species`를 타입드 `PlantSpecies` 인터페이스로 노출(데이터는 config에 그대로 둔다 — 소비처 `aquascapeHelpers`가 계속 동작). 레지스트리는 타입 + 접근 헬퍼 + "새 수초 추가 방법" 주석 가이드를 제공.
   - Aquascape/aquascapeHelpers의 동작·출력은 바뀌면 안 된다.
3. **TDD 테스트**(`__tests__/speciesRegistry.test.ts`, `__tests__/plantRegistry.test.ts`):
   - 어종: `id` 유일, 각 항목에 `displayName` 존재(비어있지 않음), 각 `kind`(schooling/individual)에 최소 1종, `getSpecies` 라운드트립.
   - 수초: `PLANT.species` 항목들이 레지스트리 타입에 부합, name 유일.
   - `pickSpecies`가 이전과 동일하게 kind별 후보에서 결정적으로 선택(회귀 테스트).

## Acceptance Criteria

```bash
npm run test
npm run build
npm run lint
```

## 검증 절차

1. AC 3개 종료코드 0. 신규/기존 테스트 모두 통과(특히 `pickSpecies`·`fishAssets`·`aquascapeHelpers` 회귀 없음).
2. 체크리스트:
   - 어종/수초 메타가 한 곳(레지스트리)에 모이고, 추가 가이드 주석이 있는가?
   - 기존 import 경로/동작(`FISH_SPECIES`, `SpeciesId`, `pickSpecies`)이 보존되는가?
   - 시각 출력(물고기 종류·수초)이 이전과 동일한가?(데이터 이전만, 값 변경 없음)
   - 매직넘버 금지·레이어 분리 준수?
3. 이 step은 `"eval"` 없음(순수 로직). 스모크 게이트는 돌지 않지만 build/test/lint는 필수.
4. `phases/4-fish-interactions/index.json`의 step 0 갱신: 성공 `completed` + `summary`(레지스트리 구조·dialogue는 step1에서 채움을 명시), 실패 규칙 동일.

## 금지사항

- `PLANT.species` 데이터 값을 변경하지 마라(개수·색·area 등). 이유: 시각 회귀 방지 — 이 step은 타입/구조 정리만.
- `pickSpecies`의 선택 결과를 바꾸지 마라. 이유: 결정적 종 분포가 바뀌면 시각/테스트 회귀.
- 대사를 여기서 ≥10개씩 다 채우지 마라. 이유: 대사 내용·말풍선은 step 1 scope. 여기선 구조만.
- 기존 테스트를 깨뜨리지 마라.
