#!/usr/bin/env python3
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

MODAL = ROOT / "components/teacher/LessonPlanModal.tsx"
SERVICE = ROOT / "lib/teaching/lessonParentDelivery.ts"
MIGRATION = (
    ROOT
    / "supabase/migrations/20260804064246_lp002a2b_parent_delivery.sql"
)
DB_TYPES = ROOT / "lib/database.types.ts"


def require(condition: bool, message: str) -> None:
    if not condition:
        raise AssertionError(message)
    print(f"PASS: {message}")


def main() -> int:
    modal = MODAL.read_text(encoding="utf-8")
    service = SERVICE.read_text(encoding="utf-8")
    migration = MIGRATION.read_text(encoding="utf-8")
    db_types = DB_TYPES.read_text(encoding="utf-8")

    require(
        "deliverLessonPlanToParents" in service,
        "shared lesson-parent delivery authority exists",
    )
    require(
        ".rpc(" in service
        and "'deliver_lesson_plan_to_parents'" in service,
        "shared service consumes guarded database RPC",
    )
    require(
        "deliverLessonPlanToParents({" in modal,
        "LessonPlanModal consumes shared delivery authority",
    )
    require(
        ".from('parent_messages').insert(" not in modal,
        "LessonPlanModal direct parent_messages insert is removed",
    )
    require(
        modal.index("deliverLessonPlanToParents({")
        < modal.index(".update({ status: 'shared_to_parents' })"),
        "parent delivery completes before lesson status transition",
    )
    require(
        modal.index("ensureLessonHomeworkDraft({")
        < modal.index(".update({ status: 'shared_to_parents' })"),
        "homework operation completes before lesson status transition",
    )
    require(
        modal.index("ensureLessonExerciseDraft({")
        < modal.index(".update({ status: 'shared_to_parents' })"),
        "exercise operation completes before lesson status transition",
    )
    require(
        "add column if not exists lesson_plan_id uuid" in migration,
        "migration adds canonical lesson-plan identity",
    )
    require(
        "add column if not exists delivery_purpose text" in migration,
        "migration adds delivery-purpose identity",
    )
    require(
        "uq_parent_messages_lesson_student_purpose" in migration,
        "database enforces one canonical delivery per lesson learner purpose",
    )
    require(
        "security definer" in migration
        and "set search_path = public, pg_temp" in migration,
        "RPC uses hardened security-definer form",
    )
    require(
        "auth.uid()" in migration
        and "is_school_admin" in migration,
        "RPC verifies teacher or school-admin authority",
    )
    require(
        "s.class_id = v_plan.class_id" in migration,
        "RPC derives recipients from authoritative lesson class",
    )
    require(
        "s.deleted_at is null" in migration,
        "RPC excludes inactive learners",
    )
    require(
        "on conflict (" in migration
        and "delivery_purpose" in migration
        and "do update set" in migration,
        "repeat delivery updates canonical rows instead of duplicating",
    )
    require(
        "'in_app'" in migration,
        "canonical delivery uses valid in-app channel",
    )
    require(
        "'lesson_plan'" in migration,
        "generated_by constraint supports lesson-plan delivery",
    )
    require(
        "deliver_lesson_plan_to_parents:" in db_types,
        "generated database types expose delivery RPC",
    )
    require(
        "lesson_plan_id: string | null" in db_types,
        "generated database types expose message lesson identity",
    )
    require(
        "delivery_purpose: string | null" in db_types,
        "generated database types expose message delivery purpose",
    )

    print("LP-002A2B parent delivery contract tests PASSED")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
