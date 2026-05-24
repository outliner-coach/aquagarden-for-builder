#!/usr/bin/env python3
"""
Harness Step Executor — phase 내 step을 순차 실행하고 자가 교정한다.

Usage:
    python3 scripts/execute.py <phase-dir> [--push]
"""

from __future__ import annotations

import argparse
import contextlib
import json
import os
import subprocess
import sys
import threading
import time
import types
from datetime import datetime, timezone, timedelta
from pathlib import Path
from typing import Optional

ROOT = Path(__file__).resolve().parent.parent

# 비전 판정(선택) — 없으면 스모크만으로 진행
try:
    from eval_vision import judge_visual  # type: ignore
except Exception:  # pragma: no cover
    judge_visual = None  # type: ignore


@contextlib.contextmanager
def progress_indicator(label: str):
    """터미널 진행 표시기. with 문으로 사용하며 .elapsed 로 경과 시간을 읽는다."""
    frames = "◐◓◑◒"
    stop = threading.Event()
    t0 = time.monotonic()

    def _animate():
        idx = 0
        while not stop.wait(0.12):
            sec = int(time.monotonic() - t0)
            sys.stderr.write(f"\r{frames[idx % len(frames)]} {label} [{sec}s]")
            sys.stderr.flush()
            idx += 1
        sys.stderr.write("\r" + " " * (len(label) + 20) + "\r")
        sys.stderr.flush()

    th = threading.Thread(target=_animate, daemon=True)
    th.start()
    info = types.SimpleNamespace(elapsed=0.0)
    try:
        yield info
    finally:
        stop.set()
        th.join()
        info.elapsed = time.monotonic() - t0


