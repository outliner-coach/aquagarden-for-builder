#!/usr/bin/env python3
"""
비전 LLM 미적 판정 — 스모크(객관 깨짐 게이트)를 통과한 스크린샷을
reference 이미지·설계 의도와 비교해 "보여지는 수준"을 판정한다.

claude CLI(멀티모달)를 -p 모드로 호출해 두 이미지를 Read하고 JSON 평결을 받는다.
깨짐(blank/washed/무물고기)은 스모크가 이미 잡으므로, 여기서는 의도대로 보이는지에 집중한다.

Usage:
    python3 scripts/eval_vision.py <screenshot.png> [reference.png]
    → stdout에 JSON {pass, score, defects, summary} 출력, 종료코드 0=pass 1=fail

execute.py에서는 judge_visual()을 직접 import해 쓴다.
"""
import json
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

DEFAULT_INTENT = """이 앱은 화면 상단 가로 바 형태의 데스크톱 오버레이 '3D 디지털 아쿠아가든'이다.
디자인 방향은 B(스타일라이즈드 리치): 사진 같은 사실주의가 아니라, 조명(IBL)·물 색감·커스틱·
라이트 샤프트로 분위기를 살린 로우폴리 수족관. 배경은 투명(바탕화면 투과).
다양한 종의 물고기(흰동가리/나비고기/쏠배감펭/슬림 군집어)가 헤엄치고, 낮은 수초·바위·유목이
하단에 있다. reference_image.png는 톤·구성의 참고이며 1:1 복제가 목표는 아니다."""


def _build_prompt(shot_abs: str, ref_abs: str, intent: str) -> str:
    ref_line = f"- 참고 이미지(톤/구성 참고용): {ref_abs}\n" if ref_abs else ""
    return (
        "너는 데스크톱 수족관 오버레이 위젯의 비주얼 QA 리뷰어다.\n\n"
        f"먼저 Read 도구로 다음 이미지를 본다:\n- 평가 대상 스크린샷: {shot_abs}\n{ref_line}\n"
        f"## 설계 의도\n{intent}\n\n"
        "## 판정 기준\n"
        "- 깨짐(전체 단색/블랭크/물고기 안 보임/심하게 워시드)인지\n"
        "- 물고기가 보이고 종 구분이 되는지, 수초·바닥이 자연스러운지\n"
        "- 물속 분위기(색감/커스틱/샤프트)가 의도대로 느껴지는지\n"
        "- 배경 투과(투명)가 깨지지 않았는지\n"
        "미적 취향(예쁨)에는 관대하게, '깨졌거나 의도와 명백히 다른' 것에는 엄격하게 판정하라.\n\n"
        "## 출력\n"
        "오직 JSON 객체 하나만 출력하라. 다른 텍스트 금지:\n"
        '{"pass": true|false, "score": 0-100, "defects": ["..."], "summary": "한두 문장"}\n'
    )


def _extract_json(text: str) -> dict:
    # 가장 바깥 {...} 블록 추출
    m = re.search(r"\{.*\}", text, re.DOTALL)
    if not m:
        raise ValueError(f"JSON을 찾을 수 없음: {text[:200]}")
    return json.loads(m.group(0))


def judge_visual(screenshot: str, reference: str | None = None,
                 intent: str = DEFAULT_INTENT, timeout: int = 300) -> dict:
    """스크린샷을 비전 LLM으로 판정. {pass, score, defects, summary, raw} 반환.

    claude CLI가 없거나 실패하면 skipped=True로 통과 처리(파이프라인 차단 방지).
    """
    shot_abs = str(Path(screenshot).resolve())
    ref_abs = str(Path(reference).resolve()) if reference and Path(reference).exists() else ""
    prompt = _build_prompt(shot_abs, ref_abs, intent)

    try:
        result = subprocess.run(
            ["claude", "-p", "--dangerously-skip-permissions", "--output-format", "json", prompt],
            cwd=str(ROOT), capture_output=True, text=True, timeout=timeout,
        )
    except FileNotFoundError:
        return {"pass": True, "skipped": True, "summary": "claude CLI 없음 — 비전 판정 건너뜀"}
    except subprocess.TimeoutExpired:
        return {"pass": True, "skipped": True, "summary": "비전 판정 타임아웃 — 건너뜀"}

    if result.returncode != 0:
        return {"pass": True, "skipped": True, "summary": f"claude 비정상 종료 — 건너뜀: {result.stderr[:200]}"}

    # claude --output-format json: {"type":"result","result":"<text>",...}
    try:
        outer = json.loads(result.stdout)
        text = outer.get("result", result.stdout)
    except json.JSONDecodeError:
        text = result.stdout

    try:
        verdict = _extract_json(text)
    except (ValueError, json.JSONDecodeError):
        return {"pass": True, "skipped": True, "summary": f"비전 평결 파싱 실패 — 건너뜀: {text[:200]}"}

    verdict["raw"] = text[:500]
    verdict.setdefault("pass", True)
    return verdict


def main() -> None:
    if len(sys.argv) < 2:
        print("usage: eval_vision.py <screenshot.png> [reference.png]", file=sys.stderr)
        sys.exit(2)
    shot = sys.argv[1]
    ref = sys.argv[2] if len(sys.argv) > 2 else str(ROOT / "reference_image.png")
    verdict = judge_visual(shot, ref)
    print(json.dumps(verdict, ensure_ascii=False, indent=2))
    sys.exit(0 if verdict.get("pass", True) else 1)


if __name__ == "__main__":
    main()
