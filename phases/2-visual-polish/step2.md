# Step 2: atmosphere-tuning

## 읽어야 할 파일

- `/docs/superpowers/specs/2026-05-24-aquagarden-visual-quality-design.md` (§3.3 커스틱, §3.4 물 분위기·라이트 샤프트)
- `/CLAUDE.md` (투명 유지, 매직넘버 금지, hidden 시 렌더 정지)
- `/reference_image.png` (참고 톤 — 푸른 수중감)
- `src/renderer/entities/caustics.ts` (`CAUSTIC` 세기/스크롤), `src/renderer/entities/LightShafts.ts`
- `src/renderer/main.ts` (수중 베일 `setWaterVeil`)
- `src/shared/config.ts` (`CAUSTIC`, `WATER`)

## 작업

비전 eval에서 caustics·waterAtmosphere가 약하다. 수중 분위기를 끌어올린다. **단 투과(투명)는 핵심 요구사항이니 베일은 은은하게 유지**(과하면 스모크 투과 게이트·요구사항 위반).

1. 커스틱(`CAUSTIC` config) 세기/대비를 모래·물고기·바위에서 더 또렷하게(과하지 않게). 2중 UV 스크롤 유지.
2. 라이트 샤프트(`WATER.shaft`): 가시성·자연스러움 미세 조정(이미 알파 누적 블렌드로 보임). 너무 두껍거나 불투명하지 않게.
3. 수중 베일(`setWaterVeil`): 청록 톤·세기 미세 조정으로 수중감↑, 단 투과 보존(스모크 transparentRatio 게이트 통과). 밝기 연동 유지.
4. 매직넘버 대신 config 상수.

## Acceptance Criteria

```bash
npm run test
npm run build
npm run lint
npm run smoke
```

## 검증 절차

1. AC 4개 종료코드 0. `npm run smoke` pass(특히 투과 보존·블랭크 아님).
2. 관련 순수 함수(causticUvOffset, depthToWaterTint 등) 테스트 통과 유지.
3. 체크리스트:
   - 커스틱이 또렷이 일렁이고, 라이트 샤프트가 자연스럽게 보이는가?
   - 수중 베일이 은은하며 바탕화면 투과가 유지되는가?(불투명 X)
   - `THREE.Fog` 미사용·풀스크린 블룸 미사용 유지?
   - 매직넘버 대신 config? 기존 테스트 유지?
4. **런타임 eval 게이트**: 완료 후 execute.py가 스모크+비전 eval 자동 실행. 이 step은 phase 마지막이므로 phase-끝 비전(레퍼런스 대비 체크리스트·종합 점수 임계 62)도 통과해야 한다.
5. `phases/2-visual-polish/index.json`의 step 2 갱신(completed/error/blocked 규칙 동일).

## 금지사항

- 수중 베일을 진하게 만들어 바탕화면 투과를 깨지 마라. 이유: 투과는 핵심 요구사항(requirement §2). 은은하게.
- `THREE.Fog`/`FogExp2`나 풀스크린 포스트프로세싱(블룸)을 도입하지 마라. 이유: 투명 창 알파 깨짐(설계 §3.4).
- 물고기/수초/하드스케이프 로직을 바꾸지 마라.
- 기존 테스트를 깨뜨리지 마라.
