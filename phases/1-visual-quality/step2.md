# Step 2: fish-pool-swim

## 읽어야 할 파일

- `/docs/superpowers/specs/2026-05-24-aquagarden-visual-quality-design.md` (§3.2 물고기 — 풀링/셰이더 벤딩/림라이트)
- `/docs/ADR.md` (ADR-005 풀링, ADR-006 boids, ADR-004 순수 분리)
- `/CLAUDE.md` (CRITICAL: 풀링 재사용, 비동기 분할 생성, TDD)
- `src/renderer/entities/fishAssets.ts` (step 1 산출 — 매니페스트, loadFishPrototypes, pickSpecies, FishPrototype)
- `src/renderer/entities/Fish.ts` (현재 절차적 물고기 — 유영/조향/꼬리 로직을 GLB 기반으로 교체)
- `src/renderer/entities/FishSchool.ts` (풀 + boids + 개체수 제어 — 비동기 로딩 연동 필요)
- `src/renderer/entities/boids.ts` + `src/renderer/core/ObjectPool.ts` (그대로 재사용)
- `src/shared/config.ts` (FISH 상수)

## 작업

물고기를 GLB 프로토타입 클론으로 교체하고, 헤엄을 셰이더 바디 벤딩으로 구현하며, 림라이트로 입체감을 준다. **boids·풀링·개체수 슬라이더 동작은 보존**한다.

1. **`Fish.ts` 리팩터 — GLB 클론 + 셰이더 헤엄**
   - 생성자/`reset`에서 절차적 icosahedron+삼각꼬리 대신, 주어진 `FishPrototype`의 geometry를 공유하는 `THREE.Mesh`를 만든다(geometry는 공유, 머티리얼은 인스턴스별).
   - 머티리얼: `MeshStandardMaterial`(step 0의 IBL을 받음). 시드 기반 색 틴트(약하게)·크기 변주 유지(기존 variant 다양성의 정신).
   - **헤엄 = 버텍스 셰이더 바디 벤딩**: `material.onBeforeCompile`로 vertex 단계에서 본문(+X 정면 기준) x좌표를 따라 yaw(수평) 사인파 변위를 준다. 꼬리(뒤쪽, -x)로 갈수록 진폭 증가.
     - uniform: `uTime`, `uSwimAmp`, `uSwimSpeed`, `uPhase`(개체별). update에서 `uTime` 갱신.
     - 진폭/속도는 종 매니페스트(`swimAmplitude`/`swimSpeed`) + 이동 속도에 비례.
   - 기존 공개 인터페이스(`mesh`, `position`, `velocity`, `kind`, `reset(seed,kind)`, `applySteer`, `setVisible`, `update(dt)`, `dispose()`)는 **시그니처 유지**한다. FishSchool/boids가 그대로 동작해야 한다.
   - 진행 방향 회전(`rotation.y`)·경계 회피·wander·속도 클램프 로직은 보존(혹은 동등 이동). 꼬리 회전 트릭은 셰이더 벤딩으로 대체.
   - **림라이트/프레넬**: 같은 `onBeforeCompile`의 fragment 단계에서 `pow(1.0 - dot(normal, viewDir), p)`를 emissive에 더해 가장자리 발광. 저폴리 입체감 강화.
   - reset 시 종 선택은 `pickSpecies(seed, kind)`로, 해당 프로토타입 geometry를 사용.

2. **`FishSchool.ts` — 비동기 프로토타입 연동**
   - `loadFishPrototypes()`를 await해 프로토타입 맵을 확보한 뒤 풀을 구성한다. 로딩 완료 전에는 물고기 0마리(또는 로딩 표시 없이 빈 상태)로 두고, 완료 후 현재 fishCount로 채운다.
   - CRITICAL(ADR-005 + CLAUDE.md): 개체수 증가는 **비동기 분할 생성**(기존 `FISH.spawnPerTick` 패턴)으로 프레임당 소수만 활성화해 프레임드랍을 막는다. 클론은 geometry 공유라 가볍지만 머티리얼/Mesh 생성은 분할 유지.
   - 프로토타입이 비어 있으면(전부 로드 실패) 콘솔 경고 후 안전하게 빈 풀 유지(앱이 죽지 않게).
   - boids 적용부(boids.ts 사용)는 그대로.

3. **`main.ts` 등 부트스트랩**: FishSchool 초기화가 async가 되므로 호출부를 그에 맞게 조정(렌더 루프는 즉시 시작, 물고기는 로드되는 대로 등장).

4. **순수 헬퍼 (TDD 먼저)**
   - 셰이더에 넘기기 전 CPU측 계산이 있으면(예: 개체별 phase 산출 `seedToPhase(seed)`, 속도→진폭 매핑 `swimAmplitudeFor(speed, base)`) 순수 함수로 분리해 `__tests__/`에 테스트.
   - 기존 `fishHelpers.ts`가 있으면 거기에 추가.

## Acceptance Criteria

```bash
npm run test
npm run build
npm run lint
```

## 검증 절차

1. AC 3개 종료코드 0. 신규 순수 헬퍼 테스트 + 기존 boids/fishHelpers 테스트 통과.
2. `npm run dev` **수동 확인**: (a) GLB 물고기(흰동가리·나비고기·쏠배감펭·슬림 2종)가 보이고 종이 구분되며, (b) 몸통이 사인파로 휘며 헤엄치고, (c) 가장자리 림라이트가 보이며, (d) 개체수 슬라이더를 빠르게 올려도 눈에 띄는 프레임드랍이 없다, (e) 진행 방향으로 정면(+X)이 향한다(뒤집히거나 옆으로 가지 않음 — 아니면 step 1의 축 정렬 재확인).
3. 아키텍처 체크리스트:
   - geometry를 종별로 공유(클론)하는가? 매 reset마다 geometry를 새로 만들지 않는가? (ADR-005)
   - 개체수 증가가 비동기 분할인가? (프레임드랍 방지 — CRITICAL)
   - AnimationMixer/본을 쓰지 않고 셰이더 벤딩으로 헤엄하는가?
   - Fish 공개 인터페이스가 유지돼 boids/FishSchool이 동작하는가?
   - hidden 시 렌더 정지에 영향 없는가?(루프는 step 0/기존 유지)
4. `phases/1-visual-quality/index.json`의 step 2 갱신:
   - 성공 → `completed` + `summary`에 "Fish를 GLB 클론(geometry 공유)+MeshStandard로 교체, onBeforeCompile 바디 벤딩 헤엄+림라이트, FishSchool 비동기 프로토타입 로딩·분할 생성, boids/풀링 보존" 요약.
   - 실패 3회 → `error`. 사용자 개입 → `blocked`.

## 금지사항

- 매 `reset`마다 geometry를 새로 생성하지 마라. 이유: 풀링 취지(GC/할당 스파이크 방지)에 반한다(ADR-005).
- 개체수 변경 시 동기적으로 전부 생성하지 마라. 이유: 프레임드랍(렉) 발생(CLAUDE.md/ADR-005).
- `AnimationMixer`/본 애니메이션을 도입하지 마라. 이유: 개체당 CPU 비용 증가, 설계는 셰이더 벤딩.
- boids 로직(boids.ts)이나 ObjectPool 제네릭을 물고기 전용으로 훼손하지 마라.
- 수초/유목/모래/커스틱/물 효과를 건드리지 마라. 이유: 각각 step 3~7.
- 기존 테스트를 깨뜨리지 마라.
