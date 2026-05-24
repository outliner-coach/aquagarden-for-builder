# Architecture Decision Records

## 철학
힐링 위젯이므로 **경량·저점유**가 최우선. 화려한 사실주의보다 부드럽고 미니멀한 움직임. MVP는 작동하는 최소 구현을 선택하고, 외부 의존성을 최소화한다.

---

### ADR-001: 데스크톱 셸로 Electron 선택
**결정**: Tauri/Unity/Unreal 대신 Electron.
**이유**: always-on-top, frameless 투명 창, `setIgnoreMouseEvents`(click-through) 등 요구된 OS 윈도우 기능을 크로스플랫폼으로 안정 지원. 사내 web(JS/TS) 역량과 맞아 개발 속도가 빠름.
**트레이드오프**: Tauri 대비 메모리 풋프린트가 큼. 성능 규칙(렌더 루프 정지·풀링)으로 상쇄한다.

### ADR-002: 3D 렌더링으로 Three.js(WebGL) 선택
**결정**: 순수 WebGL/엔진 대신 Three.js.
**이유**: 로우폴리 씬·라이팅·파티클·셰이더를 적은 코드로 구현. 알파 투명 배경(`alpha:true`, clearAlpha 0)으로 바탕화면 투과가 자연스러움.
**트레이드오프**: 엔진 대비 고급 물리/후처리는 약함. MVP 미니멀 방향과 일치하므로 문제없음.

### ADR-003: 빌드 도구로 Vite + TypeScript(strict)
**결정**: renderer 번들은 Vite, 전 영역 TypeScript strict.
**이유**: 빠른 HMR 개발 경험, main/preload/renderer 멀티 엔트리 처리 용이. strict 타입으로 IPC 페이로드 안전성 확보.
**트레이드오프**: electron 통합 설정에 초기 구성 비용. 1회성 비용으로 수용.

### ADR-004: OS 제어와 결정적 로직의 분리(테스트 전략)
**결정**: 창/click-through 등 부수효과는 main에 격리하고, boids·풀·밝기 매핑 등은 renderer 내 순수 함수로 분리해 Vitest로 단위 테스트.
**이유**: Electron/WebGL은 헤드리스 단위 테스트가 어렵다. 핵심 알고리즘만 순수 함수로 떼어내면 AC를 `npm test`로 실행 가능하게 만들 수 있다.
**트레이드오프**: 일부 통합 동작(실제 투명/투과)은 자동 테스트가 아닌 수동 확인에 의존. step의 검증 절차에 수동 체크 항목으로 명시.

### ADR-005: 물고기 개체수 제어는 객체 풀링
**결정**: 슬라이더 변경 시 생성/파괴가 아닌, 사전 확보된 풀의 활성 개수 조정.
**이유**: 실시간 증감 중 GC/할당으로 인한 프레임 드랍 방지. 비동기 분할 활성화로 스파이크 억제.
**트레이드오프**: 최대치만큼의 메모리를 선점. 최대 개체수 상한(config)으로 제한.

### ADR-006: 군집 행동은 Boids 알고리즘
**결정**: 소형 어류 무리에 separation/alignment/cohesion 3규칙 Boids 적용.
**이유**: 구현이 단순하고 연산이 가벼우며 자연스러운 대형 유지. 순수 벡터 함수로 분리해 테스트 가능.
**트레이드오프**: 종별 정교한 행동 패턴은 미구현. MVP 범위에서 충분.
