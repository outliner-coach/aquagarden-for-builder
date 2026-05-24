# Step 1: shared-foundation

## 읽어야 할 파일

- `/docs/ARCHITECTURE.md` (`src/shared/` 역할, IPC 흐름)
- `/docs/PRD.md` (핵심 기능 — 어떤 설정 값이 필요한지)
- `/CLAUDE.md` (매직 넘버 금지 → config 상수 사용 규칙)
- `src/main/index.ts` (step 0에서 만든 창 — 어떤 값을 상수화할지 파악)

## 작업

`src/shared/`에 전 프로세스가 공유하는 상수·타입·IPC 채널을 정의한다. 부수효과 없는 순수 모듈만.

1. **`src/shared/config.ts`** — 매직 넘버를 한곳에 모은다.
   - `WINDOW`: `{ height: number; topMargin: number }` (가로 폭은 런타임에 디스플레이 작업영역 너비로 결정하므로 상수로 두지 않음). 예: `height: 220`, `topMargin: 0`.
   - `FISH`: `{ min: number; max: number; default: number }` 예: `min: 0, max: 60, default: 18` (max는 성능 상한 — ADR-005).
   - `LIGHT`: `{ minIntensity: number; maxIntensity: number; default01: number }` (default01은 0~1 슬라이더 기본값. 레퍼런스가 밝은 낮 분위기이므로 **0.75 내외 권장**).
   - `BUBBLE`: `{ maxParticles: number }`.
   - `CAMERA`: `{ fov, near, far }`.
   - `COLORS`: 물색 포인트 등 UI_GUIDE 값과 정합되는 hex/문자열.
   - 값은 `as const`로 고정한다.

2. **`src/shared/ipc-channels.ts`** — 채널명 문자열 상수.
   ```ts
   export const IPC = {
     TOGGLE_VISIBILITY: 'overlay:toggle-visibility',
     SET_CLICK_THROUGH: 'overlay:set-click-through',
     MOVE_WINDOW_BY: 'overlay:move-window-by',
     SET_ALWAYS_ON_TOP: 'overlay:set-always-on-top',
   } as const;
   ```
   (step 2·3에서 실제 핸들러가 이 상수를 사용한다.)

3. **`src/shared/types.ts`**
   - `AppSettings`: `{ fishCount: number; brightness01: number; hidden: boolean; clickThrough: boolean; }`
   - IPC 페이로드 타입: `MoveWindowByPayload { dx: number; dy: number }`, `SetClickThroughPayload { enabled: boolean }`, `SetVisibilityPayload { hidden: boolean }`.
   - preload가 노출할 API 형태 `AquaBridge` 인터페이스 (메서드 시그니처만; 구현은 step 3):
     ```ts
     export interface AquaBridge {
       moveWindowBy(dx: number, dy: number): void;
       setClickThrough(enabled: boolean): void;
       toggleVisibility(hidden: boolean): void;
       setAlwaysOnTop(enabled: boolean): void;
     }
     ```
   - `clampFishCount(n: number): number`, `clampBrightness01(n: number): number` 같은 순수 헬퍼는 여기 또는 `src/shared/clamp.ts`에 둔다 (config 범위로 clamp).

4. **테스트 (TDD)** — `src/shared/__tests__/`에:
   - `clampFishCount`가 `FISH.min`~`FISH.max`로 정확히 clamp되는지 (경계값 포함).
   - `clampBrightness01`이 0~1로 clamp되는지.
   - config 불변식: `FISH.min <= FISH.default <= FISH.max`, `LIGHT.minIntensity < LIGHT.maxIntensity`.
   - step 0의 sanity 테스트는 제거하거나 유지해도 됨.

## Acceptance Criteria

```bash
npm run build   # tsc --noEmit 타입 통과
npm run test    # shared 테스트 통과
npm run lint
```

## 검증 절차

1. AC 실행, 모두 종료코드 0 확인.
2. 체크리스트:
   - `src/shared/`에만 코드를 추가했는가? (다른 레이어 미수정)
   - 부수효과(파일 IO, electron import 등) 없이 순수한가?
   - 매직 넘버가 config로 빠졌는가?
3. `phases/0-mvp/index.json`의 step 1 업데이트:
   - 성공 → `completed` + `summary`에 "노출된 config 키, IPC 채널 상수, AppSettings/AquaBridge 타입, clamp 헬퍼 경로" 요약.
   - 실패/blocked는 규칙대로 기록.

## 금지사항

- 여기서 electron이나 three를 import하지 마라. 이유: shared는 양쪽에서 쓰는 순수 모듈이어야 하며 환경 의존을 가지면 안 된다.
- 실제 IPC 핸들러/창 제어를 구현하지 마라. 이유: 채널/타입 "정의"만 이 step의 책임. 구현은 step 2·3.
- 기존 테스트를 깨뜨리지 마라.
