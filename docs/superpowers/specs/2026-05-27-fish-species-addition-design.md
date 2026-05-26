# 설계: 어종 4종 추가 + 하이브리드 종 선택 (2026-05-27)

## 목표

빌트인 어종 로스터를 확장하고, 사용자가 **어떤 종을 수조에 넣을지 선택**할 수 있게 한다.
대형 개체(고래·만타 등)는 기본 OFF이며 사용자가 켜서 추가한다.

추가 어종(모두 Quaternius "Animated Fish Bundle", CC0 1.0, GLB, 스켈레탈 swim 클립 보유 — 다운로드 완료):
- 만타가오리(`manta.glb`), 고래(`whale.glb`), 돌고래(`dolphin.glb`), 상어(`shark.glb`).

## 핵심 개념: 하이브리드 스폰

수조 개체는 두 그룹으로 나뉜다.

| 그룹 | 구성 | 스폰 방식 | UI |
|------|------|-----------|-----|
| **앰비언트** | 기존 5종(`ambient`) | 개체수 슬라이더 + 랜덤 kind/종 배정 (**현행 유지**) | 개체수 슬라이더 |
| **특별 개체** | 신규 4종(`feature`, 모두 대형 individual) | 개체수와 독립. 토글 ON = 1마리 등장, OFF = 퇴장 | 종별 ON/OFF 토글 |

- 앰비언트 동작은 **무변경**(회귀 0이 목표). 특별 개체는 별도 경로로 관리.
- 특별 개체는 `individual`이라 boids 미적용(고래가 무리짓지 않음). feed/scare/클릭 대사는 자동 적용.

## 단일 진실 원천: `loadedSpecies`

런타임 에셋 로딩은 실패 가능한 경계다. **실제로 로드된 프로토타입 집합(`loadedSpecies`)**을
유일한 진실 원천으로 삼아 UI 토글·영속 복원·스폰 reconcile을 모두 여기에 맞춘다.
이로써 "GLB 로드 실패 → 켜진 토글만 있고 보이지 않는 유령 물고기" 클래스를 원천 차단한다.

`loadFishPrototypes`는 이미 종별 실패를 catch하고 맵에서 스킵하므로, `FishSchool`이
`loadedSpecies: Set<SpeciesId>`(또는 `feature` 한정 `availableFeatures`)를 노출하면 된다.

## 컴포넌트별 변경

### A. `speciesRegistry.ts`
- `FishSpecies`에 `category: 'ambient' | 'feature'` 추가. 기존 5종=`ambient`, 신규 4종=`feature`.
- 신규 4종 항목 추가: `kind:'individual'`, 보수적 `baseScale`/느린 `swimSpeed`,
  한국어 `displayName`(만타가오리·고래·돌고래·상어), `dialogue` 10개씩.
- `pickSpecies(seed, kind)`는 **`category === 'ambient'`만** 후보로 필터.
  → 특별 개체가 앰비언트 풀에 랜덤 섞이지 않음. (결정적 유닛테스트로 "feature 종을 절대 반환 안 함" 가드)
- GLB URL import 섹션에 4개 추가(파일 상단 주석 절차 그대로).

### B. `FishSchool.ts` — 특별 개체 스폰
- `availableFeatures(): Set<SpeciesId>` 노출 — 로드된 프로토타입 중 `feature` 종.
- `setEnabledFeatures(ids: SpeciesId[]): void` — **의도만 저장**. 실제 reconcile은 `update()`에서
  `_ready`일 때 수행(`setCount` 패턴과 동일 — `init()` 비동기 로드 완료 전 호출돼도 throw 없이 지연 적용).
- 순수 함수 `reconcileFeatures(target: Set, active: Set): { acquire: SpeciesId[]; release: SpeciesId[] }`
  (TDD). `target`은 **`enabledFeatures ∩ availableFeatures`**(유령 차단). 멱등 → 빠른 토글에도 수렴.
- 특별 개체 인스턴스는 앰비언트 풀 카운트와 **구분 관리**(별도 `Map<SpeciesId, Fish>` 참조).
  앰비언트 despawn(`setActiveCount`)이 특별 개체를 건드리지 않게 한다.
- **화면 안 즉시 등장**: 특별 개체 acquire 시 초기 위치를 **가시 영역 안**에 배치(앰비언트의
  가장자리 wander 시작과 달리). 토글 ON 직후 바로 보이도록 → "내 고래 어디 갔지?" 공백 제거.
  (가시 영역 계산은 순수 헬퍼로 분리해 테스트 가능하게.)

### C. `ControlPanel.ts` — UI
- **"어종" 섹션** 신설(가벼운 섹션 라벨, `COLORS.textSecondary` 톤 — UI_GUIDE 유지). 구성:
  - 개체수 슬라이더를 이 섹션으로 이동 + **라벨 명확화**: `개체수` → `개체수 (작은 물고기)`.
  - **"특별 개체" 접이식 그룹**(`▸/▾` 헤더 클릭으로 펼침/접힘, 기본 접힘). 안에 종별 토글.
    토글은 **`availableFeatures` 기준으로만 렌더**(로드 실패 종은 표시 안 함 + console warn).
