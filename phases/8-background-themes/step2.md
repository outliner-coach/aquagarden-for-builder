# Step 2: kelp

## 읽어야 할 파일

- `/CLAUDE.md` — **특히 "렌더링 컨벤션·함정"** (additive는 알파도 누적, `opaque_fragment`, varying 선언 누락, 반투명 평면=사각형 아티팩트)
- `/docs/superpowers/specs/2026-07-17-background-themes-design.md` §3.1 (다시마 설계)
- `src/renderer/entities/Aquascape.ts` (그래스 카드 시스템 전체 — `GRASS_CARD_VERT/FRAG` 셰이더, 인스턴스드 속성 구성, `_grassMaterials` 업데이트 루프, `createLeafAlphaTexture`)
- `src/renderer/entities/aquascapeHelpers.ts` (`generatePlantInstances` — 시드 결정적 rng 패턴 재사용)
- `src/shared/config.ts` (`PLANT` 셰이더 파라미터, `THEME`, `AQUASCAPE.sandY`, `FISH.bounds`)
- `src/renderer/entities/themeRegistry.ts` (step 0 산출)
- `phases/8-background-themes/index.json`의 step 0·1 `summary`

## 배경

다시마 = 그래스 카드의 "키 큰 형제". **흔들림이 생명**이므로 GLB가 아니라 버텍스 셰이더 벤딩으로 만든다. 좌표 참고: 모래 `sandY=-1.8`, 물고기 유영 상한 `maxY=1.8` → 높이 2.2~3.0이면 팁이 y≈0.4~1.2에 닿아 수조 상부까지 뻗는 수직감이 나온다.

배치 원칙(spec §1): **좌우 가장자리·뒤쪽 z에 집중, 중앙 밀도 낮게** — "시선은 물고기에 집중" 원칙 유지. 이 step 완료 시 다시마 숲 테마가 시각적으로 성립해야 하며, AC에 테마 전용 비전 채점(≥62)이 포함된다.

## 작업

1. **`src/renderer/entities/kelpHelpers.ts` 신설 (순수 함수, TDD 선행)**
   - `generateKelpInstances(seed: number, count: number, area: {minX,maxX,minZ,maxZ}, params: KelpParams): KelpInstance[]`
     - `aquascapeHelpers`의 시드 결정적 rng 재사용. `KelpInstance = { x, z, yaw, height, scale, phase, baseColor, tipColor }`.
     - **x는 가장자리 가중**(중앙 `|x| < centerGap` 영역의 배치 확률을 폴오프), z는 뒤쪽 가중. `centerGap` 등 파라미터는 `KelpParams`로.
   - `kelpTaperHalfWidth(h01: number, baseHalfWidth: number, tipRatio: number): number` — 뿌리→팁 단조 감소 폭.
   - 테스트: 같은 시드 → 완전 동일 출력 / 중앙 영역 인스턴스 밀도 < 가장자리 밀도(통계 assert) / taper 단조 감소 / 모든 인스턴스가 area 내 / height가 [minHeight,maxHeight] 내.

2. **리본 지오메트리** — 세로 세그먼트 6~10개의 연속 스트립(각 링 2버텍스), `uv.y = h01`(0=뿌리, 1=팁), 폭은 `kelpTaperHalfWidth` 적용. 한 장 + `DoubleSide`로 시작(교차 2장은 미학 판단 후 재량).

3. **셰이더 `KELP_VERT` / `KELP_FRAG`** — 그래스 셰이더를 확장:
   - VERT: 누적 벤딩 — 저주파·대진폭 주 흔들림(`sin(uTime·speed + worldX·k + phase) · pow(h01, 1.5) · amplitude`) + 2차 미세 웨이브. 뿌리 고정·팁 최대.
   - FRAG: 그래스와 동일 규약 — 캔버스 알파 텍스처 **discard**(alpha-test) + base→tip 그라디언트 + `uMoodColor` 곱 + `uSceneOpacity`.
   - 다시마 blade 알파 텍스처: `createLeafAlphaTexture`를 참고해 **길쭉하고 가장자리가 물결치는 잎** 캔버스 함수 신설.
   - CRITICAL: vertex에서 쓴 varying은 fragment에도 반드시 선언(누락 시 조용한 컴파일 실패 → 투명 패스 전체 붕괴 — 과거 사고).

