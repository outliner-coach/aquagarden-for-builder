# 어종 4종 추가 + 하이브리드 종 선택 — 구현 계획

> **For agentic workers:** 이 계획은 하네스(`scripts/execute.py phases/5-fish-species`)로 실행한다.
> 각 step의 자기완결 지침은 `phases/5-fish-species/step{N}.md`에 있다(execute.py가 fresh
> `claude -p` 에이전트에 통째로 전달). 이 문서는 사람 검토용 개요다.

**Goal:** 빌트인 어종에 대형 4종(만타·고래·돌고래·상어)을 추가하고, 사용자가 토글로 켜서 추가하는 하이브리드 종 선택을 구현한다.

**Architecture:** 앰비언트 풀(기존 5종, 개체수 슬라이더 — 무변경) + 특별 개체(신규 4종, 토글 ON=1마리 화면 안 즉시 등장). 실제 로드된 종(`availableFeatures`)을 단일 진실 원천으로 삼아 UI·영속·스폰을 정합시켜 "유령 물고기"를 차단. 순수 로직은 TDD, 시각/스폰은 dev+smoke 검증.

**Tech Stack:** TypeScript(strict), Three.js(AnimationMixer 스켈레탈), Vite, Vitest, Electron. 에셋: Quaternius CC0 GLB(다운로드 완료).

**설계 출처:** `docs/superpowers/specs/2026-05-27-fish-species-addition-design.md`

---

## 파일 구조 (생성/수정)

| 파일 | 책임 | step |
|------|------|------|
| `src/renderer/entities/speciesRegistry.ts` | `category` 필드 + 신규 4종 + `pickSpecies` ambient-only | 0 |
| `src/renderer/assets/fish/CREDITS.md` | 4종 출처 추가 + stale 문구 수정 | 0 |
| `src/renderer/entities/featureHelpers.ts` (신규) | `reconcileFeatures`·`featureSpawnPosition` 순수 함수 | 1 |
| `src/renderer/entities/FishSchool.ts` | `availableFeatures`/`setEnabledFeatures`/reconcile·인뷰 스폰·분리 관리 | 1 |
| `src/shared/config.ts` | `FEATURE` 상수(스폰 가시영역 등) | 1 |
| `src/shared/types.ts` | `AppSettings.enabledFeatures` | 2 |
| `src/renderer/persistence.ts` | enabledFeatures 저장/복원 + 하위호환 | 2 |
| `src/renderer/main.ts` | 설정→FishSchool 배선, 복원 시 교집합, UI 콜백 | 2,3 |
| `src/renderer/ui/ControlPanel.ts` | "어종" 섹션·접이식 토글·라벨·setInteractive 제외·도움말 | 3 |
| `*/__tests__/*` | reconcile/pickSpecies/persistence 유닛테스트 | 0,1,2 |

## Task 0 — registry-feature-species (eval)
- `FishSpecies`에 `category: 'ambient' | 'feature'`. 기존 5종=`ambient`.
- 신규 4종(manta/whale/dolphin/shark): GLB `?url` import, `kind:'individual'`, `category:'feature'`, 보수적 baseScale·느린 swimSpeed, 한국어 displayName, dialogue 10개씩.
- `pickSpecies`는 `category==='ambient'`만 후보(결정적 시드 스윕 테스트로 feature 미반환 가드).
- CREDITS.md 갱신.
- **eval**: `loadFishPrototypes`가 전 종 로드 → 새 GLB 로드 실패는 smoke "로드 실패" 패턴으로 포착. 앰비언트 렌더 무변경.

## Task 1 — feature-spawn (eval)
- 순수 `featureHelpers.ts` + 테스트: `reconcileFeatures(target,active)→{acquire,release}`(차집합·멱등), `featureSpawnPosition(seed,bounds)`(가시 영역 내).
- FishSchool: `availableFeatures()`, `setEnabledFeatures(ids)`(의도 저장, `update()`에서 `_ready`일 때 reconcile), `_featureFish: Map<SpeciesId,Fish>` 분리 관리, 인뷰 스폰, 앰비언트 despawn에서 제외.
- `config.ts` `FEATURE` 상수.
- **eval**: 회귀 없음(앰비언트 렌더 유지, 기본 features off). 스폰 정확도는 순수 테스트 + step3 dev QA.

## Task 2 — persistence-and-wiring (no eval)
- `AppSettings.enabledFeatures: SpeciesId[]`(기본 `[]`).
- persistence 저장/복원 + 하위호환(없음/비배열→`[]`).
- main.ts: 복원 시 `enabledFeatures ∩ availableFeatures` 적용, 변경 시 persist.
- 테스트: loadPersisted 하위호환(없음/비배열/미지 id 교집합).
- 기본값 빈 배열 → 시각 무변경(no eval).

## Task 3 — control-panel-ui (eval)
- "어종" 섹션 + `개체수`→`개체수 (작은 물고기)` + "특별 개체" 접이식 그룹(기본 접힘).
- 토글은 `availableFeatures` 기준 렌더(로드 실패 종 미표시), `onEnabledFeaturesChange` 콜백.
- `setInteractive` 비활성 대상에서 종/개체수 **제외**(설정이지 화면 클릭 아님).
- 패널 잘림 재발 방지: 펼친 상태 종료 버튼 가시성 dev 확인(panel max-height/`WINDOW.panelExtra` 재점검).
- 도움말 모달 항목 갱신. main.ts: init 후 `controlPanel.setFeatureSpecies(availableFeatures)` 채움.
- **eval**: 패널 렌더·종료 버튼 잘림 없음·회귀 없음. dev QA: 토글→화면 안 등장 / 재시작 복원 / 투과·숨김 중 조작 가능.

## 실행
`python3 scripts/execute.py phases/5-fish-species`
- 0→1→2→3 순차. eval step은 smoke(+vision) 게이트. 실패 시 자가 교정/중단.
