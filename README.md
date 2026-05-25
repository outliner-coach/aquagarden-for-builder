# 🐠 Aquagarden

화면 상단에 가로 바 형태로 떠 있는 **데스크톱 오버레이 위젯**. 다른 작업을 하는 동안에도
항상 위에 떠 있고 바탕화면이 투과되어 비치는, 미니멀한 3D 수족관입니다. 힐링용 위젯이라
유휴 시 CPU/GPU 점유를 0에 가깝게 유지합니다.

- **Electron**(투명·always-on-top·click-through 창) + **Three.js**(WebGL 3D) + **TypeScript** + **Vite**
- 숨김 상태에선 렌더 루프를 멈춰 절전, 물고기는 풀링으로 재사용

## ✨ 주요 기능

- **물고기 5종**(CC0 GLB) — 원본 본 클립을 재생하는 스켈레탈 애니메이션 + boids 군집
- **조명** — IBL(환경맵) 기반, 밝기 슬라이더가 조명·환경 강도를 함께 조절
- **수중 분위기** — 절차적 커스틱(모래·물고기·돌에 투사), 깊이 틴트, 수중 베일, 기포·글로우
- **인터랙션** — 물고기 클릭 시 대사, 먹이주기/놀래키기
- **창 조작** — 플로팅 버튼 드래그로 이동, 모서리 그립으로 크기 조절, 패널 자동 위/아래 열기
- **이용 가이드** — 패널의 `?` 버튼으로 각 컨트롤 사용법 안내

## 🎛️ 컨트롤 (우상단 버튼 → 패널)

| 항목 | 설명 |
|------|------|
| 개체수 | 헤엄치는 물고기 수 |
| 밝기 | 수조 조명 밝기 |
| 배경 투명도 | 물고기를 제외한 수조(바닥·수초·돌)의 투명도. 0이면 물고기만 |
| 수조 숨김 | 렌더링을 멈춰 절전(플로팅 버튼만 남음) |
| 마우스 투과 | 수조 영역 클릭을 뒤쪽 화면으로 통과 |
| Always on Top | 항상 다른 창 위에 표시 |
| 먹이주기 / 놀래키기 | 켠 뒤 화면을 클릭하면 물고기가 반응 |
| 크기 조절 | 수조의 오른쪽·아래·우하단 모서리를 드래그 |
| 종료 | 두 번 눌러 종료 |

## 📥 설치 (사용자)

[Releases](https://github.com/outliner-coach/aquagarden-for-builder/releases)에서 OS에 맞는 파일을 받으세요.

> ⚠️ 코드서명이 안 된 무료 배포라 첫 실행에 한 번 우회가 필요합니다.
> - **macOS**: `.dmg`를 열어 `응용 프로그램`으로 드래그 → 앱 **우클릭 → 열기**.
>   "손상되었기 때문에…" 오류 시(Apple Silicon): `xattr -cr /Applications/Aquagarden.app` 후 재실행.
> - **Windows**: `.exe` 실행 → SmartScreen에서 **추가 정보 → 실행**.

## 🛠️ 개발

```bash
npm install
npm run dev      # Electron + Vite 개발 모드(창 자동 실행)
npm run build    # 타입체크 + 프로덕션 번들(out/)
npm run lint     # ESLint
npm run test     # Vitest(순수 로직)
npm run smoke    # 빌드 + headless 런타임 eval(셰이더/렌더 깨짐·투과 자동 검증)
```

> 시각 변경 후엔 `build/test/lint` 통과만으로 "표시됨"을 단정하지 말고 `npm run smoke`로 실제 렌더를
> 검증하세요. 자세한 규칙은 [`CLAUDE.md`](CLAUDE.md) 참고.

### 구조
- `src/main/` — OS 창 제어(always-on-top·click-through·이동·크기). **OS 제어는 main에서만.**
- `src/preload/` — `contextBridge` 화이트리스트 IPC만 노출(보안: `nodeIntegration` 미사용)
- `src/renderer/` — Three.js 3D 씬·UI
- `src/shared/` — 공유 타입·상수(`config.ts`)

## 🚀 배포

`v*` 태그를 push하면 GitHub Actions가 macOS·Windows 설치 파일을 빌드해 Releases에 자동 첨부합니다.

```bash
git tag v0.1.0
git push origin v0.1.0
```

자세한 절차·서명 옵션은 [`docs/DEPLOY.md`](docs/DEPLOY.md) 참고.

## 📄 라이선스 / 에셋

물고기 모델은 CC0 GLB 에셋을 사용합니다.
