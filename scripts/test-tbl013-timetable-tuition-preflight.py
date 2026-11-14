#!/usr/bin/env python3
"""Contract: fail closed if pending tuition guards would encounter live clashes."""
from __future__ import annotations

import csv
import importlib.util
import tempfile
from pathlib import Path

source = Path(__file__).with_name("tbl013-assert-tuition-collision-preflight.py")
spec = importlib.util.spec_from_file_location("tuition_preflight", source)
assert spec and spec.loader
gate = importlib.util.module_from_spec(spec)
spec.loader.exec_module(gate)


def run() -> None:
    sql = Path("scripts/sql/tbl013_tuition_collision_preflight.sql").read_text(encoding="utf-8").lower()
    migration = Path("supabase/migrations/20261112150000_unified_school_tuition_schedule.sql").read_text(encoding="utf-8").lower()
    for token in (
        "from public.vibetutor_lessons", "from public.student_classes",
        "from public.school_calendar_exceptions", "pg_catalog.generate_series",
        "tuition_tuition_conflicts", "school_tuition_conflicts",
        "at time zone 'africa/nairobi'", "suppress_ordinary_teaching",
    ):
        assert token in sql, f"preflight SQL missing required guard: {token}"
    for token in ("vibetutor_tutor_no_overlap", "vibetutor_student_no_overlap",
                  "create trigger vibetutor_guard_cross_schedule",
                  "create trigger timetable_guard_tuition_schedule"):
        assert token in migration, f"required original SQL guard missing: {token}"

    with tempfile.TemporaryDirectory() as tmp:
        csv_file = Path(tmp) / "aggregate.csv"
        def write(rows, fields=gate.EXPECTED):
            with csv_file.open("w", encoding="utf-8", newline="") as handle:
                writer = csv.writer(handle)
                writer.writerow(fields)
                writer.writerows(rows)
        write([[0, 0]])
        ok = gate.validate_csv(csv_file)
        assert ok["passed"] and ok["counts"]["school_tuition_conflicts"] == 0
        assert not ok["applies_migrations"]

        for rows in ([[1, 0]], [[0, 1]], [[0, -1]], [["?", "0"]], [], [[0, 0], [0, 0]]):
            write(rows)
            try:
                decision = gate.validate_csv(csv_file)
            except gate.CollisionPreflightError:
                continue
            assert not decision["passed"], f"unapproved collision counts: {rows}"

        write([[0, 0]], ["unexpected", "header"])
        try:
            gate.validate_csv(csv_file)
        except gate.CollisionPreflightError:
            pass
        else:
            raise AssertionError("stale or changed SQL aggregate column names must fail closed")
    print("TBL-013 school/tuition collision preflight tests PASS")


if __name__ == "__main__":
    run()