- 토글은 기존 `_createToggle` 재사용(시각 일관성). `displayName`을 라벨로.
- `setEnabledFeatures` 변경을 외부 콜백(`onEnabledFeaturesChange`)으로 전달.
- **`setInteractive` 비활성 대상에서 제외**: 종 선택·개체수는 "설정"이지 화면 클릭 인터랙션이
  아니므로, 투과/숨김 ON 중에도 조작 가능해야 한다. (먹이·놀래키기·확대만 비활성 유지)
- **패널 잘림 재발 방지(P0)**: 접이식이라 기본 높이 증가는 작지만, 펼친 상태에서 종료 버튼이
  스크롤 밖으로 밀리지 않도록 `WINDOW.expandedHeight` 재산정 + dev 확인.
- **이용 가이드 모달** 항목 갱신: "개체수(작은 물고기)", "특별 개체"(토글로 대형 개체 추가) 설명.

### D. `types.ts` / `persistence.ts` — 영속화
- `AppSettings.enabledFeatures: SpeciesId[]` 추가(기본 `[]`).
- `loadPersisted` 하위호환: 없거나 배열이 아니면 `[]`. (기존 하드 가드에 넣지 않고 zoom처럼 보정.)
- 복원된 `enabledFeatures`는 적용 시 **`availableFeatures`와 교집합** → 삭제/로드실패 종 id 드롭.
- 변경 시 디바운스 저장(기존 패턴).

### E. 에셋 · 크레딧
- `manta/whale/dolphin/shark.glb` → `src/renderer/assets/fish/`(완료).
- `CREDITS.md`: 4종 추가 + **stale 문구 수정**("리그 미사용·셰이더 벤딩" → "스켈레탈 애니메이션
  (AnimationMixer로 GLB 본 클립 재생) 사용"). 각 모델 poly.pizza URL 기록
  (Dolphin `/m/3LzFgI3GLO`, Shark `/m/AyHTK3zUSG`, Whale `/m/JGFwp6xWgk`, Manta `/m/yzD8b7ZHZm`).

## 에러 핸들링 (실제 실패 모드만)

| 시나리오 | 처리 |
|----------|------|
| 특별 종 GLB 로드 실패 | `loadFishPrototypes`가 catch+스킵(기존). 해당 토글은 `availableFeatures`에서 빠져 **표시 안 됨**. console warn. |
| 영속값이 사용 불가 종 가리킴 | 복원 시 `∩ availableFeatures`로 드롭. reconcile 대상도 동일 교집합 → 유령 차단. |
| `_ready` 이전 `setEnabledFeatures` 호출 | 의도만 저장, `update()`에서 `_ready`일 때 reconcile(지연 적용, throw 없음). |
| 빠른 토글 연타 | `reconcileFeatures` 멱등(차집합) → 자연 수렴. |

**의도적으로 만들지 않는 것**(프로젝트 lean 원칙): GLB 로드 재시도/폴백 모델, 풀 acquire 실패
처리(on-demand 성장이라 발생 안 함), 에러 토스트/사용자 알림(콘솔 warn + smoke 콘솔 에러 게이트로 충분).

## 테스트 / 검증

**순수 로직 유닛테스트(TDD 선작성)**
- `reconcileFeatures`: acquire/release 차집합, 멱등, 빈 집합.
- `pickSpecies`: ambient-only — feature 종을 절대 반환하지 않음(결정적 시드 스윕).
- `loadPersisted`: `enabledFeatures` 하위호환(없음/비배열/미지 id) → 보정.
- 특별 개체 가시 영역 초기 위치 헬퍼.

**렌더·실기기 검증(자기보고 불신 규칙)**
- `npm run test && npm run lint && npm run build && npm run smoke`(콘솔 에러·헬스·픽셀).
- `npm run dev`: 4종 토글 ON→화면 안 즉시 등장 / OFF→퇴장 / 재시작 후 토글 복원 /
  투과·숨김 중 종 토글 조작 가능 / 펼친 패널에서 종료 버튼 잘림 없음.
- **머리 +X 자세**: 신규 모델 머리축이 기존(-X)과 다르면 누운/뒤집힌 자세 → 종별 dev 확인 후
  필요 시 `_align` 보정. `fishHelpers.headingYaw` 유닛테스트는 유지(정적 비전 eval은 모션 방향 못 봄).
- **대형 `baseScale`**: 수조 경계 대비 dev에서 튜닝.

## 리스크

- 신규 모델 머리축/자세 불일치 → dev 시각 확인 필요(스모크는 모션 방향 못 잡음).
- 대형 개체 + 최대 개체수 동시 → 시각 혼잡/성능. 개체수 max는 기존 상한이라 경미.
- 패널 잘림 재발(과거 버그) → `expandedHeight` 재산정 + dev 확인으로 가드.

## 범위 밖 (후속)

- 종별 **썸네일 아이콘**(렌더-투-텍스처/이미지 에셋 비용) — 텍스트 표시명으로 v1 충분.
- Cute Fish 팩 GLB 변환으로 군집 소형종 다양화(별도 작업).
- 사용자 런타임 GLB 임포트(보안·검증 — YAGNI).
