#!/usr/bin/env python3
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

service = (ROOT / "lib/teaching/lessonHomeworkDraft.ts").read_text()
modal = (ROOT / "components/teacher/LessonPlanModal.tsx").read_text()
progress = (ROOT / "app/teacher/progress/page.tsx").read_text()


def require(condition: bool, message: str) -> None:
    if not condition:
        raise AssertionError(message)
    print(f"PASS: {message}")


require(
    "ensureLessonHomeworkDraft" in service,
    "shared lesson-homework authority exists",
)

require(
    ".eq('lesson_plan_id', lessonPlanId)" in service,
    "existing homework is resolved by canonical lesson-plan identity",
)

require(
    "outcome: 'preserved_existing'" in service,
    "existing homework has an explicit preserve outcome",
)

require(
    "insertResult.error.code === '23505'" in service,
    "concurrent creation is handled through the unique constraint",
)

require(
    ".from('homework_questions')\n      .insert(" in service,
    "initial questions are created only through the shared service",
)

require(
    ".from('homework_questions').delete" not in service,
    "shared service never deletes homework questions",
)

require(
    "ensureLessonHomeworkDraft({" in modal,
    "LessonPlanModal consumes shared homework authority",
)

require(
    "ensureLessonHomeworkDraft({" in progress,
    "Progress consumes shared homework authority",
)

require(
    "homework_questions').delete" not in modal
    and 'homework_questions").delete' not in modal,
    "LessonPlanModal destructive question replacement is removed",
)

require(
    "homework_questions').delete" not in progress
    and 'homework_questions").delete' not in progress,
    "Progress destructive question replacement is removed",
)

require(
    ".from('homework').upsert" not in modal
    and '.from("homework").upsert' not in modal,
    "LessonPlanModal private homework upsert is removed",
)

require(
    ".from('homework').upsert" not in progress
    and '.from("homework").upsert' not in progress,
    "Progress private homework upsert is removed",
)

print("LP-002A1 homework authority tests PASSED")
