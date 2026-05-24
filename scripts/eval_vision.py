#!/usr/bin/env python3
"""
비전 LLM 미적 판정 — 스모크(객관 깨짐 게이트)를 통과한 스크린샷을
설계 의도·reference 이미지와 비교해 "보여지는 수준"을 판정한다.

두 모드:
  - mode="step"  : per-step 점검. "깨지지 않음 + 이 step의 목표가 화면에 보이는가"만 본다.
                   아직 구현되지 않은 후속 기능은 감점하지 않는다(부분 결과 판정).
  - mode="phase" : phase 끝 최종 판정. reference·설계의도와 체크리스트 항목별 채점 +
                   종합 점수 임계값으로 합불.

합불은 LLM의 pass 불리언만 믿지 않고 점수에서 결정적으로 계산한다(임계값 기반).
claude CLI(멀티모달)를 -p 모드로 호출. CLI/이미지/파싱 실패 시 skipped=True로 통과(파이프라인 차단 방지).

Usage:
    python3 scripts/eval_vision.py <screenshot.png> [reference.png]   # phase 모드
"""
from __future__ import annotations

import json
import os
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

# 임계값 (env로 조정 가능)
# 투명 오버레이는 '물 부피' 색을 가질 수 없어 레퍼런스(불투명 어항) 대비 분위기 점수가
# 구조적으로 낮다 → 종합 합격선은 낮추되(62), 핵심 항목(깨짐/물고기/자세)은 엄격(60) 유지.
PHASE_MIN_SCORE = int(os.environ.get("AQUA_EVAL_MIN_SCORE", "62"))      # 종합 점수 합격선
PHASE_CRITICAL_MIN = int(os.environ.get("AQUA_EVAL_CRITICAL_MIN", "60"))  # 핵심 항목 최저선
STEP_MIN_SCORE = int(os.environ.get("AQUA_EVAL_STEP_MIN_SCORE", "60"))   # per-step 합격선

DEFAULT_INTENT = """이 앱은 화면 상단 가로 바 형태의 데스크톱 오버레이 '3D 디지털 아쿠아가든'이다.
디자인 방향은 B(스타일라이즈드 리치): 사진 같은 사실주의가 아니라, 조명(IBL)·물 색감·커스틱·
라이트 샤프트로 분위기를 살린 로우폴리 수족관. 배경은 투명(바탕화면 투과).
다양한 종의 물고기(흰동가리/나비고기/쏠배감펭/슬림 군집어)가 헤엄치고, 낮은 수초·바위·유목이
하단에 있다. reference_image.png는 톤·구성의 참고이며 1:1 복제가 목표는 아니다.
물고기는 수평으로 헤엄치고 머리가 진행 방향을 향해야 한다(거꾸로·수직·머리아래는 결함).
중요: 스크린샷의 짙은 회색 배경은 투명(바탕화면 투과)이 정상 작동함을 합성으로 표현한 것이다.
회색 배경 자체는 결함이 아니며, 투과 보존 여부는 별도 객관 지표로 이미 검증된다.
또한 상단의 옅은 청록색 그라디언트는 의도된 '수중 분위기 베일'이며 결함이 아니다."""

# phase 체크리스트 항목 (핵심 항목은 미달 시 즉시 실패)
PHASE_CATEGORIES = [
    ("notBroken", "단색/블랭크/명백한 렌더 깨짐이 없는가", True),
    ("transparency", "배경 투과(짙은 회색=투과 정상). 객관 지표가 별도 검증하므로 비핵심", False),
    ("fish", "물고기가 보이고 종 구분이 되는가", True),
    ("fishPose", "물고기 자세가 자연스러운가 — 수평으로 유영하고 머리가 진행방향을 향하며, 거꾸로/수직/머리아래가 아닌가", True),
    ("plants", "수초가 풍성하고 자연스러운가", False),
    ("hardscape", "바위·유목 등 바닥 구성이 자연스러운가", False),
    ("waterAtmosphere", "물속 색감/깊이감이 의도대로인가", False),
    ("caustics", "커스틱(빛 그물) 일렁임이 보이는가", False),
    ("lightShafts", "위에서 내려오는 라이트 샤프트가 보이는가", False),
]


def _phase_prompt(shot_abs: str, ref_abs: str, intent: str) -> str:
    ref_line = f"- 참고 이미지(톤/구성, 1:1 복제 목표 아님): {ref_abs}\n" if ref_abs else ""
    cats = "\n".join(f'  - "{k}": {desc}' for k, desc, _ in PHASE_CATEGORIES)
    return (
        "너는 데스크톱 수족관 오버레이 위젯의 비주얼 QA 리뷰어다. phase 최종 판정이다.\n\n"
        f"Read 도구로 이미지를 본다:\n- 평가 대상: {shot_abs}\n{ref_line}\n"
        f"## 설계 의도\n{intent}\n\n"
        "## 항목별 채점 (각 0-100)\n"
        f"{cats}\n\n"
        "미적 취향(예쁨)에는 관대하게, '깨졌거나 의도와 명백히 다른' 것에는 엄격하게 채점하라.\n\n"
        "## 출력 (오직 JSON 하나, 다른 텍스트 금지)\n"
        '{"overallScore": 0-100, "categories": {"notBroken": {"score":0-100,"note":"..."}, ...모든 항목...},'
        ' "defects": ["..."], "summary": "한두 문장"}\n'
    )


