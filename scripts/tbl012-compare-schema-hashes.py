#!/usr/bin/env python3
"""Compare isolated rebuilt timetable structure with production fingerprints."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any

EXPECTED_TABLES = {
    "school_periods",
    "teacher_classes",
    "timetable_slots",
    "teaching_occurrences",
}

EXPECTED_FIELDS = {
    "table_hash",
    "columns_hash",
    "constraints_hash",
    "indexes_hash",
    "triggers_hash",
}


class ComparisonFailure(Exception):
    pass


def load_json(path: Path) -> dict[str, Any]:
    if not path.is_file():
        raise ComparisonFailure(f"missing JSON file: {path}")

    try:
        value = json.loads(path.read_text(encoding="utf-8"))
    except Exception as exc:
        raise ComparisonFailure(
            f"invalid JSON in {path}: {exc}"
        ) from exc

    if not isinstance(value, dict):
        raise ComparisonFailure(
            f"JSON root must be an object: {path}"
        )

    return value


def validate_snapshot(
    data: dict[str, Any],
    path: Path,
) -> dict[str, dict[str, str]]:
    if data.get("schema_version") != 1:
        raise ComparisonFailure(
            f"wrong schema_version in {path}"
        )

    tables = data.get("tables")

    if not isinstance(tables, dict):
        raise ComparisonFailure(
            f"tables object missing in {path}"
        )

    if set(tables) != EXPECTED_TABLES:
        raise ComparisonFailure(
            f"wrong table set in {path}: {sorted(tables)}"
        )

    for table, hashes in tables.items():
        if not isinstance(hashes, dict):
            raise ComparisonFailure(
                f"{table} hashes must be an object"
            )

        if set(hashes) != EXPECTED_FIELDS:
            raise ComparisonFailure(
                f"{table} has wrong hash fields: "
                f"{sorted(hashes)}"
            )

        for field, value in hashes.items():
            if (
                not isinstance(value, str)
                or len(value) != 32
                or any(
                    character not in "0123456789abcdef"
                    for character in value
                )
            ):
                raise ComparisonFailure(
                    f"{table}.{field} is not a lowercase MD5"
                )

    return tables


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--rebuilt", required=True)
    parser.add_argument("--target", required=True)
    parser.add_argument("--report", required=True)
    args = parser.parse_args()

    report_path = Path(args.report)

    try:
        rebuilt_path = Path(args.rebuilt)
        target_path = Path(args.target)

        rebuilt = validate_snapshot(
            load_json(rebuilt_path),
            rebuilt_path,
        )
        target = validate_snapshot(
            load_json(target_path),
            target_path,
        )

        differences: list[dict[str, str]] = []

        for table in sorted(EXPECTED_TABLES):
            for field in sorted(EXPECTED_FIELDS):
                rebuilt_value = rebuilt[table][field]
                target_value = target[table][field]

                if rebuilt_value != target_value:
                    differences.append(
                        {
                            "table": table,
                            "section": field.removesuffix("_hash"),
                            "rebuilt_hash": rebuilt_value,
                            "target_hash": target_value,
                            "classification": "UNEXPLAINED",
                        }
                    )

        report = {
            "schema_version": 1,
            "scope": sorted(EXPECTED_TABLES),
            "policies_compared": False,
            "policy_status": (
                "Rebuilt policies are validated by TBL-010; "
                "production policy convergence is intentionally deferred."
            ),
            "structural_differences": len(differences),
            "unexplained_differences": len(differences),
            "passed": not differences,
            "differences": differences,
        }

        report_path.parent.mkdir(
            parents=True,
            exist_ok=True,
        )
        report_path.write_text(
            json.dumps(report, indent=2) + "\n",
            encoding="utf-8",
        )

        if differences:
            print("TBL-012 STRUCTURAL COMPARISON FAILED")

            for difference in differences:
                print(
                    " -",
                    f"{difference['table']}."
                    f"{difference['section']}",
                )

            return 1

        print("TBL-012 STRUCTURAL COMPARISON PASSED")
        print("Compared tables:", len(EXPECTED_TABLES))
        print("Compared structural sections:", 20)
        print("Unexplained structural differences: 0")
        print("Report:", report_path)
        return 0

    except ComparisonFailure as exc:
        print(
            "TBL-012 STRUCTURAL COMPARISON FAILED",
            file=sys.stderr,
        )
        print(str(exc), file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
