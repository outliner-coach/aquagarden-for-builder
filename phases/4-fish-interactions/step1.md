# Step 1: fish-click-dialogue

## 읽어야 할 파일

- `/CLAUDE.md` (TDD, 매직넘버 금지, hidden 시 렌더 정지, 레이어 분리)
- `/docs/UI_GUIDE.md` (말풍선은 조용한 톤: 반투명 다크 + 청록 포인트, 네온/글래스모피즘 금지, 150ms 모션만)
- `/docs/ARCHITECTURE.md` (인터랙션은 `clickThrough===false`일 때만 캔버스 pointer 수신, `FishDialogue` 메모)
- `src/renderer/entities/speciesRegistry.ts` (step 0 산출 — `dialogue` 필드를 여기서 채운다, `displayName`)
- `src/renderer/entities/Fish.ts` (`mesh`, `_species` — species getter 추가 필요), `FishSchool.ts` (활성 물고기 순회 `forEachActive` via `_pool`)
- `src/renderer/core/SceneRoot.ts` (`camera`, `renderer.domElement`)
- `src/renderer/main.ts` (배선, `settings.clickThrough`/`settings.hidden`, ControlPanel hover)

## 작업

물고기를 **클릭하면 그 어종의 랜덤 대사**가 말풍선으로 뜬다. **`clickThrough===false` 그리고 `hidden===false`일 때만** 동작(투과 중엔 클릭이 바탕화면으로 가야 하므로 무시).

1. **대사 데이터**: `speciesRegistry.ts`의 각 어종 `dialogue`에 **한국어 대사 ≥10개**를 채운다. 주제: 평온함·사색·힐링·동기부여·내면의 탐구 + **각 어종 특성**(예: 흰동가리=말미잘과의 공생/안식처, 쏠배감펭=화려함 뒤의 고요, 네온테트라=무리 속의 나, 나비고기=우아함/유영). 톤은 짧고 잔잔한 문장(전역 지침: 한국어). 어종마다 내용이 겹치지 않게.
   - 예시(흰동가리): "산호 사이에서도 나만의 자리를 찾았어요.", "함께 흔들리는 것도 쉼이 됩니다." / (네온테트라): "무리 속에 있어도 나는 나예요." — 이런 결의 문장 ≥10개씩.
2. **순수 헬퍼** `src/renderer/entities/dialogueHelpers.ts`: `pickDialogue(count: number, random01: number): number` — 0..count-1 인덱스 결정적 선택. **TDD**(`__tests__/dialogueHelpers.test.ts`): 범위 내, 경계(0/1 근처) 클램프, count=0이면 -1.
3. **Fish/FishSchool 레이캐스트 지원**(시각/이동 로직 변경 금지, 읽기 전용 추가만):
   - `Fish`에 `get speciesId(): SpeciesId | null` getter 추가.
   - `FishSchool`에 `raycast(raycaster: THREE.Raycaster): Fish | null` 추가 — 활성 물고기 mesh들과 교차 검사 후, 히트한 Object3D의 상위 부모를 따라 소유 `Fish`를 찾아 반환(가장 가까운 교차).
4. **`FishDialogue` 엔티티**(`src/renderer/entities/FishDialogue.ts`):
   - 생성자에 `container`, `camera`, `canvas`(domElement), `fishSchool`, `isInteractive: () => boolean`(=`!clickThrough && !hidden`)를 받는다.
   - `canvas`에 `pointerdown` 리스너: `isInteractive()`가 false면 즉시 무시(투과/숨김 시 동작 안 함). true면 이벤트 좌표→NDC, `THREE.Raycaster.setFromCamera`, `fishSchool.raycast` → 히트 시 해당 species의 `dialogue`에서 `pickDialogue(len, Math.random())`로 한 줄 선택.
   - **말풍선 DOM**: 클릭 지점(또는 물고기 월드좌표를 화면 투영) 근처에 작은 반투명 다크 말풍선 + 청록 포인트. 화면 경계 클램프. 일정 시간(예 `DIALOGUE.holdMs`) 후 150ms fade로 사라짐(연속 클릭 시 갱신). UI_GUIDE 준수(네온/글로우/글래스 금지).
   - 매직넘버(holdMs·오프셋·최대폭 등)는 `config.ts`의 신규 `DIALOGUE` 상수.
5. **main.ts 배선**: `new FishDialogue(document.body, sceneRoot.camera, canvas!, fishSchool, () => !settings.clickThrough && !settings.hidden)`. 컨트롤 패널 위 클릭과는 분리(말풍선 리스너는 canvas에만).

## Acceptance Criteria

```bash
npm run test
npm run build
npm run lint
npm run smoke
```
추가(수동): `npm run dev`(투과 OFF)에서 물고기를 클릭하면 해당 어종 대사가 말풍선으로 뜨고, 투과 ON일 땐 뜨지 않고 클릭이 바탕화면으로 가는지 확인.

## 검증 절차

1. AC 4개 종료코드 0. `dialogueHelpers` 테스트 + "어종별 dialogue ≥10개·비어있지 않음·중복 과다 아님" 레지스트리 테스트 통과. `npm run smoke` pass(투과·블랭크·콘솔에러).
2. 체크리스트:
   - 어종마다 대사 ≥10개이고 주제/어종특성이 반영됐는가? (한국어, 잔잔한 톤)
   - 투과 OFF에서만 클릭 대사가 뜨고, 투과 ON에서는 무시되는가?
   - 말풍선이 UI_GUIDE 톤(조용·청록 포인트)이고 경계 클램프·자동 소멸하는가?
   - 물고기 이동/렌더 로직·풀링이 그대로인가?(읽기 전용 추가만) 매직넘버 제거?
3. **런타임 eval 게이트**: execute.py 스모크 자동 실행(per-step).
4. `phases/4-fish-interactions/index.json`의 step 1 갱신(성공 `completed`+`summary`, 실패 규칙 동일).

## 금지사항

- 투과(clickThrough) 또는 숨김 상태에서 캔버스 클릭을 가로채지 마라. 이유: 투과의 핵심은 뒤 화면 클릭 — 가로채면 요구사항 위반.
- `pointerdown` 리스너를 `window`/`document` 전역에 달아 컨트롤 패널 클릭까지 먹지 마라. 캔버스에만. 이유: 패널 조작 충돌.
- Fish의 이동·헤딩·믹서·풀링 로직을 수정하지 마라(getter/raycast 읽기 전용만). 이유: 검증된 거동 회귀 방지.
- 말풍선에 네온 글로우/글래스 블러/그라디언트 텍스트를 쓰지 마라(UI_GUIDE 안티패턴).
- 기존 테스트를 깨뜨리지 마라.
