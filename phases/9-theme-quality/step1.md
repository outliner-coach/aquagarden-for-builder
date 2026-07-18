# Step 1: kelp-density — 다시마 군락화·원근 레이어

## 읽어야 할 파일

- `/CLAUDE.md` (렌더링 함정)
- `docs/media/reference/README.md` + **`ref-kelp-forest.jpg`(Read로 반드시 볼 것 — 이 step의 목표 화면)**
- `src/renderer/entities/kelpHelpers.ts`·`Aquascape.ts`(`_buildKelp`, KELP 셰이더, `createKelpBladeAlphaTexture`)
- `src/shared/config.ts`(KELP·THEME kelp-forest), step 0 산출(terrain — 바위/기복 위치)

## 배경 (사용자 피드백 + 레퍼런스 관찰)

사용자 평가: 밀도가 낮다. 현재 26개 **낱장 리본이 띄엄띄엄** — 레퍼런스(몬터레이)는:
1. **군락(다발) 구조**: 한 홀드패스트(뿌리)에서 가닥 3~6개가 함께 솟는다 → "가닥"이 아니라 "포기"가 배치 단위.
2. **좌우가 꽉 참**: 프레임 좌우는 다시마 기둥이 상단까지 채우고, **중앙만 통로**처럼 트인다.
3. **원근 레이어**: 가까운 열은 선명·진하고, 먼 열(뒤 z)은 흐릿하고 밝은 청록으로 가라앉는다 — 깊이감의 핵심.
4. **톤**: 황금-올리브/앰버(현재 짙은 갈록보다 노란기가 돌게).
5. 잎이 줄기를 따라 달려 있다(맨 리본 아님).

## 작업

1. **군락 배치 (kelpHelpers 확장, TDD)** — `generateKelpClusters(seed, clusterCount, area, params)`: 홀드패스트 위치를 가장자리 가중으로 뽑고, 포기당 `bladesPerCluster: [3,6]` 가닥을 반경 ~0.25 내 분산 + 높이/위상 변주. 목표 규모: **클러스터 12~18개 = 총 가닥 60~90개**(인스턴싱이라 비용 저렴). 중앙 통로(centerGap) 유지. step 0의 바위 위치 근처에 홀드패스트가 오도록 시드 튜닝(바위에서 자라는 느낌).
2. **원근 레이어**: 인스턴스 z에 따라 ① 색을 `depthFadeColor`(밝은 청록빛)로 lerp ② 알파/밝기 감쇠 — KELP 셰이더에 인스턴스 attribute 또는 z 기반 varying으로 구현(기존 uniform 규약 유지, varying은 vert/frag 양쪽 선언). 뒤 열은 흐릿한 실루엣, 앞 열은 선명.
3. **잎 실루엣**: `createKelpBladeAlphaTexture`에 줄기 옆 leaflet(작은 잎) 돌기를 추가해 맨 리본 느낌 제거.
4. **톤**: base/tip 색을 황금-올리브 쪽으로(`[0.45,0.42,0.15]`대 톤 탐색 — 캡처 보며 확정). 카펫 수초는 유지하되 다시마 숲에서는 약간 감소 허용.
5. 모든 수치 config. 미학 반복(구현→캡처→레퍼런스와 나란히 비교→조정)을 **레퍼런스와 구도가 유사해질 때까지**(좌우 충전·중앙 통로·깊이 레이어가 다 보일 때) 수행.

## Acceptance Criteria

```bash
npm run test
npm run lint
npm run build
npm run smoke
AQUA_SMOKE_THEME=kelp-forest AQUA_SMOKE_SHOT=eval-theme-kelp.png AQUA_SMOKE_REPORT=eval-theme-kelp.json npm run smoke
AQUA_SMOKE_THEME=kelp-forest AQUA_SMOKE_BRIGHTNESS=1 AQUA_SMOKE_SHOT=eval-theme-kelp-bright.png AQUA_SMOKE_REPORT=eval-theme-kelp-bright.json npm run smoke
python3 scripts/eval_vision.py eval-theme-kelp.png docs/media/reference/ref-kelp-forest.jpg --min-score 62 --intent "다시마 숲: 홀드패스트 다발(포기당 3~6가닥)이 좌우를 상단까지 채우고 중앙만 통로로 트임. 먼 열은 흐릿한 원근 레이어. 황금-올리브 톤. 물고기 시야는 중앙 확보."
```

## 검증 절차

1. AC 전부 종료코드 0 (미니멀·투과 무회귀 포함). 프레임 확인: 스모크 리포트 frames가 기존 대비 급감하지 않았는가(인스턴스 증가 부담 체크).
2. 캡처와 `ref-kelp-forest.jpg`를 **나란히 Read**해 비교: 군락 다발감/좌우 충전/중앙 통로/깊이 레이어/톤 5가지가 모두 읽히는가.
3. 고밝기 캡처에서 아티팩트 없음.
4. index.json step 1 갱신 후 커밋: `feat(9-theme-quality): step 1 — kelp-density`.

## 금지사항

- 산호초·미니멀 구성 변경 금지. 물고기/크롤러 코드 변경 금지.
- additive·반투명 대형 평면 금지(원근 흐림은 alpha-discard 범위 내 색 lerp/디더로).
- `Math.random` 금지, 기존 테스트 파괴 금지.
