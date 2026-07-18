# Step 0: theme-foundation

## 읽어야 할 파일

- `/CLAUDE.md` (TDD·매직넘버 금지·레이어 분리·렌더링 함정·자기보고 불신)
- `/docs/superpowers/specs/2026-07-17-background-themes-design.md` (설계 — 특히 §1 확정사항, §2 아키텍처)
- `src/shared/config.ts` (`PLANT`·`HARDSCAPE`·`AQUASCAPE`·`SCENE` — THEME 상수가 참조할 기존 값)
- `src/shared/types.ts` (`AppSettings` — themeId 추가 대상)
- `src/renderer/entities/Aquascape.ts` (주 수정 대상 — `_buildSand/_buildGrassCards/_buildHardscape`, `_grassMaterials`/`_opaqueMaterials`, `setMood`, `setSceneOpacity`, `dispose`)
- `src/renderer/entities/plantRegistry.ts` (레지스트리 패턴 — themeRegistry가 따를 형식)
- `src/renderer/persistence.ts` (`loadPersisted`의 `enabledFeatures` 하위호환 보정 패턴)
- `src/renderer/main.ts` (Aquascape 생성·배선 위치)
- `src/renderer/entities/__tests__/` (기존 테스트 — 깨뜨리지 말 것)

## 배경

배경 테마 교체(미니멀/다시마 숲/산호초)의 **구조 기반**을 만드는 step이다. 신규 시각 요소(다시마·산호)는 만들지 않는다 — 이 step 완료 시점의 테마 간 차이는 모래색·하드스케이프 구성값 차이뿐이다. **기본값 '미니멀'은 현재 화면과 시각적으로 동일해야 한다**(기존 사용자 무변화 하위호환이 이 기능의 전제).

## 작업

1. **`src/shared/config.ts` — `THEME` 상수 추가**
   - 형태(필드 설계는 재량이되 아래 요건 충족):
     ```ts
     export const THEME = {
       defaultId: 'minimal',
       themes: [
         { id: 'minimal',     displayName: '미니멀',   sandColor: 0x9c8a6e, plants: PLANT.species, hardscape: { /* 현 HARDSCAPE 값 참조 */ } },
         { id: 'kelp-forest', displayName: '다시마 숲', sandColor: /* 미니멀보다 약간 어둡게 */, plants: PLANT.species, hardscape: { /* 큰 바위 강조 초기값 */ } },
         { id: 'coral-reef',  displayName: '산호초',   sandColor: /* 밝은 산호모래 */, plants: /* 카펫 축소 배열 */, hardscape: { /* 낮은 암반 준비 */ } },
       ],
     } as const
     ```
   - 요건: ① 테마가 **모래색·수초 종 배열(기존 `PLANT.species` 항목 형식)·하드스케이프 구성**을 결정한다 ② 미니멀 값은 기존 상수를 **참조**해(복붙 중복 금지) 현 화면과 동일해야 한다 ③ 이후 step에서 `kelp`·`coral` 요소 config 필드가 추가되므로 타입을 확장 가능하게 설계한다.
   - `Aquascape.ts` 로컬 상수 `SAND_COLOR`(0x9c8a6e)를 미니멀 테마의 `sandColor`로 **이동**한다(하드코딩 제거).

2. **`src/renderer/entities/themeRegistry.ts` 신설** — `plantRegistry` 패턴 그대로:
   - `export interface BackgroundTheme { ... }` (config THEME 항목 타입)
   - `export const THEME_REGISTRY: readonly BackgroundTheme[]`
   - `export function getTheme(id: string): BackgroundTheme` — 미존재 id는 throw
   - `export const DEFAULT_THEME_ID`

3. **`src/renderer/entities/themeHelpers.ts` 신설 (순수 함수, TDD 선행)**
   - `resolveThemeId(saved: unknown, validIds: readonly string[], defaultId: string): string` — 비문자열·미존재 id → defaultId, 유효 id → 그대로.

4. **`Aquascape` 테마 일반화**
   - `constructor(theme: BackgroundTheme = getTheme(DEFAULT_THEME_ID))` — 빌드 함수들이 테마 config를 읽도록.
   - `setTheme(theme: BackgroundTheme): void` — 내부 자식 메시/지오메트리/머티리얼/텍스처 dispose 후 재빌드.
     - **CRITICAL: `object3d` Group 인스턴스는 유지한다**(SceneRoot가 참조를 들고 있음 — children만 비운다).
     - **CRITICAL: 직전 `setSceneOpacity` factor와 `setMood` 값을 필드에 보관했다가 재빌드 직후 재적용한다**(리빌드 후 투명도/무드가 풀리는 버그 방지).
   - 기존 `dispose()`와 재빌드용 내부 정리가 중복되지 않게 정리 로직을 공용 프라이빗 메서드로 추출.

5. **영속화**
   - `AppSettings`에 `themeId?: string` 추가.
   - `loadPersisted`: `enabledFeatures` 하위호환 보정과 같은 방식으로, 누락/비문자열/유령 id를 `resolveThemeId`로 보정.

6. **`main.ts` 배선** — 복원된 themeId로 Aquascape 생성(또는 생성 후 `setTheme`). UI는 만들지 않는다(step 5 scope).

7. **TDD 테스트**
   - themeRegistry: 3종 존재, 각 `displayName` 비어있지 않음, `getTheme('없는id')` throw, `DEFAULT_THEME_ID === 'minimal'`.
   - themeHelpers.resolveThemeId: 유효 id/비문자열/유령 id/undefined 경계.
   - persistence: themeId 하위호환 로드(구버전 저장분에 themeId 없음 → 기본값).

## Acceptance Criteria

```bash
npm run test
npm run lint
npm run build
npm run smoke
```

## 검증 절차

1. AC 4개 종료코드 0. 신규/기존 테스트 모두 통과(기존 486+ 무회귀).
2. 체크리스트:
   - 미니멀 테마 값이 기존 상수 참조인가(복붙 중복 없음)?
   - `setTheme` 후 opacity/mood 재적용 로직이 있는가?
   - `object3d` Group 인스턴스가 유지되는가?
   - `SAND_COLOR` 하드코딩이 제거됐는가?
   - 매직넘버가 `config.ts` 밖에 남지 않았는가?
3. **eval(harness smoke)**: 기본=미니멀 렌더가 이전과 동일하게 pass(블랭크/에러/투과 회귀 없음).
4. `phases/8-background-themes/index.json`의 step 0을 `completed` + `summary`(테마 타입 필드 구성·재적용 방식 등 다음 step에 유용한 정보)로 갱신. 3회 실패 시 `error` + `error_message`, 사용자 개입 필요 시 `blocked` + `blocked_reason` 후 중단.

## 금지사항

- 미니멀 테마의 시각 결과를 바꾸지 마라. 이유: 기본값 하위호환 — 기존 사용자 무변화가 이 기능의 전제.
- 다시마/산호 시각 요소를 만들지 마라. 이유: step 2/4 scope.
- `ControlPanel`을 건드리지 마라. 이유: step 5 scope.
- 기존 `PLANT`/`HARDSCAPE` 상수를 삭제·개명하지 마라. 이유: caustics 등 다른 모듈이 참조 — 참조 구조만 추가한다.
- `Math.random`을 쓰지 마라. 이유: 시드 결정적이어야 스모크/eval 캡처가 재현 가능.
- 기존 테스트를 깨뜨리지 마라.
