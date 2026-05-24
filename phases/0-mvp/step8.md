# Step 8: lighting-bubbles

## 읽어야 할 파일

- `/docs/PRD.md` (핵심기능 8·11: 조명 밝기, 기포 파티클; 밤↔낮 분위기)
- `/docs/ARCHITECTURE.md` (`lighting/Lighting.ts`, `entities/Bubbles.ts`)
- `/docs/ADR.md` (경량 철학)
- `/CLAUDE.md` (밝기→intensity 매핑은 순수 함수로 테스트)
- `/reference_image.png` (기본 낮 분위기의 밝기/수면 하이라이트, 기포 분산 참고)
- `src/renderer/core/SceneRoot.ts` (SceneEntity, 조명 추가)
- `src/renderer/core/ObjectPool.ts` (기포 재사용 가능)
- `src/shared/config.ts` (LIGHT, BUBBLE)

## 작업

상단 조명과 기포 파티클을 추가한다. 조명은 추후 슬라이더(step 9)와 동기화될 **밝기(0~1) → intensity/분위기** 매핑을 제공한다.

1. **`src/renderer/lighting/Lighting.ts`**
   - 수조 위에서 아래로 조사되는 메인 조명(`DirectionalLight` 또는 `SpotLight`) + 약한 ambient.
   - `setBrightness01(b: number): void` — 0~1 입력을 조명 intensity와 분위기(색온도/ambient)로 매핑.
     - 0 근처: 밤 분위기 — 어둡고 은은한 심해 느낌(낮은 intensity, 차가운/약한 톤). 필요 시 물고기 약한 자체 발광(emissive) 보강.
     - 1 근처: 낮 분위기 — 환하고 맑은 수조(높은 intensity).
   - **순수 헬퍼(테스트 대상)**: `brightnessToIntensity(b01: number, cfg): number` (LIGHT.min~max 선형/감마 매핑), 필요 시 `brightnessToAmbient(b01): number`. 0·1·중간값에서 기대 범위를 단위 테스트.
   - `update(dt)`는 필요 없으면 no-op.

2. **`src/renderer/entities/Bubbles.ts`** — `SceneEntity` 구현.
   - 바닥에서 수면으로 올라가는 반투명 기포 파티클. **수조 전폭(가로 바)에 고르게 분산**(레퍼런스). `THREE.Points` + 커스텀/기본 PointsMaterial(투명, 부드러운 알파). 또는 작은 인스턴스 메시.
   - 입자는 위로 상승하다 상단 도달 시 바닥으로 재배치(재사용 — 풀/순환 버퍼). `config.BUBBLE.maxParticles` 상한.
   - `update(dt)`에서 위치 상승 + 약한 좌우 흔들림. 가볍게 유지.
   - **순수 헬퍼(테스트 대상)**: `respawnIfAboveSurface(y, surfaceY, floorY): y` 또는 상승/리셋 위치 계산을 순수 함수로 분리해 테스트.

3. **`main.ts`/SceneRoot에 등록** — Lighting과 Bubbles를 씬에 추가. 초기 밝기는 `config.LIGHT.default01`.

## Acceptance Criteria

```bash
npm run build
npm run test    # brightnessToIntensity 매핑, 기포 리스폰 위치 계산 테스트 통과
npm run lint
```

## 검증 절차

1. AC 실행, 모두 0 확인.
2. `npm run dev`로 상단 조명이 비치고 바닥에서 기포가 뽀글뽀글 올라가는지, 밝기를 코드로 0/1로 바꿔보면 밤↔낮 분위기가 전환되는지 **수동 확인**.
3. 체크리스트:
   - `setBrightness01`이 0~1을 안전히 매핑하는가? (경계 clamp)
   - 기포가 새로 생성/파괴되지 않고 순환 재사용되는가? (경량)
   - 투명 배경이 유지되는가?
4. `phases/0-mvp/index.json`의 step 8 업데이트:
   - 성공 → `completed` + `summary`에 "Lighting.setBrightness01/매핑 함수, Bubbles 파티클 방식·상한, 등록 위치" 요약.

## 금지사항

- 슬라이더 UI를 만들지 마라. 이유: step 9에서 `setBrightness01`/`setCount`에 배선한다. 여기선 프로그램 API까지.
- 무거운 후처리(블룸 등)나 사실적 물 굴절 셰이더를 넣지 마라. 이유: 경량 철학(ADR), MVP 제외 사항.
- 기존 테스트를 깨뜨리지 마라.
