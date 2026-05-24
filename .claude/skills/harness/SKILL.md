---
name: harness
description: This skill should be used when working in a Harness-framework project (has scripts/execute.py and a phases/ directory) and the user wants to design or run a phased, self-correcting implementation plan. Trigger when the user says "하네스로 만들어줘", "하네스 워크플로우", "harness", "step 설계", "phase 설계", "execute.py 실행", "phases 만들어줘", or asks to break a feature into sequential, independently-executable step files that an automated runner builds and commits one by one.
version: 0.1.0
---

# Harness 프레임워크 워크플로우

기획·아키텍처 문서를 가드레일로 삼아, 하나의 작업을 자기완결적인 step들로 쪼개고, `scripts/execute.py`가 각 step을 독립 Claude 세션으로 순차 실행·검증·자가교정·커밋하게 만드는 워크플로우다.

## 적용 대상 확인

먼저 현재 프로젝트가 하네스 프레임워크 구조인지 확인한다:
- `scripts/execute.py` 존재
- `docs/`에 PRD/ARCHITECTURE/ADR 등 가드레일 문서
- (실행 시 생성/사용) `phases/` 디렉토리

없으면 사용자에게 하네스 프레임워크 설치 여부를 먼저 확인한다.

## 워크플로우

### A. 탐색
`docs/` 하위 문서(PRD, ARCHITECTURE, ADR, UI_GUIDE 등)와 `CLAUDE.md`를 읽고 기획·아키텍처·설계 의도를 파악한다. 광범위한 탐색이 필요하면 Explore 에이전트를 병렬로 쓴다.

### B. 논의
구현을 위해 구체화하거나 기술적으로 결정해야 할 사항(스택, 핵심 트레이드오프 등)이 있으면 사용자에게 제시하고 합의한다. 결정이 전체 step 구조를 좌우할 때는 AskUserQuestion으로 먼저 확정한다.

### C. Step 설계
사용자가 계획 작성을 지시하면 여러 step으로 나뉜 초안을 작성해 피드백을 요청한다. 설계 원칙:

1. **Scope 최소화** — 한 step에서 하나의 레이어/모듈만. 여러 모듈을 동시에 건드려야 하면 step을 쪼갠다.
2. **자기완결성** — 각 step 파일은 독립 세션에서 실행된다. "이전 대화에서처럼" 같은 외부 참조 금지. 필요한 정보는 전부 파일 안에 적는다.
3. **사전 준비 강제** — 읽어야 할 문서 경로와 이전 step 산출 파일 경로를 명시해, 세션이 맥락을 읽고 작업하게 유도한다.
4. **시그니처 수준 지시** — 함수/클래스 인터페이스만 제시하고 구현은 에이전트 재량에 맡긴다. 단 멱등성·보안·데이터 무결성 등 벗어나면 안 되는 핵심 규칙은 명시한다.
5. **AC는 실행 가능한 커맨드** — "동작해야 한다"가 아닌 `npm run build && npm test` 같은 실제 검증 커맨드.
6. **주의사항은 구체적으로** — "조심해라" 대신 "X를 하지 마라. 이유: Y".
7. **네이밍** — step name은 kebab-case slug로 핵심 모듈/작업을 한두 단어로 (예: `project-setup`, `api-layer`).

### D. 파일 생성
사용자 승인 후 아래를 생성한다.

**D-1. `phases/index.json`** (전체 현황) — 이미 있으면 `phases` 배열에 항목 추가.
```json
{ "phases": [ { "dir": "0-mvp", "status": "pending" } ] }
```
`status`: `pending`|`completed`|`error`|`blocked` (execute.py가 자동 갱신). 타임스탬프는 넣지 않는다.

**D-2. `phases/{task-name}/index.json`** (task 상세)
```json
{
  "project": "<프로젝트명>",
  "phase": "<task-name>",
  "steps": [
    { "step": 0, "name": "project-setup", "status": "pending" },
    { "step": 1, "name": "core-types", "status": "pending" }
  ]
}
```
- `phase`는 디렉토리명과 일치. `step`은 0부터. `status` 초기값 전부 `pending`.
- `created_at`(task), `started_at`(step), 각종 타임스탬프는 execute.py가 자동 기록 — 생성 시 넣지 않는다.

**D-3. `phases/{task-name}/step{N}.md`** (step마다 1개) — 다음 섹션 구성:
- `## 읽어야 할 파일` — 관련 docs + 이전 step 산출 파일 경로. (이미지 등 참고자료도 명시)
- `## 작업` — 구체적 지시. 파일 경로·시그니처·로직. 구현체는 에이전트에 위임하되 핵심 규칙은 박아넣는다.
- `## Acceptance Criteria` — 실행 가능한 커맨드 (```bash 블록).
- `## 검증 절차` — AC 실행 → 아키텍처 체크리스트 → `index.json` step status 갱신 규칙:
  - 성공 → `completed` + `summary`(다음 step에 유용한 산출물 한 줄 요약)
  - 3회 시도 후 실패 → `error` + `error_message`
  - 사용자 개입 필요(API키·인증·수동설정) → `blocked` + `blocked_reason` 후 즉시 중단
- `## 금지사항` — "X를 하지 마라. 이유: Y" + "기존 테스트를 깨뜨리지 마라".

상태 전이 시 자동 기록 필드: `completed`→`completed_at`+`summary`, `error`→`failed_at`+`error_message`, `blocked`→`blocked_at`+`blocked_reason`. `summary`/`message`/`reason`은 세션이, 타임스탬프는 execute.py가 기록한다.

### E. 실행
```bash
python3 scripts/execute.py {task-name}         # 순차 실행
python3 scripts/execute.py {task-name} --push  # 완료 후 push
```
execute.py가 자동 처리: `feat-{task-name}` 브랜치 생성/checkout, 가드레일 주입(CLAUDE.md + docs/*.md를 매 step 프롬프트에 포함), 컨텍스트 누적(완료 step의 summary 전달), 자가교정(실패 시 최대 3회 재시도, 이전 에러 피드백), 2단계 커밋(코드 `feat` / 메타데이터 `chore`), 타임스탬프 기록.

기본적으로 사용자가 직접 실행하게 두고, 실행 전 step 파일을 검토하게 한다. (실행은 비용·시간이 크므로 자동 실행을 강요하지 않는다.)

### 에러 복구
- **error**: 해당 step의 `status`를 `pending`으로, `error_message` 삭제 후 재실행.
- **blocked**: `blocked_reason`의 사유 해결 후 `status`를 `pending`으로, `blocked_reason` 삭제 후 재실행.

## 참고

`/harness` 슬래시 커맨드(`.claude/commands/harness.md`)도 동일 워크플로우를 명시적으로 호출한다. 이 스킬은 하네스 프로젝트 맥락에서 자동 트리거되는 버전이다.
