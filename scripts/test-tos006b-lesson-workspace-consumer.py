#!/usr/bin/env python3
"""TOS-006B static contract checks for LessonPlanModal."""

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MODAL = ROOT / "components/teacher/LessonPlanModal.tsx"


def require(condition: bool, message: str) -> None:
    if not condition:
        raise AssertionError(message)


def main() -> int:
    text = MODAL.read_text(encoding="utf-8")

    require(
        "deriveTeachingWorkspace" in text,
        "LessonPlanModal does not import the shared workspace resolver",
    )

    require(
        "resolveOccurrence" in text,
        "LessonPlanModal does not load the authoritative occurrence",
    )

    require(
        "const [teachingOccurrence," in text,
        "LessonPlanModal does not store the TeachingOccurrence domain object",
    )

    require(
        "const workspace = teachingOccurrence" in text,
        "LessonPlanModal does not derive a TeachingWorkspace",
    )

    require(
        "workspace?.canStart" in text,
        "Start Lesson availability is not workspace-driven",
    )

    require(
        "workspace?.canComplete" in text,
        "Complete Lesson availability is not workspace-driven",
    )

    require(
        "workspace?.lifecycle === 'completed'" in text,
        "completed state is not workspace-driven",
    )

    require(
        "fetchOccurrenceLifecycle" not in text,
        "legacy lifecycle-only reader remains",
    )

    require(
        "occLifecycle" not in text,
        "private lifecycle state remains",
    )

    require(
        "setTeachingOccurrence" in text,
        "authoritative occurrence state is never updated",
    )

    require(
        text.count("await refreshTeachingWorkspace()") >= 3,
        "workspace is not refreshed after all required mutations",
    )

    print("PASS: LessonPlanModal consumes shared Teaching Workspace")
    print("PASS: authoritative TeachingOccurrence is retained")
    print("PASS: lifecycle-only reader removed")
    print("PASS: Start and Complete capabilities are centralized")
    print("PASS: workspace refreshes after plan/start/complete")
    print("TOS-006B lesson workspace consumer tests PASSED")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
