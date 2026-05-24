# Step 4: render-core

## 읽어야 할 파일

- `/docs/ARCHITECTURE.md` (`src/renderer/core/` — RenderLoop, SceneRoot, ObjectPool)
- `/docs/ADR.md` (ADR-002 알파 투명, ADR-004 순수 분리, ADR-005 풀링)
- `/CLAUDE.md` (CRITICAL: hidden 시 렌더 루프 정지)
- `src/renderer/main.ts` (step 0의 더미 큐브 — 여기서 코어로 교체)
- `src/shared/config.ts` (CAMERA 등)

## 작업

Three.js 렌더링 기반(코어)을 만든다. 엔티티(물고기·수초 등)는 이후 step이 이 코어 위에 올린다.

1. **`src/renderer/core/SceneRoot.ts`**
   - `class SceneRoot` — `THREE.Scene`, `THREE.PerspectiveCamera`(config.CAMERA), `THREE.WebGLRenderer({ alpha: true, antialias: true })` 보유.
   - 생성자에서 `renderer.setClearColor(0x000000, 0)` (완전 투명 배경 — 바탕화면 투과). `renderer.setPixelRatio(window.devicePixelRatio)`.
   - 캔버스를 `#app`에 부착. 가로 바 비율에 맞춘 카메라 aspect.
   - `add(entity)` / `update(dt)` / `render()` / `resize()` / `dispose()`.
   - 엔티티 인터페이스 `SceneEntity { update(dt: number): void; dispose(): void; object3d: THREE.Object3D }`를 정의/별도 export. SceneRoot는 등록된 엔티티들의 `update(dt)`를 순회 호출.
   - `resize()`는 `window.resize`에 바인딩, 카메라 aspect/renderer size 갱신.

2. **`src/renderer/core/RenderLoop.ts`**
   - `class RenderLoop` — 단일 `requestAnimationFrame` 소유자. `start()`, `stop()`, `get running(): boolean`.
   - 매 프레임 dt(초)를 계산해 콜백 `(dt:number)=>void` 호출. dt는 과도한 값 방지를 위해 상한(예: 0.1s)으로 클램프.
   - CRITICAL: `stop()` 시 `cancelAnimationFrame`으로 완전히 멈춰 CPU/GPU 점유가 0이 되어야 한다. `start()` 중복 호출이 루프를 중첩 생성하면 안 된다(가드).
   - **순수 헬퍼(테스트 대상)**: dt 계산/클램프 로직 `computeDelta(prevMs, nowMs, maxDt): number` 를 순수 함수로 분리.

3. **`src/renderer/core/ObjectPool.ts`** (ADR-005)
   - 제네릭 `class ObjectPool<T>` — 생성자 `(factory: () => T, reset?: (t:T)=>void)`.
   - `acquire(): T` (비활성 없으면 factory로 생성), `release(t: T)`, `setActiveCount(n: number)` (목표 활성 개수로 grow/shrink — 비활성은 풀에 보관), `get activeCount(): number`, `forEachActive(fn)`.
   - 활성/비활성을 배열로 관리. 생성은 누적, 파괴는 하지 않고 재사용.
   - **테스트 대상**: `setActiveCount` 증가/감소/0/상한에서 activeCount와 누적 생성 수가 기대대로인지.

4. **`src/renderer/main.ts` 교체**
   - 더미 큐브 제거. `SceneRoot` + `RenderLoop` 구성. 루프 콜백에서 `sceneRoot.update(dt); sceneRoot.render();`.
   - 아직 엔티티가 없으니 빈 씬을 투명 렌더한다 (검증용으로 임시 작은 와이어프레임 1개 정도는 허용, 단 step 5에서 제거).
   - `document.visibilitychange` 또는 추후 IPC로 hidden 시 `loop.stop()` 훅 지점을 주석으로 표시 (실제 배선은 step 9).

## Acceptance Criteria

```bash
npm run build
npm run test    # computeDelta, ObjectPool.setActiveCount 단위 테스트 통과
npm run lint
```

## 검증 절차

1. AC 실행, 모두 0 확인.
2. `npm run dev`로 투명 배경(바탕화면 비침) 위에 빈/최소 씬이 뜨는지 **수동 확인**.
3. 체크리스트:
   - `RenderLoop.stop()`이 rAF를 확실히 취소하는가? (hidden 시 정지 — CRITICAL)
   - `ObjectPool`이 파괴 대신 재사용하는가? (ADR-005)
   - 순수 헬퍼(computeDelta, 풀 카운트 로직)가 three/DOM 없이 테스트되는가? (ObjectPool은 DOM 비의존이어야 함 — 제네릭이므로 가능)
4. `phases/0-mvp/index.json`의 step 4 업데이트:
   - 성공 → `completed` + `summary`에 "SceneEntity 인터페이스, SceneRoot/RenderLoop/ObjectPool API, 투명 렌더 설정(clearAlpha 0)" 요약.

## 금지사항

- 물고기/수초/조명/파티클을 만들지 마라. 이유: 콘텐츠는 step 5~8. 여기는 코어 인프라만.
- ObjectPool을 Fish 전용으로 만들지 마라. 이유: 제네릭이어야 다른 엔티티에도 재사용 가능.
- 기존 테스트를 깨뜨리지 마라.