4. **`Aquascape._buildKelp(cfg)`** — 인스턴스드 메시 구성(그래스와 동일한 속성 배열 방식). **머티리얼을 `_grassMaterials`에 push** → `uTime`/무드/투명도 갱신 루프에 자동 편승(별도 배선 금지).

5. **config** — `KELP` 상수(swaySpeed/amplitude/2차 파라미터/alphaTest 등)와 THEME `kelp-forest`에 kelp 구성 추가: 초기값 `count 18, minHeight 2.2, maxHeight 3.0`, 색 base 짙은 갈록 `[0.10,0.22,0.10]` → tip 올리브 `[0.35,0.42,0.16]`. **초기값은 출발점** — 아래 AC의 비전 채점을 보며 개수·높이·색을 조정하는 반복을 이 step 안에서 수행한다.

## Acceptance Criteria

```bash
npm run test
npm run lint
npm run build
npm run smoke
AQUA_SMOKE_THEME=kelp-forest AQUA_SMOKE_SHOT=eval-theme-kelp.png AQUA_SMOKE_REPORT=eval-theme-kelp.json npm run smoke
AQUA_SMOKE_THEME=kelp-forest AQUA_SMOKE_BRIGHTNESS=1 AQUA_SMOKE_SHOT=eval-theme-kelp-bright.png AQUA_SMOKE_REPORT=eval-theme-kelp-bright.json npm run smoke
python3 scripts/eval_vision.py eval-theme-kelp.png --min-score 62 --intent "다시마 숲 테마의 투명 오버레이 수족관: 세로로 긴 다시마 리본이 좌우 가장자리와 뒤쪽에 무리지어 서 있고, 중앙은 트여 물고기가 잘 보인다. 초록-갈색의 차분한 수중림 톤. 다시마가 화면을 과하게 가리지 않는다."
```

## 검증 절차

1. AC 전부 종료코드 0 (`npm run smoke` 단독 실행 = 미니멀 무회귀 확인).
2. 체크리스트:
   - 벤딩이 뿌리 고정·팁 최대인가(h01 가중)?
   - alpha-discard 방식인가(additive/반투명 블렌딩 아님)?
   - `_grassMaterials` 편승으로 무드·투명 슬라이더가 다시마에도 동작하는가?
   - 중앙 폴오프가 캡처에서 확인되는가(중앙에 물고기 시야 확보)?
   - 매직넘버가 config 밖에 없는가?
3. **셰이더 함정 격리**: 고밝기 캡처(`eval-theme-kelp-bright.png`)를 **밝은 합성 배경으로도** 떠서(`AQUA_SMOKE_BG` — 값 형식은 `smoke.ts`의 `parseBgBgr` 확인) 다시마 주변에 사각형/수평선 아티팩트가 없는지 확인한다. 기본 어두운 배경 스모크는 이 아티팩트를 못 잡는다(과거 라이트샤프트 사고).
4. **eval(harness smoke + step 비전)**: 다시마 숲 캡처가 위 intent 기준 62점 이상. 미달 시 개수/높이/색/배치를 조정해 재시도(이 반복이 이 step의 본질 작업이다).
5. index.json step 2 상태 갱신(규칙 동일).

## 금지사항

- additive 블렌딩·반투명 대형 평면을 쓰지 마라. 이유: 투명 오버레이에서 바탕화면 위 사각형/수평선로 비침(라이트샤프트를 제거하게 된 원인).
- `THREE.Fog`·풀스크린 포스트프로세싱을 쓰지 마라. 이유: 투명 캔버스 파괴(CLAUDE.md 함정).
- 미니멀·산호초 테마 구성을 바꾸지 마라. 이유: scope — 미니멀 무회귀는 AC로 가드된다.
- `Fish`/`FishSchool` 등 물고기 코드를 건드리지 마라. 이유: scope 밖, 유영 회귀 위험.
- `Math.random`을 쓰지 마라. 이유: 시드 결정적 재현성.
- 기존 테스트를 깨뜨리지 마라.
