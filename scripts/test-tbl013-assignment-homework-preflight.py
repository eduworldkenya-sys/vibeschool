#!/usr/bin/env python3
import csv
import importlib.util
import tempfile
from pathlib import Path

source = Path(__file__).with_name("tbl013-assert-assignment-homework-preflight.py")
spec = importlib.util.spec_from_file_location("assignment_homework_gate", source)
assert spec and spec.loader
gate = importlib.util.module_from_spec(spec)
spec.loader.exec_module(gate)

def run():
    sql = Path("scripts/sql/tbl013_assignment_homework_preflight.sql").read_text().lower()
    for marker in (*gate.FIELDS, "group by school_id,teacher_id,class_id,subject_id",
                   "count(distinct o.id)", "o.occurrence_date=lp.taught_date",
                   "o.school_id=lp.school_id", "o.teacher_id=lp.teacher_id",
                   "o.class_id=lp.class_id", "o.subject_id=lp.subject_id"):
        assert marker in sql, marker
    with tempfile.TemporaryDirectory() as temp:
        file = Path(temp) / "result.csv"
        def write(rows, fields=gate.FIELDS):
            with file.open("w", newline="") as handle:
                writer = csv.writer(handle)
                writer.writerow(fields)
                writer.writerows(rows)
        write([[0, 0, 0, 3]])
        result = gate.assess(file)
        assert result["passed"] and not result["applies_migrations"]
        assert result["counts"]["exact_homework_backfill_rows"] == 3
        for rows in ([[1,0,0,3]], [[0,1,0,3]], [[0,0,1,3]]):
            write(rows)
            assert not gate.assess(file)["passed"]
        for rows in ([], [[0,0,0,-1]], [[0,0,0,"?"]], [[0,0,0,0],[0,0,0,0]], [[0,0,0,0,0]]):
            write(rows)
            try:
                gate.assess(file)
            except ValueError:
                pass
            else:
                raise AssertionError(f"malformed evidence accepted: {rows}")
    print("Assignment/homework preflight contract PASS")

if __name__ == "__main__":
    run()