class StepExecutor:
    """Phase 디렉토리 안의 step들을 순차 실행하는 하네스."""

    MAX_RETRIES = 3
    FEAT_MSG = "feat({phase}): step {num} — {name}"
    CHORE_MSG = "chore({phase}): step {num} output"
    TZ = timezone(timedelta(hours=9))

    def __init__(self, phase_dir_name: str, *, auto_push: bool = False,
                 eval_enabled: bool = True):
        self._root = str(ROOT)
        self._phases_dir = ROOT / "phases"
        self._phase_dir = self._phases_dir / phase_dir_name
        self._phase_dir_name = phase_dir_name
        self._top_index_file = self._phases_dir / "index.json"
        self._auto_push = auto_push
        self._eval_enabled = eval_enabled and os.environ.get("AQUA_EVAL", "1") != "0"

        if not self._phase_dir.is_dir():
            print(f"ERROR: {self._phase_dir} not found")
            sys.exit(1)

        self._index_file = self._phase_dir / "index.json"
        if not self._index_file.exists():
            print(f"ERROR: {self._index_file} not found")
            sys.exit(1)

        idx = self._read_json(self._index_file)
        self._project = idx.get("project", "project")
        self._phase_name = idx.get("phase", phase_dir_name)
        self._total = len(idx["steps"])

    def run(self):
        self._print_header()
        self._check_blockers()
        self._checkout_branch()
        guardrails = self._load_guardrails()
        self._ensure_created_at()
        self._execute_all_steps(guardrails)
        self._phase_eval_gate()
        self._finalize()

    def _phase_eval_gate(self):
        """phase 끝 최종 런타임 eval 게이트. 실패 시 phase를 error로 표시하고 중단한다."""
        if not self._eval_enabled:
            return
        index = self._read_json(self._index_file)
        if not any(self._step_needs_eval(s) for s in index["steps"]) and not index.get("eval"):
            return
        with progress_indicator("Phase 최종 eval (build+smoke+vision)"):
            ok, report = self._run_eval("phase", vision=True)
        if ok:
            print(f"  ✓ Phase eval 통과: {report}")
            return
        print(f"\n  ✗ Phase 최종 eval 실패 — 목표 수준 미달:")
        print(f"    {report[:600]}")
        print(f"  해당 렌더 step의 status를 'pending'으로 되돌리고 다시 실행하세요.")
        self._update_top_index("error")
        sys.exit(1)

    # --- timestamps ---

    def _stamp(self) -> str:
        return datetime.now(self.TZ).strftime("%Y-%m-%dT%H:%M:%S%z")

    # --- JSON I/O ---

    @staticmethod
    def _read_json(p: Path) -> dict:
        return json.loads(p.read_text(encoding="utf-8"))

    @staticmethod
    def _write_json(p: Path, data: dict):
        p.write_text(json.dumps(data, indent=2, ensure_ascii=False), encoding="utf-8")

    # --- git ---

    def _run_git(self, *args) -> subprocess.CompletedProcess:
        cmd = ["git"] + list(args)
        return subprocess.run(cmd, cwd=self._root, capture_output=True, text=True)

    def _checkout_branch(self):
        branch = f"feat-{self._phase_name}"

        r = self._run_git("rev-parse", "--abbrev-ref", "HEAD")
        if r.returncode != 0:
            print(f"  ERROR: git을 사용할 수 없거나 git repo가 아닙니다.")
            print(f"  {r.stderr.strip()}")
            sys.exit(1)

        if r.stdout.strip() == branch:
            return

        r = self._run_git("rev-parse", "--verify", branch)
        r = self._run_git("checkout", branch) if r.returncode == 0 else self._run_git("checkout", "-b", branch)

        if r.returncode != 0:
            print(f"  ERROR: 브랜치 '{branch}' checkout 실패.")
            print(f"  {r.stderr.strip()}")
            print(f"  Hint: 변경사항을 stash하거나 commit한 후 다시 시도하세요.")
            sys.exit(1)

        print(f"  Branch: {branch}")

    def _commit_step(self, step_num: int, step_name: str):
        output_rel = f"phases/{self._phase_dir_name}/step{step_num}-output.json"
        index_rel = f"phases/{self._phase_dir_name}/index.json"

        self._run_git("add", "-A")
        self._run_git("reset", "HEAD", "--", output_rel)
        self._run_git("reset", "HEAD", "--", index_rel)

        if self._run_git("diff", "--cached", "--quiet").returncode != 0:
            msg = self.FEAT_MSG.format(phase=self._phase_name, num=step_num, name=step_name)
            r = self._run_git("commit", "-m", msg)
            if r.returncode == 0:
                print(f"  Commit: {msg}")
            else:
                print(f"  WARN: 코드 커밋 실패: {r.stderr.strip()}")

        self._run_git("add", "-A")
        if self._run_git("diff", "--cached", "--quiet").returncode != 0:
            msg = self.CHORE_MSG.format(phase=self._phase_name, num=step_num)
            r = self._run_git("commit", "-m", msg)
            if r.returncode != 0:
                print(f"  WARN: housekeeping 커밋 실패: {r.stderr.strip()}")

    # --- top-level index ---

    def _update_top_index(self, status: str):
        if not self._top_index_file.exists():
            return
        top = self._read_json(self._top_index_file)
        ts = self._stamp()
        for phase in top.get("phases", []):
            if phase.get("dir") == self._phase_dir_name:
                phase["status"] = status
                ts_key = {"completed": "completed_at", "error": "failed_at", "blocked": "blocked_at"}.get(status)
                if ts_key:
                    phase[ts_key] = ts
                break
        self._write_json(self._top_index_file, top)

    # --- guardrails & context ---

    def _load_guardrails(self) -> str:
        sections = []
        claude_md = ROOT / "CLAUDE.md"
        if claude_md.exists():
            sections.append(f"## 프로젝트 규칙 (CLAUDE.md)\n\n{claude_md.read_text()}")
        docs_dir = ROOT / "docs"
        if docs_dir.is_dir():
            for doc in sorted(docs_dir.glob("*.md")):
                sections.append(f"## {doc.stem}\n\n{doc.read_text()}")
        return "\n\n---\n\n".join(sections) if sections else ""

    @staticmethod
    def _build_step_context(index: dict) -> str:
        lines = [
            f"- Step {s['step']} ({s['name']}): {s['summary']}"
            for s in index["steps"]
            if s["status"] == "completed" and s.get("summary")
        ]
        if not lines:
            return ""
        return "## 이전 Step 산출물\n\n" + "\n".join(lines) + "\n\n"

    def _build_preamble(self, guardrails: str, step_context: str,
                        prev_error: Optional[str] = None) -> str:
        commit_example = self.FEAT_MSG.format(
            phase=self._phase_name, num="N", name="<step-name>"
        )
        retry_section = ""
        if prev_error:
            retry_section = (
                f"\n## ⚠ 이전 시도 실패 — 아래 에러를 반드시 참고하여 수정하라\n\n"
                f"{prev_error}\n\n---\n\n"
            )
        return (
            f"당신은 {self._project} 프로젝트의 개발자입니다. 아래 step을 수행하세요.\n\n"
            f"{guardrails}\n\n---\n\n"
            f"{step_context}{retry_section}"
            f"## 작업 규칙\n\n"
            f"1. 이전 step에서 작성된 코드를 확인하고 일관성을 유지하라.\n"
            f"2. 이 step에 명시된 작업만 수행하라. 추가 기능이나 파일을 만들지 마라.\n"
            f"3. 기존 테스트를 깨뜨리지 마라.\n"
            f"4. AC(Acceptance Criteria) 검증을 직접 실행하라.\n"
            f"5. /phases/{self._phase_dir_name}/index.json의 해당 step status를 업데이트하라:\n"
            f"   - AC 통과 → \"completed\" + \"summary\" 필드에 이 step의 산출물을 한 줄로 요약\n"
            f"   - {self.MAX_RETRIES}회 수정 시도 후에도 실패 → \"error\" + \"error_message\" 기록\n"
            f"   - 사용자 개입이 필요한 경우 (API 키, 인증, 수동 설정 등) → \"blocked\" + \"blocked_reason\" 기록 후 즉시 중단\n"
            f"6. 모든 변경사항을 커밋하라:\n"
            f"   {commit_example}\n\n---\n\n"
        )

    # --- Claude 호출 ---

    def _invoke_claude(self, step: dict, preamble: str) -> dict:
        step_num, step_name = step["step"], step["name"]
        step_file = self._phase_dir / f"step{step_num}.md"

        if not step_file.exists():
            print(f"  ERROR: {step_file} not found")
            sys.exit(1)

        prompt = preamble + step_file.read_text()
        result = subprocess.run(
            ["claude", "-p", "--dangerously-skip-permissions", "--output-format", "json", prompt],
            cwd=self._root, capture_output=True, text=True, timeout=1800,
        )

        if result.returncode != 0:
            print(f"\n  WARN: Claude가 비정상 종료됨 (code {result.returncode})")
            if result.stderr:
                print(f"  stderr: {result.stderr[:500]}")

        output = {
            "step": step_num, "name": step_name,
            "exitCode": result.returncode,
            "stdout": result.stdout, "stderr": result.stderr,
        }
        out_path = self._phase_dir / f"step{step_num}-output.json"
        with open(out_path, "w") as f:
            json.dump(output, f, indent=2, ensure_ascii=False)

        return output

    # --- 런타임 eval 게이트 ---

    @staticmethod
    def _step_needs_eval(step: dict) -> bool:
        """index.json step 항목에 "eval": true 가 있으면 런타임 eval 대상."""
        return bool(step.get("eval"))

    def _run_eval(self, label: str, step_num: Optional[int] = None,
                  *, vision: bool = False, vision_mode: str = "phase",
                  step_goal: Optional[str] = None) -> tuple[bool, str]:
        """빌드 → 스모크(headless 런타임) → (vision=True 시) 비전 미적 판정. (통과여부, 리포트).

        에이전트의 self-report를 신뢰하지 않고 실제 렌더링을 독립 검증한다.
        - vision_mode="step": 깨짐 + 이 step 목표 달성만 판정(미구현 후속 기능은 감점 안 함).
        - vision_mode="phase": reference 대비 체크리스트 항목별 채점 + 종합 점수 임계값.
        """
        eval_dir = self._phase_dir / "eval"
        eval_dir.mkdir(exist_ok=True)
        tag = f"step{step_num}" if step_num is not None else "phase"
        report_path = eval_dir / f"{tag}-smoke.json"
        shot_path = eval_dir / f"{tag}-shot.png"

        # 1) 빌드 (tsc + electron-vite build)
        b = subprocess.run(["npm", "run", "build"], cwd=self._root,
                           capture_output=True, text=True, timeout=600)
        if b.returncode != 0:
            return False, "build 실패:\n" + (b.stdout + b.stderr)[-1500:]

        # 2) 스모크 — Electron을 headless로 띄워 콘솔 에러·헬스·픽셀 검증
        electron = ROOT / "node_modules" / ".bin" / "electron"
        if not electron.exists():
            return False, "electron 바이너리를 찾을 수 없음 (npm install 필요)"
        env = {
            **os.environ,
            "AQUA_SMOKE": "1",
            "AQUA_SMOKE_REPORT": str(report_path),
            "AQUA_SMOKE_SHOT": str(shot_path),
        }
        try:
            s = subprocess.run([str(electron), "."], cwd=self._root,
                              capture_output=True, text=True, timeout=120, env=env)
        except subprocess.TimeoutExpired:
            return False, "스모크 타임아웃 (electron이 120s 내 종료 못함)"

        try:
            rep = json.loads(report_path.read_text(encoding="utf-8"))
        except (FileNotFoundError, json.JSONDecodeError):
            return False, f"스모크 리포트 없음 (electron exit {s.returncode}):\n{s.stderr[-800:]}"

        if not rep.get("pass"):
            fails = rep.get("failures", [])
            return False, "스모크(런타임) 실패:\n- " + "\n- ".join(str(f) for f in fails)

        # 3) 비전 미적 판정
        if vision and judge_visual is not None and os.environ.get("AQUA_EVAL_VISION", "1") != "0":
            ref = ROOT / "reference_image.png"
            verdict = judge_visual(
                str(shot_path),
                str(ref) if ref.exists() else None,
                mode=vision_mode,
                step_goal=step_goal,
            )
            if verdict.get("skipped"):
                print(f"  (비전 판정 건너뜀: {verdict.get('summary','')})")
            elif not verdict.get("pass", True):
                defects = "; ".join(verdict.get("defects", []))
                score = verdict.get("overallScore", verdict.get("score", "?"))
                crit = verdict.get("failedCritical")
                crit_txt = f"\n핵심항목 미달: {', '.join(crit)}" if crit else ""
                return False, (f"비전 미적 판정 실패 (score={score}, mode={vision_mode}): "
                              f"{verdict.get('summary','')}{crit_txt}\n결함: {defects}")

        return True, f"eval 통과 (스모크{'+비전' if vision else ''}), screenshot={shot_path}"

    # --- 헤더 & 검증 ---

    def _print_header(self):
        print(f"\n{'='*60}")
        print(f"  Harness Step Executor")
        print(f"  Phase: {self._phase_name} | Steps: {self._total}")
        if self._auto_push:
            print(f"  Auto-push: enabled")
        print(f"{'='*60}")

    def _check_blockers(self):
        index = self._read_json(self._index_file)
        for s in reversed(index["steps"]):
            if s["status"] == "error":
                print(f"\n  ✗ Step {s['step']} ({s['name']}) failed.")
                print(f"  Error: {s.get('error_message', 'unknown')}")
                print(f"  Fix and reset status to 'pending' to retry.")
                sys.exit(1)
            if s["status"] == "blocked":
                print(f"\n  ⏸ Step {s['step']} ({s['name']}) blocked.")
                print(f"  Reason: {s.get('blocked_reason', 'unknown')}")
                print(f"  Resolve and reset status to 'pending' to retry.")
                sys.exit(2)
            if s["status"] != "pending":
                break

    def _ensure_created_at(self):
        index = self._read_json(self._index_file)
        if "created_at" not in index:
            index["created_at"] = self._stamp()
            self._write_json(self._index_file, index)

    # --- 실행 루프 ---

    def _execute_single_step(self, step: dict, guardrails: str) -> bool:
        """단일 step 실행 (재시도 포함). 완료되면 True, 실패/차단이면 False."""
        step_num, step_name = step["step"], step["name"]
        done = sum(1 for s in self._read_json(self._index_file)["steps"] if s["status"] == "completed")
        prev_error = None

        for attempt in range(1, self.MAX_RETRIES + 1):
            index = self._read_json(self._index_file)
            step_context = self._build_step_context(index)
            preamble = self._build_preamble(guardrails, step_context, prev_error)

            tag = f"Step {step_num}/{self._total - 1} ({done} done): {step_name}"
            if attempt > 1:
                tag += f" [retry {attempt}/{self.MAX_RETRIES}]"

            with progress_indicator(tag) as pi:
                self._invoke_claude(step, preamble)
                elapsed = int(pi.elapsed)

            index = self._read_json(self._index_file)
            status = next((s.get("status", "pending") for s in index["steps"] if s["step"] == step_num), "pending")
            ts = self._stamp()

            if status == "completed":
                # 에이전트 self-report를 신뢰하지 않고 런타임 eval로 독립 검증한다.
                # (build/test/lint 통과해도 실제 렌더가 깨질 수 있으므로 — 이 갭이 과거 사고의 원인)
                if self._eval_enabled and self._step_needs_eval(step):
                    goal = next((s.get("summary") for s in index["steps"] if s["step"] == step_num), None)
                    with progress_indicator(f"Step {step_num} eval (build+smoke+vision)"):
                        ok, report = self._run_eval(
                            f"step{step_num}", step_num,
                            vision=True, vision_mode="step", step_goal=goal,
                        )
                    if not ok:
                        index = self._read_json(self._index_file)
                        if attempt < self.MAX_RETRIES:
                            for s in index["steps"]:
                                if s["step"] == step_num:
                                    s["status"] = "pending"
                                    s.pop("error_message", None)
                            self._write_json(self._index_file, index)
                            prev_error = "런타임 eval 실패 — 실제로 동작/표시되지 않음:\n" + report
                            print(f"  ↻ Step {step_num}: eval 실패 → retry {attempt}/{self.MAX_RETRIES}")
                            print(f"    {report.splitlines()[0] if report else ''}")
                            continue
                        ts = self._stamp()
                        for s in index["steps"]:
                            if s["step"] == step_num:
                                s["status"] = "error"
                                s["error_message"] = f"[{self.MAX_RETRIES}회 시도 후 eval 실패] {report}"
                                s["failed_at"] = ts
                        self._write_json(self._index_file, index)
                        self._commit_step(step_num, step_name)
                        print(f"  ✗ Step {step_num}: 런타임 eval 실패 (최대 시도 초과)")
                        print(f"    {report[:400]}")
                        self._update_top_index("error")
                        sys.exit(1)
                    print(f"  ✓ eval 통과: {report}")

                for s in index["steps"]:
                    if s["step"] == step_num:
                        s["completed_at"] = ts
                self._write_json(self._index_file, index)
                self._commit_step(step_num, step_name)
                print(f"  ✓ Step {step_num}: {step_name} [{elapsed}s]")
                return True

            if status == "blocked":
                for s in index["steps"]:
                    if s["step"] == step_num:
                        s["blocked_at"] = ts
                self._write_json(self._index_file, index)
                reason = next((s.get("blocked_reason", "") for s in index["steps"] if s["step"] == step_num), "")
                print(f"  ⏸ Step {step_num}: {step_name} blocked [{elapsed}s]")
                print(f"    Reason: {reason}")
                self._update_top_index("blocked")
                sys.exit(2)

            err_msg = next(
                (s.get("error_message", "Step did not update status") for s in index["steps"] if s["step"] == step_num),
                "Step did not update status",
            )

            if attempt < self.MAX_RETRIES:
                for s in index["steps"]:
                    if s["step"] == step_num:
                        s["status"] = "pending"
                        s.pop("error_message", None)
                self._write_json(self._index_file, index)
                prev_error = err_msg
                print(f"  ↻ Step {step_num}: retry {attempt}/{self.MAX_RETRIES} — {err_msg}")
            else:
                for s in index["steps"]:
                    if s["step"] == step_num:
                        s["status"] = "error"
                        s["error_message"] = f"[{self.MAX_RETRIES}회 시도 후 실패] {err_msg}"
                        s["failed_at"] = ts
                self._write_json(self._index_file, index)
                self._commit_step(step_num, step_name)
                print(f"  ✗ Step {step_num}: {step_name} failed after {self.MAX_RETRIES} attempts [{elapsed}s]")
                print(f"    Error: {err_msg}")
                self._update_top_index("error")
                sys.exit(1)

        return False  # unreachable

    def _execute_all_steps(self, guardrails: str):
        while True:
            index = self._read_json(self._index_file)
            pending = next((s for s in index["steps"] if s["status"] == "pending"), None)
            if pending is None:
                print("\n  All steps completed!")
                return

            step_num = pending["step"]
            for s in index["steps"]:
                if s["step"] == step_num and "started_at" not in s:
                    s["started_at"] = self._stamp()
                    self._write_json(self._index_file, index)
                    break

            self._execute_single_step(pending, guardrails)

    def _finalize(self):
        index = self._read_json(self._index_file)
        index["completed_at"] = self._stamp()
        self._write_json(self._index_file, index)
        self._update_top_index("completed")

        self._run_git("add", "-A")
        if self._run_git("diff", "--cached", "--quiet").returncode != 0:
            msg = f"chore({self._phase_name}): mark phase completed"
            r = self._run_git("commit", "-m", msg)
            if r.returncode == 0:
                print(f"  ✓ {msg}")

        if self._auto_push:
            branch = f"feat-{self._phase_name}"
            r = self._run_git("push", "-u", "origin", branch)
            if r.returncode != 0:
                print(f"\n  ERROR: git push 실패: {r.stderr.strip()}")
                sys.exit(1)
            print(f"  ✓ Pushed to origin/{branch}")

        print(f"\n{'='*60}")
        print(f"  Phase '{self._phase_name}' completed!")
        print(f"{'='*60}")


def main():
    parser = argparse.ArgumentParser(description="Harness Step Executor")
    parser.add_argument("phase_dir", help="Phase directory name (e.g. 0-mvp)")
    parser.add_argument("--push", action="store_true", help="Push branch after completion")
    parser.add_argument("--no-eval", action="store_true",
                        help="런타임 eval 게이트(빌드+스모크+비전) 비활성화")
    args = parser.parse_args()

    StepExecutor(args.phase_dir, auto_push=args.push, eval_enabled=not args.no_eval).run()


if __name__ == "__main__":
    main()
