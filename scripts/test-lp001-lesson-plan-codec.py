#!/usr/bin/env python3
"""Static LP-001 lesson-plan contract verification."""

from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

CODEC = ROOT / "lib/teaching/lessonPlanCodec.ts"
MODAL = ROOT / "components/teacher/LessonPlanModal.tsx"
SCHEME = ROOT / "app/teacher/scheme/generate/page.tsx"
API = ROOT / "app/api/generate-lesson-plan/route.ts"


def require(condition: bool, message: str) -> None:
    if not condition:
        raise AssertionError(message)


def main() -> int:
    codec = CODEC.read_text(encoding="utf-8")
    modal = MODAL.read_text(encoding="utf-8")
    scheme = SCHEME.read_text(encoding="utf-8")
    api = API.read_text(encoding="utf-8")

    required_keys = [
        "objectives",
        "resources",
        "introduction",
        "development",
        "consolidation",
        "assessmentHook",
        "homework",
        "differentiation",
    ]

    for key in required_keys:
        require(
            f"'{key}'" in codec,
            f"codec missing canonical key: {key}",
        )

    require(
        "parseLessonPlanBody" in codec,
        "canonical body parser missing",
    )
    require(
        "serializeLessonPlanBody" in codec,
        "canonical body serializer missing",
    )
    require(
        "parseGeneratedLessonPlan" in codec,
        "generated-object validator missing",
    )

    require(
        "parseLessonPlanBody" in modal,
        "LessonPlanModal does not consume canonical parser",
    )
    require(
        "serializeLessonPlanBody" in modal,
        "LessonPlanModal does not consume canonical serializer",
    )
    require(
        "function parsePlan" not in modal,
        "LessonPlanModal still owns a private parser",
    )

    require(
        "serializeLessonPlanBody(generated)" in scheme,
        "scheme generator does not persist canonical body",
    )
    require(
        "const body = JSON.stringify({" not in scheme,
        "scheme generator still persists JSON lesson body",
    )

    require(
        "conclusion:" not in scheme,
        "legacy conclusion field remains in live scheme generator",
    )
    require(
        "assessment:" not in scheme,
        "legacy assessment field remains in live scheme generator",
    )

    for key in required_keys:
        require(
            f'"{key}"' in scheme,
            f"scheme generator prompt missing key: {key}",
        )

    require(
        "parseGeneratedLessonPlan" in api,
        "API does not validate canonical generated plan",
    )
    require(
        "const plan = parseGeneratedLessonPlan" in api,
        "API does not parse AI output through canonical validator",
    )
    require(
        "if (!plan)" in api,
        "API does not reject invalid generated contract",
    )

    parse_position = api.index(
        "const plan = parseGeneratedLessonPlan"
    )
    deduction_position = api.index(
        "const newBalance"
    )

    require(
        parse_position < deduction_position,
        "credit is deducted before canonical response validation",
    )

    print("PASS: canonical eight-section codec exists")
    print("PASS: modal consumes shared parser and serializer")
    print("PASS: scheme generator persists canonical tagged body")
    print("PASS: legacy conclusion/assessment contract removed")
    print("PASS: scheme prompt requests all canonical sections")
    print("PASS: API validates plan before credit deduction")
    print("LP-001 lesson-plan contract tests PASSED")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
