# Step 0: registry-feature-species

## 읽어야 할 파일

- `/CLAUDE.md` (TDD·매직넘버 금지·레이어 분리·렌더링 함정·자기보고 불신)
- `/docs/superpowers/specs/2026-05-27-fish-species-addition-design.md` (설계 — 특히 "단일 진실 원천 loadedSpecies", "하이브리드 스폰")
- `src/renderer/entities/speciesRegistry.ts` (어종 메타 단일 레지스트리 — 이 step의 주 수정 대상)
- `src/renderer/entities/fishAssets.ts` (`loadFishPrototypes`가 `FISH_SPECIES` 전체를 로드, `pickSpecies`/`SpeciesId` re-export)
- `src/renderer/entities/Fish.ts` (`pickSpecies(seed, kind)` 사용처)
- `src/renderer/assets/fish/CREDITS.md` (출처 기록 — 갱신 대상. 현재 "리그 미사용" 문구는 stale)
- `src/renderer/entities/__tests__/speciesRegistry.test.ts` (기존 테스트 — 깨뜨리지 말 것)

## 배경

신규 GLB 4종은 이미 `src/renderer/assets/fish/`에 있다(다운로드 완료, 모두 Quaternius CC0,
스켈레탈 `Armature|Swim` 클립 보유): `manta.glb`, `whale.glb`, `dolphin.glb`, `shark.glb`.

이 step은 **레지스트리에 4종을 등록하되, 앰비언트 풀에는 섞이지 않게** 한다(특별 개체는 step 1에서
별도 스폰). `loadFishPrototypes`는 카테고리와 무관하게 `FISH_SPECIES` 전체를 로드하므로, 등록만으로도
새 GLB가 런타임에 로드된다 → 로드 실패는 smoke가 잡는다(`ERROR_PATTERNS`의 `/로드 실패/`).

## 작업

1. **`speciesRegistry.ts` — `category` 필드 추가**
   - `FishSpecies` 인터페이스에 `category: 'ambient' | 'feature'` 추가.
   - 기존 5종(tetra-a, tetra-b, clownfish, butterflyfish, lionfish) 모두 `category: 'ambient'`.

2. **신규 4종 등록**
   - 파일 상단 GLB import 섹션에 추가:
     ```ts
     import mantaUrl from '../assets/fish/manta.glb?url'
     import whaleUrl from '../assets/fish/whale.glb?url'
     import dolphinUrl from '../assets/fish/dolphin.glb?url'
     import sharkUrl from '../assets/fish/shark.glb?url'
     ```
   - `SpeciesId` 유니온에 `'manta' | 'whale' | 'dolphin' | 'shark'` 추가.
   - `SPECIES_REGISTRY`에 4개 항목 추가. 모두 `kind: 'individual'`, `category: 'feature'`.
     - `displayName`(한국어): 만타가오리, 고래, 돌고래, 상어.
     - `baseScale`(대형이므로 보수적; 수조 경계 `FISH.bounds`는 minY -1.2~maxY 1.8 ≈ 높이 3):
       manta 1.4, whale 1.8, dolphin 1.1, shark 1.3. (정확한 체감 크기는 step 3 dev에서 튜닝 — 여기선 합리적 초기값)
     - `swimSpeed`(느리고 우아하게): manta 0.45, whale 0.35, dolphin 0.7, shark 0.6.
     - `dialogue`: 어종당 **정확히 10개**. 기존 어종과 같은 **힐링·사색 톤의 한국어 경어/담백체**.
       각 종 특성을 반영: 만타=고요·날갯짓 같은 유영, 고래=깊고 큰 평온·먼 여정, 돌고래=유희·교감,
       상어=절제된 강함·고독한 항해(위협적이지 않게, 힐링 톤 유지).

3. **`pickSpecies` — ambient 한정**
   - `pickSpecies(seed, kind)`의 후보를 `SPECIES_REGISTRY.filter((s) => s.kind === kind && s.category === 'ambient')`로 변경.
   - 선택 알고리즘(시드 해시) 자체는 유지 → 기존 앰비언트 분포가 바뀌지 않도록(회귀 방지). `getSpecies`는 전체에서 조회(변경 없음).

4. **`CREDITS.md` 갱신**
   - 표에 4행 추가(파일/모델/용도=개체(특별)/출처 URL/라이선스):
     - `manta.glb` 만타가오리 https://poly.pizza/m/yzD8b7ZHZm CC0 1.0
     - `whale.glb` 고래 https://poly.pizza/m/JGFwp6xWgk CC0 1.0
     - `dolphin.glb` 돌고래 https://poly.pizza/m/3LzFgI3GLO CC0 1.0
     - `shark.glb` 상어 https://poly.pizza/m/AyHTK3zUSG CC0 1.0
   - **stale 문구 수정**: "모델에 헤엄 리그가 포함돼 있으나, 본 프로젝트는 리그를 사용하지 않고 정적 메시 + 셰이더 바디 벤딩으로 애니메이션한다." → "각 모델의 스켈레탈 swim 클립을 `AnimationMixer`로 재생한다(절차적 벤딩 아님)."

5. **TDD 테스트**(`__tests__/speciesRegistry.test.ts`에 추가):
   - 신규 4종이 레지스트리에 존재하고 각각 `displayName` 비어있지 않음 + `dialogue.length === 10`.
   - 모든 항목에 `category`가 'ambient'|'feature' 중 하나.
   - **`pickSpecies`가 feature 종을 절대 반환하지 않음**: seed 0~999 스윕 + kind 'individual'/'schooling' 모두에서 결과가 항상 `category==='ambient'`인지 단언.
   - 기존 `pickSpecies` 결정성 회귀 테스트 유지(같은 시드→같은 ambient 종).

## Acceptance Criteria

```bash
npm run test
npm run build
npm run lint
```

## 검증 절차

1. AC 3개 종료코드 0. 신규/기존 테스트 모두 통과.
2. 체크리스트:
   - 4종이 `category:'feature'`, `kind:'individual'`로 등록됐는가?
   - `pickSpecies`가 ambient만 반환(테스트로 가드)?
   - CREDITS 4행 추가 + stale 문구 수정?
   - 매직넘버는 합리적 초기값으로 레지스트리 항목에 직접 기입(OK — 종별 메타는 레지스트리가 출처).
3. **eval(harness smoke)**: 빌드+headless 런타임. `loadFishPrototypes`가 9개 GLB를 로드 →
   새 4개 중 로드/파싱 실패가 있으면 콘솔 "로드 실패" 또는 스모크 fatal로 **실패**해야 정상 동작.
   앰비언트 물고기 렌더는 이전과 동일(features는 아직 스폰 안 됨).
4. `phases/5-fish-species/index.json`의 step 0을 `completed` + `summary`로 갱신(실패 시 규칙 동일).

## 금지사항

- 앰비언트 5종의 메타(scale/speed/dialogue/kind)를 바꾸지 마라. 이유: 시각/분포 회귀 방지.
- `pickSpecies`의 시드 해시 알고리즘을 바꾸지 마라(후보 필터만 변경). 이유: 결정적 분포 회귀.
- feature 종을 `pickSpecies` 후보에 남기지 마라. 이유: 특별 개체가 앰비언트 풀에 랜덤 등장하면 하이브리드 설계 위반.
- 스폰/풀/UI 코드를 이 step에서 건드리지 마라(각각 step 1/3 scope).
