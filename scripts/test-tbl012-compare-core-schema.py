#!/usr/bin/env python3

from __future__ import annotations

import json
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
COMPARATOR = ROOT / "scripts/tbl012-compare-core-schema.py"

TABLES = (
    "timetable_slots",
    "teacher_classes",
    "teaching_occurrences",
    "school_periods",
)


def snapshot() -> dict:
    return {
        "schema_version": 1,
        "tables": {
            table: {
                "table": {
                    "rls_enabled": True,
                    "force_rls": False,
                },
                "columns": [
                    {
                        "name": "id",
                        "position": 1,
                        "data_type": "uuid",
                    }
                ],
                "constraints": [
                    {
                        "name": f"{table}_pkey",
                        "definition": "PRIMARY KEY (id)",
                    }
                ],
                "indexes": [
                    {
                        "name": f"{table}_pkey",
                        "definition": (
                            f"CREATE UNIQUE INDEX {table}_pkey "
                            f"ON public.{table} USING btree (id)"
                        ),
                    }
                ],
                "triggers": [],
                "policies": [],
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
    base = snapshot()

    result, report = run(base, base)

    if result.returncode != 0 or not report or not report["passed"]:
        raise AssertionError(result.stdout + result.stderr)

    print("PASS: identical schemas")

    rebuilt = snapshot()
    target = snapshot()

    rebuilt["tables"]["teacher_classes"]["policies"].append(
        {
            "name": "teacher_classes_admin_insert",
            "command": "INSERT",
        }
    )

    target["tables"]["teacher_classes"]["policies"].append(
        {
            "name": "pol_teacher_classes_insert",
            "command": "INSERT",
        }
    )

    result, report = run(rebuilt, target)

    if result.returncode != 0:
        raise AssertionError(result.stdout + result.stderr)

    if report["unexplained_differences"] != 0:
        raise AssertionError("expected policy convergence was unexplained")

    print("PASS: TBL-010 policy convergence explained")

    rebuilt = snapshot()
    target = snapshot()

    rebuilt["tables"]["timetable_slots"]["columns"].append(
        {
            "name": "unexpected_column",
            "position": 2,
            "data_type": "text",
        }
    )

    result, report = run(rebuilt, target)

    if result.returncode == 0:
        raise AssertionError("unexpected structural drift passed")

    if not report or report["unexplained_differences"] != 1:
        raise AssertionError("structural drift count incorrect")

    print("PASS: unexplained structural drift denied")
    print("TBL-012 schema comparison tests PASSED")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
