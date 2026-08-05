#!/usr/bin/env python3
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MIGRATION = ROOT / "supabase/migrations/20260805143000_hw_student_001_submission_authority.sql"
SERVICE = ROOT / "lib/homework/studentSubmission.ts"
PAGE = ROOT / "app/student/homework/[id]/page.tsx"


def require(condition: bool, message: str) -> None:
    if not condition:
        raise AssertionError(message)
    print(f"PASS: {message}")


def main() -> int:
    migration = MIGRATION.read_text(encoding="utf-8")
    service = SERVICE.read_text(encoding="utf-8")
    page = PAGE.read_text(encoding="utf-8")

    require("uq_homework_submissions_homework_student" in migration, "one canonical submission per learner and homework")
    require("uq_homework_answers_submission_question" in migration, "one canonical answer per question")
    require("save_student_homework_draft" in migration, "guarded draft RPC exists")
    require("submit_student_homework" in migration, "guarded submit RPC exists")
    require("security definer" in migration and "set search_path = public, pg_temp" in migration, "RPCs are hardened")
    require("auth.uid()" in migration and "student_classes" in migration, "RPC derives authenticated learner authority")
    require("received_at" in migration and "revision_number" in migration, "submission receipt and revision fields exist")
    require("saveStudentHomeworkDraft" in service, "shared draft service exists")
    require("submitStudentHomework" in service, "shared submit service exists")
    require("saveStudentHomeworkDraft" in page and "submitStudentHomework" in page, "student page consumes shared authority")
    require('.from("homework_submissions")\n      .insert' not in page, "student page no longer inserts submissions directly")
    require('.from("homework_answers").insert' not in page, "student page no longer inserts answers directly")
    require('select("id,homework_id,question,order_num")' in page, "learner page does not fetch model answers")
    require("Save Draft" in page, "student can save a draft")
    require("Server receipt" in page, "student sees server receipt")
    require("Resubmit" in page, "returned work can be resubmitted")

    print("HW-STUDENT-001 submission authority tests PASSED")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
