# 아키텍처

Electron 3프로세스(main / preload / renderer) 구조. OS 제어는 main, 3D·UI는 renderer, 둘 사이는 preload의 contextBridge로만 통신.

## 디렉토리 구조
```
src/
├── main/                 # Electron main 프로세스 (Node 환경)
│   ├── index.ts          # 앱 엔트리, BrowserWindow 생성
│   ├── window.ts         # 투명/frameless/always-on-top 와이드 바 창 설정, show/hide
│   ├── overlay.ts        # click-through(setIgnoreMouseEvents), 창 이동(moveBy)
│   └── ipc.ts            # ipcMain 핸들러 등록 (화이트리스트)
├── preload/
│   └── index.ts          # contextBridge.exposeInMainWorld('aqua', {...})
├── renderer/             # 브라우저 환경 (Three.js + UI)
│   ├── main.ts           # renderer 엔트리, 부트스트랩
│   ├── core/
│   │   ├── RenderLoop.ts # requestAnimationFrame 루프, pause/resume
│   │   ├── SceneRoot.ts  # Scene/Camera/WebGLRenderer(alpha:true) 셋업, resize
│   │   └── ObjectPool.ts # 제네릭 풀 (acquire/release/resize)
│   ├── entities/
│   │   ├── Fish.ts       # 물고기 메시 + 개별 유영 애니메이션
│   │   ├── FishSchool.ts # 풀 + boids 적용 + 개체수 제어
│   │   ├── boids.ts      # 순수 함수: separation/alignment/cohesion 벡터
│   │   ├── Aquascape.ts  # 모래 바닥, 낮은 수초(vertex shader), 바위
│   │   └── Bubbles.ts    # 기포 파티클 시스템
│   ├── lighting/
│   │   └── Lighting.ts   # 상단 조명 + 밝기→intensity/분위기 매핑
│   └── ui/
│       ├── ControlPanel.ts  # 플로팅 버튼 + 확장 패널, 슬라이더, 토글
│       └── drag.ts          # 버튼 드래그(창 이동)·패널 드래그(자기 이동) 핸들러
├── shared/
│   ├── config.ts         # 창 크기, 물고기 한계, 색상, 카메라 등 상수
│   ├── ipc-channels.ts   # IPC 채널명 상수
│   └── types.ts          # AppSettings, IPC 페이로드 타입
└── (vite/electron 설정은 루트: vite.config.ts, electron.vite.config 등)
```

## 패턴
- **프로세스 분리**: 부수효과(OS, 창)는 main에 격리, 결정적 로직(boids, 풀, 매핑)은 renderer 내 순수 함수로 분리해 단위 테스트.
- **객체 풀링**: Fish는 ObjectPool로 재사용. 개체수 변경 = 풀의 활성 개수 조정(생성/파괴 아님).
- **렌더 루프 게이팅**: RenderLoop는 단일 rAF 소유자. hidden 시 stop(), 표시 시 start().
- **컴포넌트형 엔티티**: 각 엔티티는 `update(dt)` / `dispose()` 인터페이스를 갖고 SceneRoot가 오케스트레이션.

## 데이터 흐름
```
[슬라이더/버튼 조작]
  renderer UI(ControlPanel) → 상태 변경 → 해당 엔티티.update 파라미터 반영
       │
       └─(OS 동작이 필요한 경우: 창 이동/숨김/click-through)
            → window.aqua.* (preload contextBridge)
            → ipcRenderer.invoke/send
            → ipcMain 핸들러(src/main/ipc.ts)
            → window.ts / overlay.ts 가 BrowserWindow 제어

[프레임 루프]
  RenderLoop(rAF) → SceneRoot.update(dt) → 각 엔티티.update(dt) → renderer.render()
  (hidden 시 루프 정지)
```

## 상태 관리
- 런타임 설정(`fishCount`, `brightness`, `hidden`, `clickThrough`)은 renderer의 단일 `AppSettings` 객체로 보관. 변경 시 관련 엔티티/IPC로 전파.
- 영속화는 MVP 범위 밖(인메모리). 필요 시 main의 간단한 JSON 저장으로 확장 가능하게 둔다.
- 전역 상태 라이브러리 도입하지 않음 — 단일 화면·소규모 상태이므로 plain 객체 + 콜백/이벤트로 충분.
