# Step 5: theme-ui

## 읽어야 할 파일

- `/CLAUDE.md` (사용자 평가 피드백 반영 섹션 — 패널 UX 원칙: 고정 높이 힌트 슬롯, 투과 중 패널 클릭 처리)
- `/docs/superpowers/specs/2026-07-17-background-themes-design.md` §2 (UI)
- `src/renderer/ui/ControlPanel.ts` (주 수정 대상 — `_createToggle` 등 컨트롤 생성 헬퍼, 2열 레이아웃, 도움말 모달, CSS 컨벤션·`COLORS` 상수)
- `src/renderer/ui/` 의 스타일시트(패널 CSS 이관분 — 신규 스타일은 여기에)
- `src/renderer/main.ts` (패널 콜백 배선 — `onEnabledFeaturesChange` 등 기존 패턴)
- `src/renderer/persistence.ts` (`savePersisted` 흐름)
- `src/renderer/entities/themeRegistry.ts` (`THEME_REGISTRY` — 버튼 소스)
- `phases/5-fish-species/step3.md` (유사 선례 — 패널에 컨트롤 추가한 step)
- `phases/8-background-themes/index.json`의 step 0~4 `summary`

## 배경

테마의 사용자 접점. 패널에 '배경 테마' 세그먼트(3버튼)를 추가하고 선택을 영속화한다. 패널은 스모크 픽셀검사 밖(collapsed 기본)이므로 `AQUA_SMOKE_OPEN_PANEL` 캡처 + 유닛 테스트로 검증한다.

## 작업

1. **`ControlPanel` — '배경 테마' 세그먼트**
   - 버튼 3개를 **`THEME_REGISTRY`에서 생성**(id·displayName 하드코딩 금지 — 테마 추가 시 자동 반영).
   - 선택 상태: `aria-pressed`(또는 radiogroup 패턴), 선택 버튼 시각 강조는 `COLORS` 상수로. 키보드 접근: 포커스 가능 + `:focus-visible` 링(기존 토글 a11y 수준 준수).
   - `onThemeChange(id: string)` 콜백 노출 + `setTheme(id)`(외부에서 초기 선택 상태 주입용).
   - 스타일은 기존 컨벤션에 따라 스타일시트에 추가(인라인 CSS 신규 추가 금지).
2. **`main.ts` 배선**
   - 콜백 → `aquascape.setTheme(getTheme(id))` + `savePersisted`(themeId 갱신).
   - 시작 시 복원된 themeId를 패널 초기 선택 상태에 반영.
3. **도움말 모달** — '배경 테마' 항목 1줄 추가(기존 항목 톤·우측 정렬 규칙 유지).
4. **테스트** — 기존 ControlPanel 테스트 패턴이 있으면 그에 따라: 세그먼트가 THEME_REGISTRY 개수만큼 렌더 / 클릭 시 콜백 id 전달 / `setTheme`이 선택 상태 갱신 / aria 속성 존재. DOM 테스트가 어려운 부분은 순수 로직(선택 상태 계산)을 분리해 테스트.

## Acceptance Criteria

```bash
npm run test
npm run lint
npm run build
npm run smoke
AQUA_SMOKE_OPEN_PANEL=1 AQUA_SMOKE_SHOT=eval-panel-theme.png AQUA_SMOKE_REPORT=eval-panel-theme.json npm run smoke
```

## 검증 절차

1. AC 전부 종료코드 0.
2. 체크리스트:
   - 버튼이 THEME_REGISTRY 기반인가(하드코딩 아님)?
   - 테마 변경이 저장되고 재시작 시 복원되는가(persistence 경로 연결)?
   - 패널 높이 변화로 다른 컨트롤이 밀리지 않는가(힌트 슬롯 고정 높이 원칙과 충돌 없음)?
   - `eval-panel-theme.png` 캡처에 세그먼트 3버튼이 보이는가?
3. **eval(harness smoke + step 비전)**: 열린 패널 캡처에서 테마 세그먼트가 표시되고 무깨짐.
4. index.json step 5 상태 갱신(규칙 동일).

## 금지사항

- 패널 레이아웃(2열·힌트 슬롯·드래그 동작)을 재설계하지 마라. 이유: scope — 섹션 추가만. v0.8.0에서 잡은 오클릭 UX를 되돌릴 위험.
- `computeMouseIgnore` 등 투과/클릭 스루 로직을 바꾸지 마라. 이유: P0 UX 회귀 위험(투과 중 패널 첫 클릭 사고 이력).
- 테마 전환 시 물고기 상태(개체수·특별 개체)를 초기화하지 마라. 이유: 배경만 교체 — 물고기는 무관.
- 기존 테스트를 깨뜨리지 마라.
