# Step 7: effects-polish

## 읽어야 할 파일

- `/docs/superpowers/specs/2026-05-24-aquagarden-visual-quality-design.md` (§3.4 기포 소프트 스프라이트, 하이라이트 글로우 — 풀스크린 블룸 금지)
- `/docs/ADR.md` (ADR-002 투명, 경량)
- `/CLAUDE.md` (hidden 시 렌더 정지, 매직넘버 금지)
- `src/renderer/entities/Bubbles.ts` + `src/renderer/entities/bubblesHelpers.ts` + `__tests__` (현재 기포 시스템 — 업그레이드)
- `src/renderer/entities/Fish.ts` (눈 등 하이라이트 글로우 부착 지점)
- `src/shared/config.ts` (BUBBLE 상수)

## 작업

마무리 폴리시. 기포를 소프트 additive 스프라이트로 업그레이드하고, 풀스크린 블룸 대신 가짜 블룸(글로우 스프라이트)으로 하이라이트를 살린다.

1. **기포 소프트 스프라이트**
   - 현재 기포를 부드러운 라디얼 알파(중심 밝고 가장자리 투명)의 `CanvasTexture` 스프라이트/`Points`로 업그레이드. `AdditiveBlending`(또는 normal + soft alpha), `depthWrite:false`.
   - 상승·사인 흔들림 등 기존 bubblesHelpers 로직 보존. 크기에 약간의 변주, 수면 근처에서 페이드아웃.
   - additive는 정렬 불필요 — 정렬 로직 추가하지 말 것.

2. **하이라이트 글로우(가짜 블룸)**
   - 물고기 눈/밝은 포인트, 또는 커스틱 핫스팟에 작은 additive 글로우 스프라이트를 더한다. 풀스크린 블룸 없이 "반짝임" 표현.
   - 과하지 않게, 개수 제한. 밝기 슬라이더와 연동(어두울 때 상대적으로 더 도드라지되 과하지 않게).

3. **성능 마무리 점검**
   - hidden 시 렌더 루프 정지가 여전히 유효한지(추가된 효과가 별도 타이머/rAF를 만들지 않았는지) 확인. 모든 애니메이션은 공유 `update(dt)`/`uTime`에 태운다.
   - 개체수 최대에서도 프레임이 안정적인지 dev에서 확인.

4. **순수 헬퍼 (TDD 먼저)**
   - 기포 크기/페이드 곡선, 글로우 세기 매핑 등 새 계산이 있으면 순수 함수로 분리해 `bubblesHelpers.ts`(또는 신규) + `__tests__`에 테스트.
   - 기존 bubblesHelpers 테스트는 유지.

## Acceptance Criteria

```bash
npm run test
npm run build
npm run lint
```

## 검증 절차

1. AC 3개 종료코드 0. 기포/글로우 순수 함수 테스트 통과(기존 포함).
2. `npm run dev` **수동 확인**: (a) 기포가 부드러운 발광 입자로 보이고 자연스럽게 상승·페이드, (b) 물고기 눈/하이라이트에 은은한 반짝임, (c) 검은 사각형/배경 깨짐 없음(풀스크린 블룸 미사용 확인), (d) 창을 숨겼다 보이면 정상 재개되고 숨김 중 CPU/GPU가 거의 0.
3. 아키텍처 체크리스트:
   - 풀스크린 블룸/포스트프로세싱을 쓰지 않았는가? (투명 알파 깨짐 방지 — CRITICAL)
   - 추가 효과가 별도 rAF/타이머 없이 공유 update에 통합됐는가? (hidden 시 정지 보존)
   - additive 스프라이트가 depthWrite:false이며 정렬 비용을 추가하지 않는가?
   - 순수 헬퍼가 테스트되는가?
4. `phases/1-visual-quality/index.json`의 step 7 갱신:
   - 성공 → `completed` + `summary`에 "기포 소프트 additive 스프라이트 업그레이드, 가짜 블룸 글로우 스프라이트(풀스크린 블룸 미사용), 공유 update 통합으로 hidden 정지 보존, 헬퍼+테스트" 요약. phase 전체 완료 의미.
   - 실패 3회 → `error`. 사용자 개입 → `blocked`.

## 금지사항

- `EffectComposer`/`UnrealBloomPass` 등 풀스크린 포스트프로세싱을 도입하지 마라. 이유: 투명 창에서 프래그먼트 알파가 1로 강제돼 배경이 검게 깨진다(설계 §3.4, 검증됨).
- 별도의 `requestAnimationFrame`/`setInterval`을 만들지 마라. 이유: hidden 시 렌더 정지(CLAUDE.md CRITICAL)가 무력화된다 — 공유 RenderLoop/update에 태운다.
- 기포에 정렬(sort) 로직을 추가하지 마라. 이유: additive는 교환법칙 성립, 정렬 불필요(비용 낭비).
- 물고기/수초/모래/커스틱/물 분위기의 기존 동작을 훼손하지 마라.
- 기존 테스트를 깨뜨리지 마라.
