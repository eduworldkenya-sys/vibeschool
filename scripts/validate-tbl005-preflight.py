#!/usr/bin/env python3
"""Static validation for the TBL-005 timetable preflight SQL."""

from __future__ import annotations

from pathlib import Path
import sys


ROOT = Path(__file__).resolve().parents[1]
SQL_PATH = ROOT / "scripts" / "sql" / "tbl005_timetable_constraint_preflight.sql"

REQUIRED_MARKERS = (
    r"\set ON_ERROR_STOP on",
    "set transaction read only",
    "public.timetable_slots",
    "public.teacher_classes",
    "public.schools",
    "public.classes",
    "public.subjects",
    "public.profiles",
    "[TBL-019]",
    "[TBL-020]",
    "[TBL-021]",
    "[TBL-022]",
    "[TBL-023]",
    "[TBL-024]",
    "[TBL-026]",
    "[TBL-027]",
    "start_time >= end_time",
    "effective_until < effective_from",
    "day_of_week not between 1 and 7",
    "rollback;",
)

BANNED_MARKERS = (
    "insert into",
    "update public.",
    "delete from",
    "alter table",
    "create table",
    "drop table",
    "truncate",
    "grant ",
    "revoke ",
    "security definer",
)


def fail(message: str) -> None:
    print(f"TBL-005 VALIDATION FAILED: {message}", file=sys.stderr)
    raise SystemExit(1)


def main() -> None:
    if not SQL_PATH.is_file():
        fail(f"missing {SQL_PATH.relative_to(ROOT)}")

    sql = SQL_PATH.read_text(encoding="utf-8")
    lowered = sql.lower()

    for marker in REQUIRED_MARKERS:
        if marker.lower() not in lowered:
            fail(f"required marker missing: {marker}")

    for marker in BANNED_MARKERS:
        if marker in lowered:
            fail(f"write-capable or out-of-scope SQL found: {marker}")

    if lowered.count("begin;") != 1:
        fail("expected exactly one BEGIN")

    if lowered.count("rollback;") != 1:
        fail("expected exactly one ROLLBACK")

    if "commit;" in lowered:
        fail("preflight must never commit")

    print("TBL-005 static validation PASSED")
    print(f"Validated: {SQL_PATH.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
