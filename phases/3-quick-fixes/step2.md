# Step 2: non-fish-opacity-slider

## 읽어야 할 파일

- `/CLAUDE.md` (투명 캔버스 함정, hidden 시 렌더 정지, 매직넘버 금지)
- `/docs/ARCHITECTURE.md` (엔티티 `update`/`dispose` 인터페이스, SceneRoot 오케스트레이션, sceneOpacity 메모)
- `/docs/UI_GUIDE.md` (슬라이더 스타일·라벨 톤)
- `src/renderer/main.ts` (엔티티 인스턴스 배선, ControlPanel 콜백, `setWaterVeil`)
- `src/renderer/ui/ControlPanel.ts` (`_createSlider`, 콜백 인터페이스 `ControlPanelCallbacks`)
- `src/renderer/entities/Aquascape.ts`, `LightShafts.ts`, `GlowSprites.ts`, `Bubbles.ts` (페이드 대상)
- `src/renderer/entities/FishSchool.ts` (★ 제외 대상 — 물고기는 페이드하지 않는다)
- `src/shared/config.ts`, `src/shared/types.ts` (`AppSettings`)

## 작업

물고기를 **제외한** 3D 씬 요소(모래·수초·바위·유목·유리 엣지·커스틱이 입혀진 표면·라이트 샤프트·기포·글로우·수중 베일 DOM)를 한 슬라이더로 투명하게 만든다. 0% = 평소(전부 보임), 100% = 물고기만 남고 나머지는 사라짐.

**★ 제외 대상은 물고기뿐 아니라 ControlPanel(플로팅 버튼·확장 패널·슬라이더 등 모든 UI DOM)도 포함한다.** 슬라이더는 오직 비-물고기 **3D 씬 요소 + 수중 베일**에만 작용하고, UI 크롬은 항상 평소 불투명도를 유지한다(투명 슬라이더를 100%로 올려도 버튼/패널은 그대로 보여 조작 가능해야 한다).

1. **순수 헬퍼** `src/renderer/core/sceneOpacity.ts`(또는 entities 공유 위치): `sceneOpacityFactor(slider01: number): number` — 슬라이더 0~1을 비-물고기 요소 불투명도 배수(1=평소 → 0=완전 투명)로 매핑. **TDD: 테스트 먼저**(`__tests__/sceneOpacity.test.ts`): factor(0)=1, factor(1)=0, 단조 감소, 범위 클램프.
2. **엔티티에 `setSceneOpacity(factor: number)` 추가** (factor∈[0,1], 1=평소):
   - `Aquascape`: 보유 머티리얼들의 `opacity = baseOpacity * factor`, `transparent = true`. factor≤~0.01이면 `object3d.visible=false`로 두어 정렬/드로우 비용 제거, 그 외 `visible=true`. (모래/바위처럼 원래 불투명한 머티리얼도 transparent로 전환해 페이드.)
   - `LightShafts`·`GlowSprites`·`Bubbles`: 각자의 opacity uniform/머티리얼 opacity에 factor를 곱한다(기존 밝기 연동과 곱연산으로 공존).
   - 유리 엣지 라인 머티리얼도 factor 적용.
3. **수중 베일(DOM)**: `main.ts`의 `setWaterVeil`이 factor를 함께 받아 알파에 곱하도록 확장(또는 별도 `setVeilOpacity`). factor=0이면 베일 알파 0.
4. **ControlPanel 슬라이더 추가**: 라벨 예 `배경 투명도`(0~100%, 기본 0). 콜백 `onSceneTransparencyChange(t01)` 추가 → `main.ts`에서 `factor = sceneOpacityFactor(t01)`를 모든 비-물고기 엔티티/베일에 전파. `AppSettings`에 `sceneTransparency01` 필드 추가, `ControlPanelState`/`syncState`도 반영.
5. 물고기(`FishSchool`)와 ControlPanel(버튼/패널/슬라이더 등 UI DOM)에는 절대 적용하지 않는다. 베일 외 다른 DOM 오버레이를 페이드 대상에 넣지 말 것.
6. 매직넘버 금지 — 기본값/임계치는 config 상수(`LIGHT`/신규 `SCENE` 등) 또는 명명 상수.

## Acceptance Criteria

```bash
npm run test
npm run build
npm run lint
npm run smoke
```
추가(수동): `npm run dev`로 슬라이더 100%에서 **물고기만 남고** 배경(모래/수초/베일 등)이 사라지는지, 0%에서 평소대로 복귀하는지 확인.

## 검증 절차

1. AC 4개 종료코드 0. `sceneOpacity` 테스트 통과. `npm run smoke` pass(투과 보존·블랭크 아님·콘솔 에러 0).
2. 체크리스트:
   - 슬라이더 100%에서 비-물고기 3D 요소가 모두 투명해지고 **물고기와 ControlPanel(버튼/패널)은 그대로** 불투명한가?
   - 0%에서 원래 화면으로 정확히 복귀하는가?(opacity 곱연산이 밝기 연동과 충돌 없이)
   - factor=0에서 Aquascape가 `visible=false`로 드로우 비용을 줄이는가?
   - `THREE.Fog`/풀스크린 블룸 미도입, 투과 유지? 매직넘버 제거? 기존 테스트 유지?
3. **런타임 eval 게이트**: execute.py 스모크 자동 실행(per-step).
4. `phases/3-quick-fixes/index.json`의 step 2 갱신(성공 `completed`+`summary`, 실패 규칙 동일).

## 금지사항

- 물고기 머티리얼/가시성에 투명도를 적용하지 마라. 이유: 요구사항은 "물고기를 제외한 부분"만 투명.
- ControlPanel(버튼·패널·슬라이더 등 UI DOM)에 투명도를 적용하지 마라. 이유: UI는 항상 조작 가능해야 하며 사용자가 명시적으로 제외 요청함. 페이드 대상은 3D 씬 요소 + 수중 베일뿐.
- 기존 밝기 연동(`setBrightness01`)을 덮어쓰지 마라. 곱연산으로 공존시켜라. 이유: 두 슬라이더가 독립 동작해야 함.
- 머티리얼을 새로 생성/교체하지 마라(기존 인스턴스의 opacity/transparent만 조정). 이유: 풀링·공유 uniform 깨짐 방지.
- 기존 테스트를 깨뜨리지 마라.
