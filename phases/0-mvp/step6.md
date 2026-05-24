# Step 6: fish-pool

## 읽어야 할 파일

- `/docs/PRD.md` (핵심기능 7·10: 개체수 슬라이더 연동, 자유 유영)
- `/docs/ARCHITECTURE.md` (`entities/Fish.ts`, `entities/FishSchool.ts`, ObjectPool 사용)
- `/docs/ADR.md` (ADR-005 풀링, 비동기 분할 스폰)
- `/CLAUDE.md` (CRITICAL: 풀링으로 재사용, 비동기 스폰으로 프레임드랍 방지)
- `/reference_image.png` (물고기 종류·색·크기 다양성 — **이미지를 직접 열어 보고** 맞춰라)
- `src/renderer/core/ObjectPool.ts`, `src/renderer/core/SceneRoot.ts`
- `src/shared/config.ts` (FISH min/max/default), `src/shared/types.ts` (clampFishCount)

## 작업

풀 기반으로 개체수가 실시간 증감하는 자유 유영 물고기를 구현한다. **군집(boids)은 step 7**이며, 여기서는 개별 유영 + 풀 제어까지.

1. **`src/renderer/entities/Fish.ts`**
   - 로우폴리 물고기 메시(≤ 2000 tri — ADR/요구사항). 절차적 geometry 또는 단순 모델로 구성.
   - **종/색 다양성(레퍼런스 기준)**: 최소 2개 부류로 구분한다 — (a) **소형 군집어**(작고 가늘며 무리 짓는 타입; 네온테트라처럼 청/적 줄무늬 색) 와 (b) **개별 대형어**(구피·노랑/점박이 몰리·엔젤피시처럼 크고 색이 뚜렷한 타입). 색·크기·지느러미 형태를 변형해 다양하게 보이도록.
   - `FishKind`(또는 유사) 타입으로 부류를 표현하고, 크기·색·boids 참여 여부를 부류별로 다르게 둔다.
   - 상태: `position`, `velocity`, `wanderPhase` 등. `update(dt)`에서 부드러운 자유 유영(완만한 방향 전환 + 꼬리 흔들림). 수조 경계(보이지 않는 박스)에서 부드럽게 반전/선회.
   - `reset(seed, kind)`로 풀 재사용 시 부류/색을 초기화.

2. **`src/renderer/entities/FishSchool.ts`** — `SceneEntity` 구현. `ObjectPool<Fish>` 보유.
   - `setCount(n: number)` — `clampFishCount`로 범위 보정 후 `pool.setActiveCount`. **증가분은 비동기 분할 스폰**: 한 프레임에 전부 활성화하지 말고 프레임당 소량씩(예: 2~4마리) 늘려 스파이크 방지(ADR/CRITICAL). 감소는 즉시 비활성 가능.
   - `update(dt)` — 활성 물고기만 `update(dt)`. (이 step에서는 개별 유영. boids 훅 지점은 step 7에서 주입)
   - 초기 개체수는 `config.FISH.default`.
   - **순수 헬퍼(테스트 대상)**: `planSpawnSchedule(current:number, target:number, perTick:number): number[]` 또는 `nextActiveCount(current, target, perTick): number` — 매 틱 목표를 향해 perTick 이하로 수렴하는 다음 활성 수를 계산. 이를 단위 테스트(증가/감소/도달/perTick 상한).

3. **`main.ts`에 등록** — `FishSchool`을 `sceneRoot.add(...)`. 기본 개체수로 시작.

## Acceptance Criteria

```bash
npm run build
npm run test    # nextActiveCount(점진 수렴), clampFishCount 연동 테스트 통과
npm run lint
```

## 검증 절차

1. AC 실행, 모두 0 확인.
2. `npm run dev`로 물고기들이 자연스럽게 유영하고 경계에서 부드럽게 선회하는지 **수동 확인**.
3. 체크리스트:
   - `setCount` 변경 시 생성/파괴가 아니라 풀 활성 개수 조정인가? (ADR-005)
   - 증가가 프레임당 소량씩 분할되는가? (비동기 스폰 — CRITICAL)
   - 개체수가 `config.FISH.max`를 넘지 않는가?
4. `phases/0-mvp/index.json`의 step 6 업데이트:
   - 성공 → `completed` + `summary`에 "Fish/FishSchool API(setCount/update), 분할 스폰 방식, nextActiveCount 헬퍼, 기본 개체수" 요약.

## 금지사항

- boids 군집 로직을 여기서 구현하지 마라. 이유: step 7 소관. 단, step 7이 주입할 수 있도록 `update`에서 외부 가속도/방향을 받을 수 있는 훅(예: `applySteer(v)` 또는 update 전 콜백)만 열어둬라.
- 슬라이더 UI를 만들지 마라. 이유: step 9. 여기선 `setCount(n)` 프로그램 API까지.
- 개체수 증가 시 한 프레임에 수십 마리를 한꺼번에 생성하지 마라. 이유: 프레임 드랍(렉) — 요구사항 위반.
- 기존 테스트를 깨뜨리지 마라.
