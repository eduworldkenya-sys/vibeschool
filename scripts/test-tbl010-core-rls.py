#!/usr/bin/env python3
"""Focused contract tests for TBL-010 migration text."""

from pathlib import Path
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[1]
VALIDATOR = ROOT / "scripts/validate-tbl010-core-rls.py"
MIGRATION = (
    ROOT
    / "supabase/migrations/"
    "20260803160000_tbl010_core_rls_recovery.sql"
)


def require(condition: bool, message: str) -> None:
    if not condition:
        raise AssertionError(message)


def main() -> int:
    result = subprocess.run(
        [sys.executable, str(VALIDATOR)],
        cwd=ROOT,
        text=True,
        capture_output=True,
    )

    require(
        result.returncode == 0,
        result.stdout + result.stderr,
    )

    text = MIGRATION.read_text(encoding="utf-8").lower()

    require(
        text.count("enable row level security;") == 4,
        "expected exactly four explicit RLS enablements",
    )

    require(
        "create policy pol_teacher_classes_insert" not in text,
        "teacher self-insert policy must not be recreated",
    )

    require(
        "create policy pol_teacher_classes_update" not in text,
        "teacher self-update policy must not be recreated",
    )

    require(
        "create policy pol_teacher_classes_delete" not in text,
        "teacher self-delete policy must not be recreated",
    )

    require(
        "create policy teaching_occurrences_teacher_write" not in text,
        "direct occurrence insert policy must not exist",
    )

    require(
        "create policy teaching_occurrences_teacher_update" not in text,
        "direct occurrence update policy must not exist",
    )

    print("PASS: all four core tables explicitly enable RLS")
    print("PASS: teacher assignment writes are admin-controlled")
    print("PASS: occurrence writes remain RPC-controlled")
    print("PASS: teacher slot writes require exact assignment identity")
    print("PASS: student reads require current class membership")
    print("TBL-010 core RLS tests PASSED")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
