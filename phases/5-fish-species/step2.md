# Step 2: persistence-and-wiring

## 읽어야 할 파일

- `/CLAUDE.md` (레이어 분리: shared는 renderer에 의존 금지 / TDD / 자기보고 불신)
- `/docs/superpowers/specs/2026-05-27-fish-species-addition-design.md` (§"D. 영속화", §에러핸들링)
- `src/shared/types.ts` (`AppSettings`)
- `src/renderer/persistence.ts` (`loadPersisted`/`savePersisted`/`PersistedState`)
- `src/renderer/main.ts` (설정 기본값·복원 블록·`fishSchool.init().then(...)`·`persistSoon`)
- `src/renderer/entities/FishSchool.ts` (step 1의 `availableFeatures()`/`setEnabledFeatures()`)
- `src/renderer/entities/speciesRegistry.ts` (`getSpecies`, `SpeciesId`)
- `src/renderer/__tests__/persistence.test.ts` (있으면 — 없으면 신규 생성)

## 설계 (레이어)

`AppSettings`는 `src/shared`에 있고, `SpeciesId`는 `src/renderer/entities`에 있다. shared가 renderer를
import하면 레이어 위반이다. 따라서 **`enabledFeatures: string[]`**(느슨한 타입)으로 두고, 유효성은
경계에서 처리한다 — main에서 `availableFeatures()`(Set<SpeciesId>)와 교집합해 유효 id만 남긴다
(미지/로드실패 id 드롭 = 유령 차단). 좁히기는 이 교집합에서 일어난다.

## 작업

1. **`types.ts` — `AppSettings.enabledFeatures`**
   - `AppSettings`에 `enabledFeatures: string[]` 추가(주석: "켜진 특별 개체 종 id 목록. 유효성은 renderer에서 availableFeatures와 교집합으로 검증").

2. **`persistence.ts` — 저장/복원 + 하위호환**
   - `loadPersisted`: 기존 하드 가드(필수 필드)는 그대로. `enabledFeatures`는 **하드 가드에 넣지 말고**(zoom과 동일한 관용 처리) 다음으로 보정:
     ```ts
     enabledFeatures: Array.isArray(s.enabledFeatures)
       ? s.enabledFeatures.filter((x): x is string => typeof x === 'string')
       : [],
     ```
   - `savePersisted`는 `settings`를 통째로 직렬화하므로 추가 변경 불필요(이미 `enabledFeatures` 포함).

3. **`main.ts` — 기본값 + 복원 배선**
   - settings 기본값 객체(현재 `persisted?.settings ?? { ... }`)에 `enabledFeatures: []` 추가.
   - `import { getSpecies } from './entities/speciesRegistry'` 및 `SpeciesId` 타입 import.
   - `fishSchool.init().then(() => markReady())` 체인을 확장해, **init 완료 후** 영속값을 교집합 적용:
     ```ts
     fishSchool
       .init()
       .then(() => {
         markReady()
         const avail = fishSchool.availableFeatures()
         const valid = settings.enabledFeatures.filter((id) => avail.has(id as SpeciesId))
         if (valid.length !== settings.enabledFeatures.length) {
           settings.enabledFeatures = valid // 미지/로드실패 id 드롭 → 영속 정리
           persistSoon()
         }
         fishSchool.setEnabledFeatures(valid as SpeciesId[])
       })
       .catch((err) => { console.error('[FishSchool] 초기화 실패:', err) })
     ```
   - (이 step에서는 UI 콜백을 추가하지 않는다. 토글은 step 3. 여기선 영속 복원 경로만 동작시킨다.)

4. **TDD 테스트** (`src/renderer/__tests__/persistence.test.ts`):
   - `enabledFeatures` 없는 기존 저장값 로드 → `settings.enabledFeatures === []`(하위호환).
   - `enabledFeatures`가 배열 아님(예: 문자열/null) → `[]`.
   - `enabledFeatures`가 문자열 배열(일부 비문자 섞임) → 문자열만 보존.
   - 기존 loadPersisted 가드(필수 필드 누락 시 null) 회귀 없음.
   - localStorage가 없는 환경이면 mock(기존 테스트 패턴 따름).

## Acceptance Criteria

```bash
npm run test
npm run build
npm run lint
```

## 검증 절차

1. AC 3개 종료코드 0. persistence 신규 테스트 통과 + 기존 회귀 없음.
2. 체크리스트:
   - shared가 renderer를 import하지 않는가(`enabledFeatures: string[]`)?
   - 복원 시 `availableFeatures`와 교집합으로 미지 id가 드롭되는가?
   - init 실패/지연 시 throw 없이 안전한가(setEnabledFeatures는 then 안에서만 호출)?
3. **eval 없음**(기본 `enabledFeatures=[]` → 시각 변화 없음). build/test/lint만 게이트.
4. `index.json` step 2 갱신(`completed` + summary).

## 금지사항

- `src/shared`에서 `SpeciesId`(renderer)를 import하지 마라. 이유: 레이어 위반. `string[]`로 두고 경계에서 좁힌다.
- `loadPersisted`의 하드 가드(필수 필드) 목록에 `enabledFeatures`를 넣지 마라. 이유: 구버전 저장값(필드 없음)이 전부 무효화돼 설정이 초기화된다(하위호환 깨짐).
- ControlPanel/UI를 이 step에서 건드리지 마라(step 3 scope).
