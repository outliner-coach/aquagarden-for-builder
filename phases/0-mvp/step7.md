# Step 7: boids-school

## 읽어야 할 파일

- `/docs/PRD.md` (핵심기능 10: 소형 어류 군집 행동)
- `/docs/ADR.md` (ADR-006 Boids: separation/alignment/cohesion, 순수 함수로 분리)
- `/CLAUDE.md` (TDD: boids 벡터는 테스트 먼저)
- `/reference_image.png` (좌측 소형어 밀집 군집의 대형 느낌 참고)
- `src/renderer/entities/Fish.ts`, `src/renderer/entities/FishSchool.ts` (step 6의 유영/훅, `FishKind`)
- `src/shared/config.ts`

## 작업

소형 어류가 무리를 지어 대형을 유지하며 함께 방향을 바꾸는 군집 행동을 추가한다. **boids 벡터 계산은 순수 함수로 작성하고 TDD로 먼저 테스트**한다.

1. **`src/renderer/entities/boids.ts`** (순수 — three 의존 최소화, 가능하면 `{x,y,z}` 평범한 벡터 타입 사용)
   - `separation(self, neighbors, radius): Vec3` — 너무 가까운 이웃에서 멀어지는 벡터.
   - `alignment(self, neighbors): Vec3` — 이웃 평균 속도에 정렬.
   - `cohesion(self, neighbors): Vec3` — 이웃 무게중심으로 향함.
   - `computeBoidsSteer(self, neighbors, weights, radii): Vec3` — 세 힘을 가중합한 최종 조향 벡터. 가중치/반경은 config에서.
   - 이웃이 없을 때, 자기 자신만 있을 때 등 엣지 케이스에서 0 또는 안전한 값 반환.
   - CRITICAL(TDD): 위 함수들의 테스트를 **먼저** 작성한다 — 예: 오른쪽에 이웃이 몰려 있으면 separation은 왼쪽(-x)을 향한다, 이웃 속도가 +x면 alignment가 +x를 향한다, cohesion이 무게중심 방향인지 등. 그 다음 통과하는 구현을 작성.

2. **`FishSchool` 통합**
   - 활성 물고기 중 **소형 군집어 부류(`FishKind` 기준)**에만 매 `update(dt)`에서 `computeBoidsSteer`를 적용해 속도를 갱신(step 6에서 열어둔 훅 사용). 개별 대형어는 boids에서 제외하고 자유 유영 유지. 최대 속도/선회율 제한으로 부드럽게.
   - 이웃 탐색은 단순 거리 기반으로 충분(MVP). 개체수 상한이 작으므로 O(n^2)도 허용. 단, 명백한 비효율(매 프레임 대량 할당)은 피한다.
   - config에 `BOIDS` 가중치/반경/최대속도 상수를 추가(없으면).

## Acceptance Criteria

```bash
npm run build
npm run test    # boids 3규칙 + computeBoidsSteer 벡터 방향 단위 테스트 통과 (TDD)
npm run lint
```

## 검증 절차

1. AC 실행, 모두 0 확인.
2. `npm run dev`로 소형 어류가 무리를 이뤄 함께 선회하며, 서로 겹치지 않고(separation) 대형을 유지하는지 **수동 확인**.
3. 체크리스트:
   - boids 함수가 three/DOM 없이 순수하게 테스트되는가? (ADR-006)
   - 테스트를 먼저 작성했는가(TDD)? 방향성 단언이 포함됐는가?
   - 군집이 자연스럽고 떨림/발산 없이 안정적인가? (최대속도/선회 제한)
4. `phases/0-mvp/index.json`의 step 7 업데이트:
   - 성공 → `completed` + `summary`에 "boids.ts 함수 시그니처, FishSchool 통합 방식, 추가한 BOIDS config" 요약.

## 금지사항

- 슬라이더 UI/조명/파티클을 만들지 마라. 이유: step 8·9 소관.
- boids 계산을 three의 Vector3 메서드에 강결합해 테스트 불가능하게 만들지 마라. 이유: 순수성·테스트 가능성(ADR-004/006).
- 기존 테스트를 깨뜨리지 마라.
