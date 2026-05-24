# Step 2: feed-and-scare

## 읽어야 할 파일

- `/CLAUDE.md` (CRITICAL: TDD로 순수 벡터 로직 먼저, 풀링 재사용, hidden 시 렌더 정지, 매직넘버 금지)
- `/docs/UI_GUIDE.md` (버튼 톤 — 조용한 도구, armed 상태 표시도 과하지 않게)
- `/docs/ARCHITECTURE.md` (인터랙션은 `clickThrough===false`일 때만, `FoodLure`/`FoodParticles`/`lureHelpers` 메모, 엔티티 update/dispose 인터페이스)
- `src/renderer/entities/boids.ts` (순수 조향 벡터 패턴 — 동일 스타일로 작성), `src/renderer/entities/__tests__/boids.test.ts`
- `src/renderer/entities/FishSchool.ts` (`update`에서 boids 후 외부 steer 적용 지점, `_pool.forEachActive`, `Fish.applySteer`), `Fish.ts` (`position`,`velocity`,`applySteer`)
- `src/renderer/core/ObjectPool.ts` (먹이 입자 풀링), `src/renderer/entities/Bubbles.ts`(스프라이트/풀 패턴 참고)
- `src/renderer/core/SceneRoot.ts` (`camera`, `renderer.domElement`), `src/renderer/main.ts` (배선), `src/renderer/ui/ControlPanel.ts`, `src/shared/config.ts`(`FISH.bounds`)

## 작업

`[먹이주기]`·`[물고기 놀래키기]` 버튼을 추가하고, **버튼으로 모드를 켠 뒤 수조를 클릭**하면 그 지점을 기준으로:
- **먹이주기**: 그 지점 위에서 먹이가 떨어지고, 물고기들이 **슬금슬금**(부드럽게) 모여 먹는다.
- **놀래키기**: 물고기들이 그 지점에서 **잽싸게 도망**친다(짧게 속도↑).

**`clickThrough===false` 그리고 `hidden===false`일 때만** 캔버스 클릭을 받는다(투과 중 무시).

1. **순수 헬퍼** `src/renderer/entities/lureHelpers.ts` (boids.ts 스타일, **TDD 먼저** `__tests__/lureHelpers.test.ts`):
   - `attractSteer(pos, target, weight, radius): Vec3` — target 방향, 거리 감쇠(가까울수록 약해지거나 일정), radius 밖이면 약함/0. 부드러운 모임용(작은 weight).
   - `fleeSteer(pos, target, weight, radius): Vec3` — target 반대 방향, radius 안에서만 강하게(가까울수록 강). 도망용(큰 weight).
   - `foodFallDelta(dt, fallSpeed): number`, 소비 판정 `isEaten(fishPos, foodPos, eatRadius): boolean` 등 결정적 함수.
   - 테스트: 방향 부호(향함/멀어짐), radius 경계, weight 스케일, 0거리 안전.
2. **`FoodParticles` 엔티티**(`src/renderer/entities/FoodParticles.ts`): 풀링된 작은 입자. `spawn(point: Vec3, count)` → point 약간 위/주변에서 생성해 `foodFallDelta`로 낙하. 바닥(`FISH.bounds.minY` 부근) 도달 또는 lifetime 초과 또는 **물고기가 먹으면**(소비) 비활성. `activePositions()`로 현재 먹이 위치 제공. SceneEntity 인터페이스(update/dispose/object3d).
3. **FishSchool 연동**(이동/풀링 기존 거동 보존, 외부 steer 추가만):
   - `feedAt(point)`: feed 상태 on(먹이 입자 존재 동안). `update`에서 활성 물고기마다 **가장 가까운 먹이 입자(또는 feed point)** 로 `attractSteer` 적용(작은 weight = 슬금슬금). 충분히 가까우면 그 입자를 `isEaten`으로 소비 요청.
   - `scareAt(point)`: scare 타이머(`LURE.scareDurationMs`) on. 동안 활성 물고기마다 `fleeSteer`(큰 weight) 적용 + 최대 속도 일시 상향. 타이머 종료 시 평소 복귀.
   - 두 steer는 기존 boids 결과에 `applySteer`로 합산(덮어쓰지 말 것).
4. **`FoodLure` 컨트롤러**(`src/renderer/entities/FoodLure.ts` 또는 main 배선): armed 모드(`'feed'|'scare'|null`, 한 번에 하나) 보유. 캔버스 `pointerdown`에서 `isInteractive()` true일 때만, 화면 좌표→월드 좌표(레이캐스터+`z`=고정 평면 또는 unproject, `FISH.bounds` 내 클램프) 변환 후 모드에 따라 `fishSchool.feedAt`+`foodParticles.spawn` 또는 `fishSchool.scareAt` 호출. 모드는 토글(다시 누르면 해제, 다른 모드 선택 시 전환).
5. **ControlPanel**: `[먹이주기]`·`[물고기 놀래키기]` 버튼 2개 추가(armed 시 청록 포인트로 활성 표시, 비활성은 평소). 콜백 `onLureModeChange(mode)`. UI_GUIDE 톤 유지(장식 금지).
6. 매직넘버 전부 `config.ts` 신규 `LURE`/`FOOD` 상수.

## Acceptance Criteria

```bash
npm run test
npm run build
npm run lint
npm run smoke
```
추가(수동): `npm run dev`(투과 OFF)에서 `[먹이주기]` 후 클릭 → 먹이 낙하 + 물고기 모임/섭취, `[놀래키기]` 후 클릭 → 물고기 도망. 투과 ON에서는 동작 안 함을 확인.

## 검증 절차

1. AC 4개 종료코드 0. `lureHelpers` 테스트(방향·radius·weight) 통과. `npm run smoke` pass(투과·블랭크·콘솔에러 0).
2. 체크리스트:
   - 먹이주기: 먹이가 떨어지고 물고기가 부드럽게 모여 먹는가? 먹이 입자가 풀링되고 소비/바닥에서 사라지는가?
   - 놀래키기: 클릭 지점에서 물고기가 잽싸게 흩어지고 잠시 후 복귀하는가?
   - 투과 OFF에서만 동작하고, 버튼 armed 상태가 시각적으로 보이는가?
   - boids·풀링·헤딩 기존 거동이 보존(steer 합산만)되는가? 매직넘버 제거?
3. **런타임 eval 게이트**: execute.py 스모크 자동 실행. 이 step은 **phase 마지막**이므로 phase-끝 비전 eval(레퍼런스 대비)도 통과해야 한다.
4. `phases/4-fish-interactions/index.json`의 step 2 갱신(성공 `completed`+`summary`, 실패 규칙 동일).

## 금지사항

- 투과/숨김 상태에서 캔버스 클릭을 가로채지 마라. 이유: 투과의 핵심(뒤 화면 클릭) 위반.
- 먹이 입자를 매 클릭마다 생성/파괴하지 마라 — 풀링 재사용. 이유: CLAUDE 풀링 규칙·프레임 드랍 방지.
- boids/wander 결과를 덮어쓰지 말고 `applySteer`로 합산하라. 이유: 검증된 군집 거동 보존.
- scare 속도 상향을 영구로 두지 마라(타이머 후 복귀). 이유: 힐링 위젯의 잔잔함 유지.
- `THREE.Fog`/풀스크린 블룸 미도입, 투과 유지. 매직넘버 금지. 기존 테스트를 깨뜨리지 마라.
