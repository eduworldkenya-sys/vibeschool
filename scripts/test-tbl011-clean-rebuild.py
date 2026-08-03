#!/usr/bin/env python3
"""Refusal and acceptance tests for the TBL-011 rebuild validator."""

from __future__ import annotations

import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
VALIDATOR = ROOT / "scripts/validate-tbl011-clean-rebuild.py"
WORKFLOW = ROOT / ".github/workflows/tbl011-clean-rebuild.yml"
VERIFY_SQL = ROOT / "scripts/sql/tbl011_clean_rebuild_verify.sql"


def run_validator(
    workflow_text: str,
    sql_text: str,
) -> subprocess.CompletedProcess[str]:
    with tempfile.TemporaryDirectory() as directory:
        root = Path(directory)
        workflow = root / "workflow.yml"
        verify_sql = root / "verify.sql"

        workflow.write_text(workflow_text, encoding="utf-8")
        verify_sql.write_text(sql_text, encoding="utf-8")

        return subprocess.run(
            [
                sys.executable,
                str(VALIDATOR),
                "--workflow",
                str(workflow),
                "--verify-sql",
                str(verify_sql),
            ],
            cwd=ROOT,
            text=True,
            capture_output=True,
        )


def require_pass(
    name: str,
    workflow_text: str,
    sql_text: str,
) -> None:
    result = run_validator(workflow_text, sql_text)

    if result.returncode != 0:
        raise AssertionError(
            f"{name}: expected pass\n"
            f"{result.stdout}{result.stderr}"
        )

    print(f"PASS: {name}")


def require_denied(
    name: str,
    workflow_text: str,
    sql_text: str,
    expected: str,
) -> None:
    result = run_validator(workflow_text, sql_text)
    combined = result.stdout + result.stderr

    if result.returncode == 0:
        raise AssertionError(
            f"{name}: validator unexpectedly passed"
        )

    if expected not in combined:
        raise AssertionError(
            f"{name}: expected {expected!r}\n{combined}"
        )

    print(f"PASS: {name}")


def replace_once(
    text: str,
    old: str,
    new: str,
    label: str,
) -> str:
    if text.count(old) != 1:
        raise AssertionError(
            f"{label}: expected one fixture anchor, "
            f"found {text.count(old)}"
        )

    return text.replace(old, new, 1)


def main() -> int:
    workflow = WORKFLOW.read_text(encoding="utf-8")
    sql = VERIFY_SQL.read_text(encoding="utf-8")

    require_pass(
        "authoritative workflow accepted",
        workflow,
        sql,
    )

    mutated = workflow.replace(
        "supabase start",
        "supabase link --project-ref dangerous && supabase start",
        1,
    )
    require_denied(
        "production link denied",
        mutated,
        sql,
        "forbidden production path present: supabase link",
    )

    mutated = replace_once(
        workflow,
        "supabase db reset --local --no-seed",
        "supabase db reset --linked --no-seed",
        "remote reset mutation",
    )
    require_denied(
        "linked reset denied",
        mutated,
        sql,
        "forbidden production path present: "
        "supabase db reset --linked",
    )

    mutated = replace_once(
        workflow,
        "supabase db reset --local --no-seed",
        "supabase db reset --no-seed",
        "missing local mutation",
    )
    require_denied(
        "reset without local flag denied",
        mutated,
        sql,
        "db reset command is not explicitly local",
    )

    mutated = workflow.replace(
        "permissions:\n  contents: read",
        "permissions:\n  contents: write",
        1,
    )
    require_denied(
        "write repository permission denied",
        mutated,
        sql,
        "workflow missing read-only permissions",
    )

    mutated = replace_once(
        workflow,
        "supabase stop --no-backup",
        "echo cleanup-disabled",
        "cleanup mutation",
    )
    require_denied(
        "missing local cleanup denied",
        mutated,
        sql,
        "workflow missing local cleanup",
    )

    mutated = workflow.replace(
        "      - name: Verify final timetable schema and RLS",
        "      - name: Skip final timetable schema and RLS",
        1,
    ).replace(
        "            -f scripts/sql/tbl011_clean_rebuild_verify.sql",
        "            -c 'select 1'",
        1,
    )
    require_denied(
        "missing final verifier denied",
        mutated,
        sql,
        "workflow missing verification SQL",
    )

    mutated = workflow.replace(
        "    timeout-minutes: 45",
        "    timeout-minutes: 45\n"
        "    env:\n"
        "      SUPABASE_ACCESS_TOKEN: secret",
        1,
    )
    require_denied(
        "production access token denied",
        mutated,
        sql,
        "forbidden production path present: "
        "SUPABASE_ACCESS_TOKEN",
    )

    mutated_sql = replace_once(
        sql,
        "TBL-011 FINAL SCHEMA VERIFICATION PASSED",
        "verification marker removed",
        "SQL marker mutation",
    )
    require_denied(
        "missing SQL success marker denied",
        workflow,
        mutated_sql,
        "verification SQL missing: "
        "TBL-011 FINAL SCHEMA VERIFICATION PASSED",
    )

    mutated_sql = sql.replace(
        "\\set ON_ERROR_STOP on",
        "",
        1,
    )
    require_denied(
        "SQL without immediate failure denied",
        workflow,
        mutated_sql,
        "verification SQL does not fail immediately",
    )

    print("TBL-011 clean-rebuild refusal tests PASSED")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
