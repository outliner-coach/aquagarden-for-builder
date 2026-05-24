# 아키텍처

Electron 3프로세스(main / preload / renderer) 구조. OS 제어는 main, 3D·UI는 renderer, 둘 사이는 preload의 contextBridge로만 통신.

## 디렉토리 구조
```
src/
├── main/                 # Electron main 프로세스 (Node 환경)
│   ├── index.ts          # 앱 엔트리, BrowserWindow 생성 (AQUA_SMOKE=1이면 스모크 모드)
│   ├── window.ts         # 투명/frameless/always-on-top 와이드 바 창 설정, show/hide
│   ├── overlay.ts        # click-through(setIgnoreMouseEvents), 창 이동(moveBy)
│   ├── ipc.ts            # ipcMain 핸들러 등록 (화이트리스트)
│   ├── smoke.ts          # headless 런타임 eval: 숨김 창 렌더→콘솔/헬스/capturePage 수집
│   └── smokeEval.ts      # 스모크 합/불 판정 (순수 함수, 단위 테스트) — docs/EVAL.md
├── preload/
│   └── index.ts          # contextBridge.exposeInMainWorld('aqua', {...})
├── renderer/             # 브라우저 환경 (Three.js + UI)
│   ├── main.ts           # renderer 엔트리, 부트스트랩
│   ├── core/
│   │   ├── RenderLoop.ts # requestAnimationFrame 루프, pause/resume
│   │   ├── SceneRoot.ts  # Scene/Camera/WebGLRenderer(alpha:true) 셋업, resize
│   │   └── ObjectPool.ts # 제네릭 풀 (acquire/release/resize)
│   ├── health.ts         # window.__AQUA_HEALTH__ (ready/fishActive/errors/frames) — eval용
│   ├── entities/
│   │   ├── Fish.ts       # GLB 클론(SkeletonUtils) + AnimationMixer 본 애니메이션 + 헤딩
│   │   ├── FishSchool.ts # 풀 + boids 적용 + 개체수 제어 + 비동기 프로토타입 로딩
│   │   ├── fishAssets.ts # GLB 매니페스트/로더(scene+swim클립), 머티리얼 FX, pickSpecies(순수)
│   │   ├── fishHelpers.ts# 순수: nextActiveCount, headingYaw(머리-선행 가드), seedToPhase 등
│   │   ├── boids.ts      # 순수 함수: separation/alignment/cohesion 벡터
│   │   ├── Aquascape.ts  # 모래(노멀/버텍스컬러), 그래스 카드(InstancedMesh+버텍스 스웨이), 바위·유목
│   │   ├── aquascapeHelpers.ts # 순수: generatePlantInstances, generateHardscape, swayHeightFactor
│   │   ├── caustics.ts   # 절차적 커스틱 텍스처 + onBeforeCompile 주입(공유 uniform)
│   │   ├── waterDepth.ts # 깊이 틴트+알파 페이드 onBeforeCompile (THREE.Fog 미사용)
│   │   ├── LightShafts.ts# additive 라이트 샤프트 (알파 누적 블렌드)
│   │   ├── GlowSprites.ts# 하이라이트 글로우(가짜 블룸, 풀스크린 블룸 미사용)
│   │   └── Bubbles.ts    # 소프트 additive 기포 스프라이트
│   ├── lighting/
│   │   ├── Lighting.ts   # directional+ambient+scene.environmentIntensity, 밝기 매핑
│   │   └── lightingHelpers.ts # 순수: brightnessTo{Intensity,Ambient,EnvIntensity}
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

## 렌더링 파이프라인
- `SceneRoot`가 `WebGLRenderer({ alpha:true })`+clearAlpha 0(투명) + `scene.environment`(PMREM/RoomEnvironment IBL)를 설정. `scene.background`는 항상 null(투과 보존).
- 모든 오브제는 **조명 받는 재질**(MeshStandard/Lambert). 커스틱·물깊이·림은 `onBeforeCompile` 주입(공유 uniform). 투명 캔버스 셰이더 함정은 `CLAUDE.md` 참고.

## 런타임 검증 (eval)
`build/test/lint`(순수 로직)와 별개로, 실제 렌더를 독립 검증하는 eval 층이 있다. 자기보고를 신뢰하지 않는다.
```
npm run smoke → AQUA_SMOKE=1 main(숨김창) → 콘솔에러·health·capturePage 수집 → smokeEval(순수) 합/불
scripts/execute.py → "eval":true step·phase끝에서 스모크+비전(scripts/eval_vision.py) 자동 게이트·재시도
```
상세·임계값·환경변수·"무엇을 못 잡나"는 **`docs/EVAL.md`**. 방향 등 객관 불변식은 유닛테스트(`fishHelpers.headingYaw`)가 가드.