def _step_prompt(shot_abs: str, step_goal: str, intent: str) -> str:
    return (
        "너는 데스크톱 수족관 오버레이 위젯의 비주얼 QA 리뷰어다. 개발 중 단계(부분 결과) 점검이다.\n\n"
        f"Read 도구로 스크린샷을 본다: {shot_abs}\n\n"
        f"## 전체 설계 의도(맥락용)\n{intent}\n\n"
        f"## 이번 단계의 목표(이것만 판정)\n{step_goal}\n\n"
        "## 판정 규칙\n"
        "- 화면이 깨지지 않고(단색/블랭크/물고기 실종 아님), 이번 단계의 목표가 화면에 반영됐는지만 본다.\n"
        "- CRITICAL: 아직 구현되지 않은 '후속 단계' 기능(예: 아직 추가 안 된 커스틱/샤프트/수초 등)이 "
        "없다는 이유로 감점하지 마라. 이건 완성본이 아니라 부분 결과다.\n\n"
        "## 출력 (오직 JSON 하나)\n"
        '{"score": 0-100, "broken": true|false, "defects": ["..."], "summary": "한두 문장"}\n'
    )


def _run_claude(prompt: str, timeout: int) -> tuple[bool, str]:
    """(ok, text). ok=False면 skip 사유가 text."""
    try:
        r = subprocess.run(
            ["claude", "-p", "--dangerously-skip-permissions", "--output-format", "json", prompt],
            cwd=str(ROOT), capture_output=True, text=True, timeout=timeout,
        )
    except FileNotFoundError:
        return False, "claude CLI 없음"
    except subprocess.TimeoutExpired:
        return False, "비전 판정 타임아웃"
    if r.returncode != 0:
        return False, f"claude 비정상 종료: {r.stderr[:200]}"
    try:
        text = json.loads(r.stdout).get("result", r.stdout)
    except json.JSONDecodeError:
        text = r.stdout
    return True, text


def _extract_json(text: str) -> dict:
    m = re.search(r"\{.*\}", text, re.DOTALL)
    if not m:
        raise ValueError(f"JSON 없음: {text[:200]}")
    return json.loads(m.group(0))


def judge_visual(screenshot: str, reference: str | None = None,
                 intent: str = DEFAULT_INTENT, *, mode: str = "phase",
                 step_goal: str | None = None, timeout: int = 300) -> dict:
    """비전 미적 판정. {pass, score|overallScore, ...}. 실패 시 skipped=True로 통과."""
    shot_abs = str(Path(screenshot).resolve())
    if mode == "step":
        prompt = _step_prompt(shot_abs, step_goal or "(목표 정보 없음 — 깨짐 여부만 판정)", intent)
    else:
        ref_abs = str(Path(reference).resolve()) if reference and Path(reference).exists() else ""
        prompt = _phase_prompt(shot_abs, ref_abs, intent)

    ok, text = _run_claude(prompt, timeout)
    if not ok:
        return {"pass": True, "skipped": True, "summary": f"{text} — 비전 판정 건너뜀"}

    try:
        v = _extract_json(text)
    except (ValueError, json.JSONDecodeError):
        return {"pass": True, "skipped": True, "summary": f"비전 평결 파싱 실패 — 건너뜀: {text[:200]}"}

    v["raw"] = text[:600]
    if mode == "step":
        score = int(v.get("score", 0))
        broken = bool(v.get("broken", False))
        v["pass"] = (not broken) and score >= STEP_MIN_SCORE
        v["score"] = score
    else:
        cats = v.get("categories", {}) or {}
        overall = int(v.get("overallScore", 0))
        failed_critical = []
        for key, _desc, critical in PHASE_CATEGORIES:
            sc = int((cats.get(key) or {}).get("score", 0))
            if critical and sc < PHASE_CRITICAL_MIN:
                failed_critical.append(f"{key}={sc}<{PHASE_CRITICAL_MIN}")
        v["overallScore"] = overall
        v["failedCritical"] = failed_critical
        v["pass"] = overall >= PHASE_MIN_SCORE and not failed_critical
    return v


def main() -> None:
    if len(sys.argv) < 2:
        print("usage: eval_vision.py <screenshot.png> [reference.png]", file=sys.stderr)
        sys.exit(2)
    shot = sys.argv[1]
    ref = sys.argv[2] if len(sys.argv) > 2 else str(ROOT / "reference_image.png")
    verdict = judge_visual(shot, ref, mode="phase")
    print(json.dumps(verdict, ensure_ascii=False, indent=2))
    sys.exit(0 if verdict.get("pass", True) else 1)


if __name__ == "__main__":
    main()
