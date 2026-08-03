#!/usr/bin/env python3
"""Static safety validator for the TBL-011 isolated rebuild workflow."""

from pathlib import Path
import argparse
import re

ROOT = Path(__file__).resolve().parents[1]


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--workflow",
        default=str(
            ROOT / ".github/workflows/tbl011-clean-rebuild.yml"
        ),
    )
    parser.add_argument(
        "--verify-sql",
        default=str(
            ROOT / "scripts/sql/tbl011_clean_rebuild_verify.sql"
        ),
    )
    return parser.parse_args()


ARGS = parse_args()
WORKFLOW = Path(ARGS.workflow)
VERIFY_SQL = Path(ARGS.verify_sql)

errors: list[str] = []

if not WORKFLOW.is_file():
    errors.append("workflow missing")

if not VERIFY_SQL.is_file():
    errors.append("verification SQL missing")

workflow = (
    WORKFLOW.read_text(encoding="utf-8")
    if WORKFLOW.is_file()
    else ""
)

sql = (
    VERIFY_SQL.read_text(encoding="utf-8")
    if VERIFY_SQL.is_file()
    else ""
)

required_workflow = {
    "manual trigger": "workflow_dispatch:",
    "pull-request trigger": "pull_request:",
    "read-only permissions": "contents: read",
    "Ubuntu runner": "runs-on: ubuntu-latest",
    "Supabase CLI": "supabase/setup-cli@v1",
    "Docker availability": "docker info",
    "local stack start": "supabase start",
    "local reset": "supabase db reset --local --no-seed",
    "verification SQL execution": (
        "-f scripts/sql/tbl011_clean_rebuild_verify.sql"
    ),
    "local database URL": "127.0.0.1:54322",
    "evidence upload": "actions/upload-artifact@v4",
    "always cleanup": "if: always()",
    "local cleanup": "supabase stop --no-backup",
}

for label, needle in required_workflow.items():
    if needle not in workflow:
        errors.append(f"workflow missing {label}: {needle}")

for forbidden in (
    "supabase link",
    "supabase db push",
    "supabase migration repair",
    "supabase db reset --linked",
    "supabase migration up --linked",
    "SUPABASE_ACCESS_TOKEN",
    "SUPABASE_DB_PASSWORD",
    "SUPABASE_PROJECT_ID",
    "environment: production",
    "environment: production-migration-repair",
):
    if forbidden.lower() in workflow.lower():
        errors.append(f"forbidden production path present: {forbidden}")

reset_commands = re.findall(
    r"supabase\s+db\s+reset[^\n]*",
    workflow,
    flags=re.IGNORECASE,
)

if len(reset_commands) != 1:
    errors.append(
        "expected exactly one db reset command; "
        f"found {len(reset_commands)}"
    )
elif "--local" not in reset_commands[0]:
    errors.append("db reset command is not explicitly local")

required_sql = (
    "timetable_slots",
    "teacher_classes",
    "teaching_occurrences",
    "school_periods",
    "teachers_manage_own_slots",
    "timetable_slots_student_read",
    "teacher_classes_admin_insert",
    "teaching_occurrences_no_delete",
    "TBL-011 FINAL SCHEMA VERIFICATION PASSED",
)

for needle in required_sql:
    if needle not in sql:
        errors.append(f"verification SQL missing: {needle}")

if "\\set ON_ERROR_STOP on" not in sql:
    errors.append("verification SQL does not fail immediately")

if errors:
    print("TBL-011 clean-rebuild validation FAILED:")
    for error in errors:
        print("  -", error)
    raise SystemExit(1)

print("TBL-011 clean-rebuild static validation PASSED")
