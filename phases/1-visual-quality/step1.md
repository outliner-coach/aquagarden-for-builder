# Step 1: fish-assets-loader

## 읽어야 할 파일

- `/docs/superpowers/specs/2026-05-24-aquagarden-visual-quality-design.md` (§3.2 물고기 — GLB 소싱/로딩/헤엄, §1 결정사항)
- `/docs/ARCHITECTURE.md` (entities 레이어, 순수 분리)
- `/docs/ADR.md` (ADR-004 순수 분리, ADR-005 풀링)
- `/CLAUDE.md` (TDD 규칙, 레이어 규칙, 매직넘버 금지)
- `src/renderer/assets/fish/CREDITS.md` (확보된 GLB 5개와 용도 — clownfish/butterflyfish/lionfish=개체, tetra-a/tetra-b=군집, 모두 CC0)
- `src/renderer/entities/Fish.ts` (현재 물고기 — 종/variant 개념, FishKind 타입 참고. 이번 step은 로더만, Fish 교체는 step 2)
- `src/shared/config.ts`

## 작업

확보된 GLB 어류 에셋(`src/renderer/assets/fish/*.glb`)을 로드·정규화하는 **에셋 레이어**를 만든다. 이 step은 데이터(매니페스트) + 로딩/정규화 유틸까지만. 풀링·셰이더·실제 배치는 step 2.

CRITICAL 결정사항: GLB에 헤엄 리그가 포함돼 있으나 **리그를 사용하지 않는다**. SkinnedMesh의 geometry(바인드 포즈)만 추출해 정적 메시로 쓰고, 움직임은 step 2의 셰이더 바디 벤딩으로 만든다. `AnimationMixer`/`SkeletonUtils`를 쓰지 마라.

1. **`src/renderer/entities/fishAssets.ts` — 매니페스트 + 타입**
   - 종 식별자 타입 `SpeciesId = 'clownfish' | 'butterflyfish' | 'lionfish' | 'tetra-a' | 'tetra-b'`.
   - `interface FishSpecies { id: SpeciesId; file: string; kind: FishKind; baseScale: number; swimAmplitude: number; swimSpeed: number }` (`FishKind`는 Fish.ts에서 import 또는 shared로 이동).
   - `FISH_SPECIES: readonly FishSpecies[]` 매니페스트. file 경로는 Vite가 번들하도록 import URL로 처리한다:
     ```ts
     import clownfishUrl from '../assets/fish/clownfish.glb?url'
     ```
     (electron-vite/Vite의 `?url` import. 각 glb를 이렇게 import해 `file`에 URL을 넣는다.)
   - 군집(schooling) = tetra-a, tetra-b. 개체(individual) = clownfish, butterflyfish, lionfish. baseScale은 군집 작게/개체 크게(기존 Fish.ts의 BASE_SCALE 값 참고해 합리적 초기값, 추후 튜닝).

2. **`src/renderer/entities/fishAssets.ts` — 순수 헬퍼 (TDD 먼저)**
   - `pickSpecies(seed: number, kind: FishKind): SpeciesId` — 시드 기반 결정적 종 선택(해당 kind의 종 중에서). 기존 Fish.ts의 pseudoRandom 패턴과 호환.
   - `computeNormalizeTransform(bbox: { min:{x,y,z}, max:{x,y,z} }): { scale: number; offset: {x,y,z} }` — 모델을 (a) 원점 중심으로 옮기고 (b) 본문 길이가 1 단위가 되도록 하는 scale/offset 계산. 순수 함수.
   - `__tests__/fishAssets.test.ts`에 테스트 먼저: 매니페스트 무결성(5종, kind 분포 2군집/3개체, baseScale>0), `pickSpecies`가 kind에 맞는 종만 반환·결정적, `computeNormalizeTransform`이 알려진 bbox에서 기대 scale/offset 반환.

3. **`src/renderer/entities/fishAssets.ts` — 로딩 유틸 (부수효과, 테스트 제외)**
   - `async function loadFishPrototypes(): Promise<Map<SpeciesId, FishPrototype>>`
     - `FishPrototype { geometry: THREE.BufferGeometry; sourceForwardAxis: '+x'|'+z'|...; baseScale: number; swimAmplitude: number; swimSpeed: number }` (또는 정규화·정렬까지 마친 단일 Mesh 템플릿).
     - `GLTFLoader`(`three/examples/jsm/loaders/GLTFLoader.js`)로 각 종 로드.
     - 로드된 씬에서 **첫 메시의 geometry를 추출**(SkinnedMesh여도 geometry만). skin/bone 속성 제거 또는 무시.
     - `computeNormalizeTransform`으로 정규화(중심·길이 1)하고, **진행 방향이 +X가 되도록** geometry를 회전(소스 모델의 정면 축을 확인해 맞춘다 — Quaternius 어류의 정면 축을 dev에서 확인). 이유: step 2의 헤엄/조향 코드가 +X 정면을 가정.
     - geometry는 종별 1회만 생성해 프로토타입으로 보관(클론은 step 2에서).
   - 로드 실패 시: 콘솔 경고 후 해당 종 스킵(맵에서 제외). 전부 실패해도 throw하지 말고 빈 맵 반환(step 2가 폴백 판단).

## Acceptance Criteria

```bash
npm run test
npm run build
npm run lint
```

## 검증 절차

1. AC 3개 종료코드 0. `fishAssets.test.ts`(매니페스트·pickSpecies·computeNormalizeTransform) 통과.
2. `npm run build`가 `?url` glb import를 번들하는지 확인(에셋이 out/ 산출물에 포함되거나 URL로 해석). 빌드 에러 없을 것.
3. 아키텍처 체크리스트:
   - 리그/AnimationMixer/SkeletonUtils를 쓰지 않았는가? (정적 메시 + 추후 셰이더 벤딩 — CRITICAL)
   - 순수 헬퍼(pickSpecies, computeNormalizeTransform)가 three/DOM 없이 테스트되는가?
   - geometry 프로토타입을 종별 1회만 만들도록 설계됐는가?(클론 재사용 — ADR-005 정신)
   - 매직넘버 대신 매니페스트/상수를 썼는가?
4. `phases/1-visual-quality/index.json`의 step 1 갱신:
   - 성공 → `completed` + `summary`에 "fishAssets.ts: 5종 CC0 GLB 매니페스트(?url import), loadFishPrototypes(geometry 추출·정규화·+X 정렬, 리그 무시), pickSpecies/computeNormalizeTransform 순수함수+테스트" 요약.
   - 실패 3회 → `error` + `error_message`. 사용자 개입 → `blocked` + `blocked_reason`.

## 금지사항

- `AnimationMixer`, `SkeletonUtils`, 본 애니메이션을 쓰지 마라. 이유: 개체당 비용이 커지고, 우리는 셰이더 벤딩(step 2)으로 헤엄을 만든다(설계 결정).
- `Fish.ts`/`FishSchool.ts`/`ObjectPool`을 수정하지 마라. 이유: 물고기 풀링·셰이더는 step 2 담당. 이 step은 에셋 레이어만.
- 새 외부 npm 패키지를 추가하지 마라. 이유: GLTFLoader/RoomEnvironment는 이미 설치된 three examples에 있다.
- 기존 테스트를 깨뜨리지 마라.
