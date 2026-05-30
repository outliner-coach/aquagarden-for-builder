# 새우(아마노 새우) 개체 추가 리포트

새 생물종 **새우(Amano shrimp)**를 기존 어종 패턴을 그대로 따라 Aquagarden 오버레이에 통합했다.
브랜치: `feat-5-shrimp` (main에서 분기).

## 변경 파일

| 파일 | 변경 내용 |
|------|-----------|
| `src/renderer/assets/fish/shrimp.glb` | 신규 추가. Blender 절차적 생성 GLB (15328 verts, 7 bones, "Swim" 클립). `/tmp/shrimp_amano/shrimp_amano.glb`에서 복사. |
| `src/renderer/assets/fish/CREDITS.md` | `shrimp.glb` 항목 추가 — 본 프로젝트 자체 제작(원본 창작물), CC0 1.0. |
| `src/renderer/entities/speciesRegistry.ts` | `import shrimpUrl`, `SpeciesId` 유니온에 `'shrimp'` 추가, 레지스트리 항목 1개 추가. |
| `src/renderer/entities/__tests__/fishAssets.test.ts` | 종 수 9→10, individual 7→8 어서션 갱신. |
| `src/renderer/entities/__tests__/speciesRegistry.test.ts` | 종 수 9→10, ambient 6 / feature 4 카운트 테스트 추가, 새우 전용 describe 블록 추가. |
| `docs/SHRIMP_REPORT.md` | 본 리포트. |

## 레지스트리 항목

```ts
{
  id: 'shrimp',
  file: shrimpUrl,          // import shrimpUrl from '../assets/fish/shrimp.glb?url'
  kind: 'individual',       // 확실히 스폰·동작하도록 individual
  category: 'ambient',      // 앰비언트 풀(개체수 슬라이더)에 등장 → 기본 스폰
  baseScale: 1.5,
  swimSpeed: 0.5,
  displayName: '새우',
  dialogue: [ /* 차분·귀여운 톤의 한국어 10줄, 중복 없음 */ ],
}
```

- `baseScale 1.5`: 최종 스케일 = `baseScale * normScale * variation`. GLB bbox 최장축 dx≈4.72 → `normScale ≈ 1/4.72 ≈ 0.212`. 따라서 최종 ≈ `1.5 * 0.212 * (0.85~1.15) ≈ 0.27~0.37`로, 어종보다 확연히 작은 청소부 새우 크기로 보인다.
- `swimSpeed 0.5`: 느긋하게 거니는 작은 생물 톤.
- `dialogue`: 10줄, 모두 고유(테스트로 가드). 청소·바닥·더듬이 등 새우 특성 + 기존 종과 같은 차분/힐링 톤.

## 설정(config)

- `src/shared/config.ts`에 **새 상수를 추가하지 않았다.** 새우는 기존 `FISH.bounds` 안에서 다른 어종과 동일하게 유영한다.
- 선택 사항이던 "바닥 바이어스(bottom-bias)"는 매직넘버 없이 깔끔하게 넣을 수 없고 다른 어종 동작을 건드릴 위험이 있어 적용하지 않았다(스코프 밖, 깔끔함 우선).

## 방향(Orientation) 처리

- 새우 GLB는 계약대로 **머리 = -X**로 작성됨 → 기존 어종과 동일 규약.
- `Fish.ts`는 모든 모델에 공유 `_align.rotation.y = Math.PI/2`를 적용해 머리(-X)를 진행 방향(+X)에 맞춘다. 새우도 동일 경로를 타므로 별도 보정 불필요.
- 머리-선행 불변식은 `fishHelpers.headingYaw` / `forwardDirAfterYaw` 결정적 유닛테스트(27개 통과)로 가드됨.
- 스모크 결과 측면/역방향 유영 징후 없음 → **per-species `modelYaw` 오버라이드는 추가하지 않았다**(불필요한 변경 회피). 만약 추후 측면 유영이 관측되면, `FishSpecies`에 `modelYaw?: number`를 추가하고 `Fish.ts`의 `_align.rotation.y` 지점에서 존중하되 유닛테스트로 가드하는 방식(인라인 매직넘버 금지)으로 처리한다.

## 검증 결과 (실제 명령 출력)

- `npm run build` → `EXIT=0`. `tsc --noEmit` 통과, `shrimp-ryL042a0.glb 989.97 kB`로 번들됨.
- `npm run test` → `Test Files 30 passed (30) / Tests 431 passed (431)`, `EXIT=0`.
- `npm run lint` → `EXIT=0` (경고/에러 없음).
- `npm run smoke` → `[smoke] pass=true failures=0 → eval-report.json`, `EXIT=0`. "로드 실패" 없음 (health.errors=[]).

`eval-report.json` 상세 (실제 출력):

```json
{
  "pass": true,
  "failures": [],
  "health": { "ready": true, "fishActive": 31, "errors": [], "frames": 144 },
  "pixel": {
    "sampled": 3084,
    "opaqueRatio": 0.2432,
    "transparentRatio": 0.7568,
    "uniqueBuckets": 46,
    "lumVariance": 670.9,
    "blank": false
  },
  "screenshot": "eval-screenshot.png",
  "errorConsole": [
    "THREE.sigmaRadians, 0.5, is too large and will clip ... (level 2 warning, 기존 IBL 블러 경고 — 새우 무관)",
    "Electron Security Warning (Insecure CSP) (level 2 warning, 개발 빌드 표준 경고)"
  ]
}
```

- `health.errors: []` — GLB 로드 실패(`[fishAssets] shrimp 로드 실패`) 없음. `errorConsole`의 항목은 모두 **level 2(경고)** 이며 셰이더/렌더 깨짐이 아니라 기존부터 있던 IBL 블러 경고와 개발 빌드 CSP 경고(새우 추가와 무관). 스모크 게이트는 이를 실패로 보지 않아 `pass=true, failures=[]`.
- frames 144 (≥5), fishActive 31 (≥1), blank=false, transparentRatio 0.7568 (≥0.01). 모든 게이트 통과.
- 새우는 ambient/individual 이므로 기본 풀에 등장 가능(`pickSpecies('individual')`가 `shrimp`를 반환할 수 있음을 유닛테스트로 검증).

## 참고 이미지

생성 단계 프리뷰: `/tmp/shrimp_amano/preview.png`
