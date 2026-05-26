# Step 1: feature-spawn

## 읽어야 할 파일

- `/CLAUDE.md` (TDD·풀링 재사용·비동기/분할 스폰·매직넘버 금지·자기보고 불신)
- `/docs/superpowers/specs/2026-05-27-fish-species-addition-design.md` (§"B. FishSchool", §에러핸들링)
- `src/renderer/entities/FishSchool.ts` (주 수정 — 스폰/풀/boids/lure/raycast)
- `src/renderer/core/ObjectPool.ts` (`acquire`/`release(item)`/`setActiveCount`/`forEachActive` 시맨틱: setActiveCount는 **끝에서 pop**)
- `src/renderer/entities/Fish.ts` (`reset(seed, kind)` — `pickSpecies` 호출, `position` getter, `setVisible`)
- `src/renderer/entities/fishHelpers.ts` (`nextActiveCount` — 점진 스폰 헬퍼)
- `src/renderer/entities/speciesRegistry.ts` (step 0에서 추가된 `category`, feature 4종)
- `src/shared/config.ts` (`FISH.bounds` — 스폰 영역 참조)

## 설계 (중요 — 단일 풀, setActiveCount 미사용)

`ObjectPool.setActiveCount`는 `_active` **끝에서 pop**한다. 앰비언트와 특별 개체를 한 풀에 섞은 채
`setActiveCount`로 앰비언트를 줄이면 나중에 acquire된 특별 개체가 먼저 pop돼버린다. 따라서:

- **`setActiveCount`/`activeCount` 기반 앰비언트 회계를 버리고**, 앰비언트를 명시적 리스트
  `_ambientFish: Fish[]`로 추적한다(pool.acquire/pool.release(fish)로 직접 증감).
- 특별 개체는 `_featureActive: Map<SpeciesId, Fish>`로 추적.
- `_pool.forEachActive`는 두 그룹을 모두 순회한다 → **update·raycast·feed/scare(`_applyLureSteer`)는
  자동으로 특별 개체까지 포함**(특별 개체도 클릭 대사·먹이·놀래키기 반응). `_applyBoids`는 schooling만
  필터하므로 individual인 특별 개체는 자연히 제외(고래 무리 안 됨).

## 작업

1. **`Fish.reset`에 명시적 종 인자 추가** (`Fish.ts`)
   - 시그니처: `reset(seed: number, kind: FishKind, species?: SpeciesId): void`.
   - 본문에서 `const speciesId = pickSpecies(seed, kind)` → `const speciesId = species ?? pickSpecies(seed, kind)`.
   - 나머지(클론/믹서 재구성, 위치 초기화)는 그대로. 기존 호출 `reset(seed, kind)`는 호환(species=undefined → pickSpecies).

2. **순수 헬퍼 `src/renderer/entities/featureHelpers.ts` 생성** (TDD 먼저)
   - `reconcileFeatures(target, active)`:
     ```ts
     export function reconcileFeatures(
       target: ReadonlySet<SpeciesId>,
       active: ReadonlySet<SpeciesId>,
     ): { acquire: SpeciesId[]; release: SpeciesId[] } {
       const acquire = [...target].filter((id) => !active.has(id))
       const release = [...active].filter((id) => !target.has(id))
       return { acquire, release }
     }
     ```
   - `featureSpawnPosition(seed, area)`: area `{minX,maxX,minY,maxY,minZ,maxZ}` 안에서 시드 기반 결정적 좌표 반환(가시 영역). `Fish.ts`의 `pseudoRandom`과 동일한 방식(`Math.sin` 해시)으로 x/y/z를 보간:
     ```ts
     export function featureSpawnPosition(seed: number, area: {minX:number;maxX:number;minY:number;maxY:number;minZ:number;maxZ:number}) {
       const r = (i: number) => { const x = Math.sin(seed * 127.1 + i * 311.7) * 43758.5453; return x - Math.floor(x) }
       return { x: area.minX + r(1)*(area.maxX-area.minX), y: area.minY + r(2)*(area.maxY-area.minY), z: area.minZ + r(3)*(area.maxZ-area.minZ) }
     }
     ```

3. **`config.ts` — `FEATURE` 상수**
   - 특별 개체 등장 가시 영역(`FISH.bounds`의 중앙·전면 부분집합으로, 토글 직후 화면에 바로 보이게):
     ```ts
     export const FEATURE = {
       spawnArea: { minX: -5, maxX: 5, minY: -0.4, maxY: 1.2, minZ: -1.2, maxZ: 0.2 },
     } as const
     ```

