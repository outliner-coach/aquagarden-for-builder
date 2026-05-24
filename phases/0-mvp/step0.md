# Step 0: project-setup

## 읽어야 할 파일

먼저 아래 파일을 읽고 아키텍처와 설계 의도를 파악하라:

- `/CLAUDE.md` (기술 스택, CRITICAL 규칙, 명령어)
- `/docs/ARCHITECTURE.md` (디렉토리 구조, 프로세스 분리)
- `/docs/ADR.md` (ADR-001~003: Electron/Three.js/Vite 선택 이유)

## 작업

Electron + Three.js + TypeScript(strict) + Vite + Vitest + ESLint 프로젝트 골격을 만든다.

1. **패키지 초기화 및 의존성 설치**
   - `package.json` 생성. `"type": "module"`.
   - 빌드 도구는 **`electron-vite`** 를 사용한다 (main/preload/renderer 3-엔트리 네이티브 지원).
   - dependencies: `three`, `electron`
   - devDependencies: `electron-vite`, `vite`, `typescript`, `vitest`, `eslint`, `@typescript-eslint/parser`, `@typescript-eslint/eslint-plugin`, `@types/three`, `@types/node`
   - 설치는 `npm install`로 수행한다. (네트워크 사용)

2. **npm 스크립트** (CLAUDE.md 명령어와 정확히 일치시킬 것)
   ```json
   "scripts": {
     "dev": "electron-vite dev",
     "build": "tsc --noEmit && electron-vite build",
     "lint": "eslint . --ext .ts",
     "test": "vitest run"
   }
   ```
   - CRITICAL: `npm run lint`, `npm run build`, `npm run test` 세 커맨드는 이 step 이후 **모든 step에서 종료코드 0**이어야 한다 (Stop 훅이 매번 실행함). 빈/샘플 상태라도 반드시 통과하게 구성하라.

3. **설정 파일**
   - `tsconfig.json`: `"strict": true`, `moduleResolution: "bundler"`, `target: "ES2022"`, `module: "ESNext"`, `noEmit: true`, `skipLibCheck: true`. include `src`.
   - `electron.vite.config.ts`: main(`src/main/index.ts`), preload(`src/preload/index.ts`), renderer(`src/renderer/`, root에 index.html). renderer는 브라우저 타깃.
   - `.eslintrc.cjs` (또는 flat config): `@typescript-eslint` 기반. 과한 규칙 금지 — 통과 가능한 합리적 기본만.
   - `vitest.config.ts`: `environment: "node"`.

4. **최소 소스 (부팅 확인용 — 폴리시는 후속 step이 담당)**
   - `src/main/index.ts`: `app.whenReady()` 후 `BrowserWindow` 1개 생성.
     - 옵션: `transparent: true`, `frame: false`, `alwaysOnTop: true`, `resizable: false`, `skipTaskbar: false`,
       `webPreferences: { preload: <preload 경로>, contextIsolation: true, nodeIntegration: false }`.
     - 위치/크기: 화면 상단 가로 바. 임시로 `width = 작업영역 너비`, `height = 220`, `x = 0`, `y = 0` 정도로 둔다 (step 2가 config로 정교화).
     - renderer 로드 (electron-vite 개발/프로덕션 분기 표준 방식 사용).
   - `src/preload/index.ts`: 지금은 비어 있어도 됨 (`// bridge는 step 3에서 추가`).
   - `src/renderer/index.html`: `#app` 컨테이너 + module script로 `main.ts` 로드. `<body>` 배경 투명(`background: transparent; margin:0; overflow:hidden`).
   - `src/renderer/main.ts`: 화면 전체를 덮는 `<canvas>`를 만들고 Three.js로 **투명 배경**(`alpha:true`, `setClearColor(0x000000, 0)`) 씬에 회전하는 더미 큐브 하나만 렌더 (부팅 확인용 플레이스홀더, step 4에서 교체).
   - `.gitignore`에 `dist/`, `out/`가 포함되도록 확인/추가 (이미 `node_modules/` 등은 존재).

5. **샘플 테스트**
   - `src/shared/__tests__/sanity.test.ts` 같은 위치에 `expect(1+1).toBe(2)` 수준의 통과 테스트 1개를 둬서 `npm test`가 0으로 끝나게 한다.

## Acceptance Criteria

```bash
npm install
npm run lint    # 종료코드 0
npm run build   # 종료코드 0 (tsc --noEmit + electron-vite build)
npm run test    # 종료코드 0
```

## 검증 절차

1. 위 AC 커맨드를 순서대로 실행해 모두 종료코드 0인지 확인한다.
2. 아키텍처 체크리스트:
   - 디렉토리가 `src/main`, `src/preload`, `src/renderer`, `src/shared`로 분리되었는가? (ARCHITECTURE.md)
   - main 옵션에 `contextIsolation: true`, `nodeIntegration: false`가 들어갔는가? (CLAUDE.md CRITICAL 보안 규칙)
3. 결과에 따라 `phases/0-mvp/index.json`의 step 0을 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary"`에 "설치된 빌드 스택(electron-vite), 생성한 엔트리 파일 경로, npm 스크립트 명령" 한 줄 요약
   - 3회 시도 후 실패 → `"status": "error"`, `"error_message"`에 구체적 에러
   - 사용자 개입 필요(예: 네트워크 차단으로 설치 불가) → `"status": "blocked"`, `"blocked_reason"` 기록 후 중단

## 금지사항

- 실제 수족관 로직(물고기, 조명, 패널)을 만들지 마라. 이유: 이 step은 부팅 가능한 빈 골격만 책임진다. 콘텐츠는 후속 step 소관.
- `nodeIntegration: true`로 켜지 마라. 이유: 보안 CRITICAL 규칙 위반.
- 기존 테스트를 깨뜨리지 마라.
