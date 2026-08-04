#!/usr/bin/env python3
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

service = (ROOT / "lib/teaching/lessonExerciseDraft.ts").read_text()
modal = (ROOT / "components/teacher/LessonPlanModal.tsx").read_text()


def require(condition: bool, message: str) -> None:
    if not condition:
        raise AssertionError(message)
    print(f"PASS: {message}")


require(
    "ensureLessonExerciseDraft" in service,
    "shared lesson-exercise authority exists",
)

require(
    ".eq('lesson_plan_id', lessonPlanId)" in service,
    "existing exercise resolves by canonical lesson-plan identity",
)

require(
    "outcome: 'preserved_existing'" in service,
    "existing exercise has an explicit preserve outcome",
)

require(
    "insertResult.error.code === '23505'" in service,
    "concurrent exercise creation uses the unique constraint",
)

require(
    ".from('exercises')\n    .insert({" in service,
    "exercise service creates only through insert",
)

require(
    ".from('exercises')\n    .update(" not in service,
    "exercise service never updates an existing exercise",
)

require(
    ".from('exercises')\n    .upsert(" not in service,
    "exercise service never upserts an existing exercise",
)

require(
    "exercise_submissions" not in service,
    "exercise service never touches learner submissions",
)

require(
    "ensureLessonExerciseDraft({" in modal,
    "LessonPlanModal consumes shared exercise authority",
)

require(
    ".from('exercises').upsert" not in modal,
    "LessonPlanModal destructive exercise upsert is removed",
)

print("LP-002A2A exercise authority tests PASSED")
