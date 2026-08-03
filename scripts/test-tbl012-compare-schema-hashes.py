#!/usr/bin/env python3

from __future__ import annotations

import copy
import json
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
COMPARATOR = ROOT / "scripts/tbl012-compare-schema-hashes.py"

TABLES = (
    "school_periods",
    "teacher_classes",
    "timetable_slots",
    "teaching_occurrences",
)

FIELDS = (
    "table_hash",
    "columns_hash",
    "constraints_hash",
    "indexes_hash",
    "triggers_hash",
)


def fixture() -> dict:
    return {
        "schema_version": 1,
        "tables": {
            table: {
                field: "0" * 32
                for field in FIELDS
            }
            for table in TABLES
        },
    }


def run(rebuilt: dict, target: dict):
    with tempfile.TemporaryDirectory() as directory:
        root = Path(directory)
        rebuilt_path = root / "rebuilt.json"
        target_path = root / "target.json"
        report_path = root / "report.json"

        rebuilt_path.write_text(
            json.dumps(rebuilt),
            encoding="utf-8",
        )
        target_path.write_text(
            json.dumps(target),
            encoding="utf-8",
        )

        result = subprocess.run(
            [
                sys.executable,
                str(COMPARATOR),
                "--rebuilt",
                str(rebuilt_path),
                "--target",
                str(target_path),
                "--report",
                str(report_path),
            ],
            cwd=ROOT,
            text=True,
            capture_output=True,
        )

        report = (
            json.loads(report_path.read_text(encoding="utf-8"))
            if report_path.exists()
            else None
        )

        return result, report


def main() -> int:
    base = fixture()

    result, report = run(base, base)

    if result.returncode != 0 or not report or not report["passed"]:
        raise AssertionError(result.stdout + result.stderr)

    print("PASS: identical structural hashes")

    changed = copy.deepcopy(base)
    changed["tables"]["timetable_slots"]["columns_hash"] = "1" * 32

    result, report = run(changed, base)

    if result.returncode == 0:
        raise AssertionError("structural drift unexpectedly passed")

    if not report or report["unexplained_differences"] != 1:
        raise AssertionError("wrong structural drift count")

    print("PASS: one structural mismatch denied")

    malformed = copy.deepcopy(base)
    malformed["tables"]["teacher_classes"]["indexes_hash"] = "bad"

    result, _ = run(malformed, base)

    if result.returncode == 0:
        raise AssertionError("malformed hash unexpectedly passed")

    print("PASS: malformed hash denied")
    print("TBL-012 structural hash tests PASSED")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