4. **`FishSchool.ts` — 특별 개체 관리**
   - 필드: `private readonly _ambientFish: Fish[] = []`, `private readonly _featureActive = new Map<SpeciesId, Fish>()`, `private _desiredFeatures: ReadonlySet<SpeciesId> = new Set()`, `private _featureSeed = 100000`.
   - `availableFeatures(): Set<SpeciesId>`: `_prototypes`가 null이면 빈 Set. 아니면 `SPECIES_REGISTRY.filter(s => s.category==='feature' && this._prototypes!.has(s.id)).map(s=>s.id)` 의 Set. (로드 실패 종 제외 — 유령 차단)
   - `setEnabledFeatures(ids: SpeciesId[]): void`: `this._desiredFeatures = new Set(ids)` (의도만 저장; reconcile은 update에서).
   - **앰비언트 스폰 재작성** (update 내, 기존 `_pool.activeCount`/`setActiveCount` 블록 대체):
     ```ts
     // 앰비언트: _ambientFish 길이를 _targetCount로 점진 수렴
     if (this._ambientFish.length < this._targetCount) {
       const next = nextActiveCount(this._ambientFish.length, this._targetCount, FISH.spawnPerTick)
       for (let i = this._ambientFish.length; i < next; i++) {
         this._nextSeed++
         const fish = this._pool.acquire()
         fish.reset(this._nextSeed, this._assignKind())
         this._ambientFish.push(fish)
       }
     } else {
       while (this._ambientFish.length > this._targetCount) {
         const fish = this._ambientFish.pop()!
         this._pool.release(fish)
       }
     }
     ```
   - **특별 개체 reconcile** (update 내, 앰비언트 다음):
     ```ts
     const target = new Set([...this._desiredFeatures].filter((id) => this.availableFeatures().has(id)))
     const active = new Set(this._featureActive.keys())
     const { acquire, release } = reconcileFeatures(target, active)
     for (const id of release) {
       const fish = this._featureActive.get(id)!
       this._pool.release(fish)
       this._featureActive.delete(id)
     }
     for (const id of acquire) {
       this._featureSeed++
       const fish = this._pool.acquire()
       fish.reset(this._featureSeed, 'individual', id)
       const p = featureSpawnPosition(this._featureSeed, FEATURE.spawnArea)
       fish.position.set(p.x, p.y, p.z) // 화면 안 즉시 등장
       this._featureActive.set(id, fish)
     }
     ```
   - update의 나머지(`_applyBoids`/`_applyLureSteer`/`forEachActive(update)`)는 **그대로** — 두 그룹 모두 포함됨.
   - `dispose`는 `_allFish` 전체를 dispose하므로 변경 불필요. `_ambientFish`/`_featureActive`는 dispose 시 clear만 추가(메모리 위생).
   - `setCount`/`activeCount`/`raycast`/`scareAt`/`feedAt`는 시그니처 유지(`activeCount`는 `_pool.activeCount` 그대로 — 헬스용 총합).
   - import: `reconcileFeatures, featureSpawnPosition` from `./featureHelpers`, `FEATURE` from config, `SPECIES_REGISTRY` from `./speciesRegistry`.

5. **TDD 테스트** (`__tests__/featureHelpers.test.ts`):
   - `reconcileFeatures`: target⊃active(acquire만), active⊃target(release만), 동일(둘 다 빈 배열 — 멱등), 부분 교차.
   - `featureSpawnPosition`: 결과가 항상 area 경계 내, 같은 seed→같은 좌표(결정적), 다른 seed→(일반적으로) 다른 좌표.

## Acceptance Criteria

```bash
npm run test
npm run build
npm run lint
```

## 검증 절차

1. AC 3개 종료코드 0. 신규 `featureHelpers` 테스트 통과 + 기존 FishSchool/boids/lure 회귀 없음.
2. 체크리스트:
   - 앰비언트 스폰이 `_ambientFish` 명시 추적으로 바뀌고, `setActiveCount`에 의존하지 않는가?
   - 특별 개체가 `_pool`을 공유하되 `_featureActive`로 분리 관리되는가?
   - `availableFeatures`가 로드된 프로토타입만 반환(유령 차단)?
   - `setEnabledFeatures`가 `_ready` 이전 호출돼도 throw 없이 의도만 저장 → update에서 적용?
3. **eval(harness smoke)**: 기본 `_desiredFeatures` 비어 있음 → 특별 개체 미등장. 앰비언트 렌더·물고기 수·투과·콘솔 모두 이전과 동일(회귀 0). 특별 개체 실제 등장/자세는 step 3 UI 연결 후 dev QA.
4. `index.json` step 1 갱신(`completed` + summary).

## 금지사항

- `_applyBoids`에 특별 개체를 넣지 마라(individual이라 자연 제외 — 추가 분기 불필요). 이유: 고래/상어가 무리지으면 안 됨.
- `ObjectPool.setActiveCount`로 앰비언트를 관리하지 마라. 이유: 끝에서 pop → 특별 개체 오삭제.
- UI·영속·main 배선을 이 step에서 하지 마라(step 2/3 scope). `setEnabledFeatures`는 정의만 하고 호출처는 두지 않는다.
- 스폰 시 매 프레임 다수 생성으로 프레임드랍 내지 마라(앰비언트는 `nextActiveCount` 점진 유지; 특별 개체는 최대 4개라 즉시 OK).
