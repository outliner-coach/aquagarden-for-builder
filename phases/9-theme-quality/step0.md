# Step 0: terrain — 테마별 지형 차별화

## 읽어야 할 파일

- `/CLAUDE.md` — 특히 "렌더링 컨벤션·함정"(모래 평면 가장자리 하드컷 → 수평선 아티팩트 사고)
- `docs/media/reference/README.md` + `ref-kelp-forest.jpg` + `ref-coral-reef.jpg` (Read 도구로 직접 볼 것 — 이 step의 품질 기준)
- `src/renderer/entities/Aquascape.ts` (`_buildSand` — PlaneGeometry(200,14,80,20), 버텍스 컬러, 노멀맵, 가장자리 페이드)
- `src/renderer/entities/rockHelpers.ts` (위치 해시 변위 패턴 재사용)
- `src/renderer/entities/themeRegistry.ts`·`src/shared/config.ts`(THEME) — 테마별 옵셔널 필드 확장 패턴
- `src/shared/config.ts`의 `FISH.bounds`(minY −1.2)·`AQUASCAPE.sandY`(−1.8)·`SHRIMP`(크롤러)

## 배경 (사용자 피드백)

사용자 평가: "산호초랑 다시마숲은 더 밀도있어야 하고 **지형이 달라야 합니다**." 현재 두 테마는 평평한 모래에 색만 다르다. 레퍼런스 기준:
- **다시마 숲**: 다시마는 바위에 붙어 자란다 — 어둡고 **울퉁불퉁한 암반 바닥**(완만한 기복 + 바위 무더기).
- **산호초**: 모래에서 **솟아오른 리프 마운드(암초 덩어리)** 가 주인공 — 다음 step에서 산호가 그 표면을 뒤덮는다. 모래는 마운드 주변 채널.
- **미니멀**: 지형 무변화(평평, 하위호환 — AC로 가드).

## 작업

1. **heightfield 헬퍼 (순수 함수, TDD 선행)** — `terrainHelpers.ts` 신설:
   - `sandHeightAt(x, z, cfg): number` — ① 저주파 노이즈 기복(`rollAmplitude`·`rollScale`, 위치 기반 sine-hash — rockHelpers 패턴) ② feature 마운드 리스트(`mounds: {x, z, radius, height}[]`, smoothstep 감쇠 언덕) 합성.
   - **경계 제약(테스트로 가드)**: ⓐ `|x| > edgeTaperStart`에서 0으로 smoothstep 감쇠(가장자리 페이드/실루엣 보존 — 수평선 아티팩트 함정) ⓑ **앞쪽 평탄 존**: `z > frontFlatZ`(기본 −1.5)는 변위 0(새우 크롤러가 sandY 평면 기준으로 기어다님 — 클리핑 방지) ⓒ 마운드 최고점: `sandY + height ≤ FISH.bounds.minY`(−1.2) 즉 **height ≤ 0.6** (물고기가 지형을 뚫고 지나가는 것 방지) ⓓ 결정적(같은 입력 → 같은 출력, Math.random 금지).
2. **`_buildSand` 확장** — 테마 config의 `terrain?` 필드를 받아 PlaneGeometry 버텍스 Y 변위 + `computeVertexNormals()`. 세그먼트 해상도가 부족하면 `80x20 → 120x32`까지 상향 허용(마운드 실루엣이 각지지 않게). 기존 버텍스 컬러·노멀맵·가장자리 페이드는 유지하되, 마운드 위 버텍스 컬러를 살짝 밝게/바위색으로 변조해 지형이 읽히게.
3. **THEME 구성**:
   - `kelp-forest.terrain`: 기복 amp ~0.3, 바위색 어둡게. + hardscape 큰 바위 5→8~10개(크기 분산 확대, 뒤쪽·군락 예정지 주변 배치).
   - `coral-reef.terrain`: 리프 마운드 2개(예: 좌중 {x≈−6, z≈−3, r≈4.5, h≈0.55}, 우중 {x≈+7, z≈−3.2, r≈3.5, h≈0.45} — 중앙 x∈[−2,+2]는 비워 물고기 스테이지 유지) + 완만 기복 amp ~0.12. 암반 슬랩은 마운드 위/주변으로 재배치.
   - `minimal.terrain`: 없음(undefined → 변위 경로 자체를 타지 않음).
4. 모든 수치는 config 상수로. themeRegistry에 `BackgroundThemeTerrain` 옵셔널 필드(기존 Kelp/Coral 필드와 동일 패턴).

## Acceptance Criteria

```bash
npm run test
npm run lint
npm run build
npm run smoke
AQUA_SMOKE_THEME=kelp-forest AQUA_SMOKE_SHOT=eval-theme-kelp.png AQUA_SMOKE_REPORT=eval-theme-kelp.json npm run smoke
AQUA_SMOKE_THEME=coral-reef AQUA_SMOKE_SHOT=eval-theme-coral.png AQUA_SMOKE_REPORT=eval-theme-coral.json npm run smoke
AQUA_SMOKE_THEME=coral-reef AQUA_SMOKE_BRIGHTNESS=1 AQUA_SMOKE_SHOT=eval-theme-coral-bright.png AQUA_SMOKE_REPORT=eval-theme-coral-bright.json npm run smoke
```

## 검증 절차

1. AC 전부 종료코드 0 (`npm run smoke` 단독 = 미니멀 지형 무변화 무회귀).
2. 캡처를 Read로 직접 보며: 산호초 마운드가 **뚜렷한 언덕 실루엣**으로 읽히는가(각진 저해상 아님), 다시마 숲 바닥이 **암반 기복**으로 읽히는가, 가장자리에 수평선/사각형 아티팩트가 없는가(고밝기 캡처 포함).
3. 마운드가 중앙 스테이지·크롤러 존을 침범하지 않는가(테스트+캡처).
4. index.json step 0 갱신(completed+summary / error / blocked) 후 커밋: `feat(9-theme-quality): step 0 — terrain`.

## 금지사항

- 미니멀 테마의 지형·모래를 바꾸지 마라. 이유: 하위호환.
- 모래 평면의 가장자리 알파 페이드 로직을 제거·약화하지 마라. 이유: 하드컷 수평선 아티팩트 사고 재발.
- 다시마/산호 밀도는 이 step에서 건드리지 마라(step 1·2 scope).
- `Math.random` 금지, 기존 테스트(572+) 파괴 금지.
