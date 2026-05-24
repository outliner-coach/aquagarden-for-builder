# 프로젝트: 3D 디지털 아쿠아가든 (Aquagarden Overlay)

화면 상단에 가로 바 형태로 떠 있는 **데스크톱 오버레이 위젯**. 다른 작업 중에도 항상 위에 노출되며, 바탕화면이 투과되어 비치는 미니멀 3D 수족관.

## 기술 스택
- Electron (데스크톱 셸, 투명 창 + always-on-top + click-through)
- Three.js (WebGL 3D 렌더링)
- TypeScript (strict mode)
- Vite (renderer 번들러 + dev 서버)
- Vitest (테스트), ESLint (린트)

## 아키텍처 규칙
- CRITICAL: OS 윈도우 제어(always-on-top, click-through, 창 이동, show/hide)는 **반드시 main 프로세스에서만** 수행한다. renderer는 IPC(preload contextBridge)를 통해서만 요청한다.
- CRITICAL: renderer에서 `nodeIntegration`을 켜지 않는다. 모든 IPC는 preload의 `contextBridge.exposeInMainWorld`로 노출된 화이트리스트 API만 사용한다. (보안)
- CRITICAL: 창이 숨겨진(hidden) 상태에서는 Three.js 렌더 루프(`requestAnimationFrame`)를 **반드시 정지**한다. 힐링 위젯이므로 유휴 시 CPU/GPU 점유를 0에 가깝게 유지한다.
- CRITICAL: 물고기 오브젝트는 풀링(pooling)으로 재사용한다. 개체수 슬라이더 변경 시 매번 생성/파괴하지 말고 풀에서 활성/비활성 전환한다. 생성은 프레임 드랍을 막기 위해 비동기/분할 처리한다.
- 3D 코드는 `src/renderer/`, OS 제어는 `src/main/`, 공유 타입/상수는 `src/shared/`에 둔다. 레이어를 섞지 않는다.
- 매직 넘버 대신 `src/shared/config.ts`의 상수를 사용한다.

## 개발 프로세스
- CRITICAL: 새 기능 구현 시 순수 로직(boids 벡터 계산, 풀 grow/shrink, 밝기→intensity 매핑 등)은 반드시 테스트를 먼저 작성하고 통과시키는 구현을 작성한다 (TDD). 렌더링·OS 제어 같은 부수효과 코드는 순수 함수로 분리해 테스트한다.
- 커밋 메시지는 conventional commits 형식을 따른다 (feat:, fix:, docs:, refactor:, chore:).

## 명령어
npm run dev      # Electron + Vite 개발 모드 (창 자동 실행)
npm run build    # TypeScript 컴파일 + renderer 프로덕션 번들
npm run lint     # ESLint
npm run test     # Vitest (1회 실행)
