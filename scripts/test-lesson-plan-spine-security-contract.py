from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def text(path: str) -> str:
    return (ROOT / path).read_text()


def require(src: str, needle: str, label: str) -> None:
    assert needle in src, f"{label}: missing {needle!r}"


def forbid(src: str, needle: str, label: str) -> None:
    assert needle not in src, f"{label}: forbidden {needle!r}"


migration = text(
    "supabase/migrations/20260903102000_lesson_plan_spine_authority_evidence_privacy.sql"
)
evidence = text("components/teacher/EvidenceCaptureSheet.tsx")

# Gate 1: exact timetable occurrence is database authority, not only UI state.
require(migration, "alter column school_id set not null", "lesson school authority")
require(migration, "lesson_plan_enforce_slot_authority", "lesson slot trigger")
for code in (
    "lesson_plan_teacher_mismatch",
    "lesson_plan_class_mismatch",
    "lesson_plan_subject_mismatch",
    "lesson_plan_school_mismatch",
    "lesson_plan_invalid_occurrence_date",
    "lesson_plan_day_mismatch",
    "lesson_plan_week_mismatch",
    "lesson_plan_scheme_scope_mismatch",
):
    require(migration, code, f"lesson authority {code}")
require(
    migration,
    "extract(isodow from new.taught_date)::integer <> v_slot.day_of_week",
    "exact occurrence weekday",
)
require(migration, "v_slot.effective_until", "slot effective range")

# Gate 6: students never read a teacher's private draft plan.
require(migration, "drop policy if exists lesson_plans_student_read", "student policy replacement")
require(
    migration,
    "status in ('published', 'shared_to_parents')",
    "published-only student visibility",
)
require(migration, "sc.school_id = lesson_plans.school_id", "student school scope")

# Gate 4/5/6: whole-class evidence is exact-occurrence scoped and private.
require(migration, "'lesson-evidence',\n  'lesson-evidence',\n  false", "private evidence bucket")
require(migration, 'drop policy if exists "anyone reads evidence photos"', "remove public evidence read")
require(migration, '"teacher uploads own evidence photos"', "teacher evidence upload policy")
require(migration, '"teacher reads own lesson evidence media"', "teacher evidence read policy")
require(migration, '"teacher deletes own lesson evidence media"', "teacher evidence delete policy")
require(migration, "student_id is null", "whole-class evidence authorization")
require(migration, "o.lifecycle in ('in_progress', 'completed')", "teachable occurrence evidence")
require(migration, "lesson_evidence_enforce_occurrence_authority", "evidence authority trigger")
require(migration, "new.school_id := v_occ.school_id", "evidence school derivation")
require(migration, "lesson_evidence_plan_occurrence_mismatch", "evidence plan occurrence binding")

# Client must fail closed: private object references only, no public URL and no
# silent photo loss. Uploaded media is removed if the DB/lineage transaction fails.
require(evidence, 'const EVIDENCE_BUCKET = "lesson-evidence"', "canonical evidence bucket")
require(evidence, "crypto.randomUUID()", "collision-safe media identity")
require(evidence, "upsert: false", "no evidence overwrite")
require(evidence, "Evidence photo could not be uploaded", "upload failure surfaced")
require(evidence, "lesson-evidence://", "private media reference")
require(evidence, "removeUploadedPhoto(mediaRef)", "orphan media cleanup")
require(evidence, "teaching_occurrence_id: occurrenceId", "exact evidence occurrence")
require(evidence, "student_id: null", "whole-class evidence semantics")
forbid(evidence, "getPublicUrl", "public classroom evidence URL")
forbid(evidence, 'upsert: true', "overwrite evidence media")

print("lesson-plan spine security contract: PASS")
