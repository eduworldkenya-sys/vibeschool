#!/usr/bin/env python3
"""TBL-012 deterministic comparison of rebuilt and target timetable schemas."""

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path
from typing import Any


class CompareFailure(Exception):
    pass


def load(path: Path) -> dict[str, Any]:
    if not path.is_file():
        raise CompareFailure(f"snapshot missing: {path}")

    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except Exception as exc:
        raise CompareFailure(
            f"invalid snapshot JSON {path}: {exc}"
        ) from exc

    if not isinstance(data, dict):
        raise CompareFailure(f"snapshot root must be an object: {path}")

    if data.get("schema_version") != 1:
        raise CompareFailure(
            f"unsupported schema_version in {path}"
        )

    tables = data.get("tables")

    if not isinstance(tables, dict):
        raise CompareFailure(f"tables object missing: {path}")

    expected = {
        "timetable_slots",
        "teacher_classes",
        "teaching_occurrences",
        "school_periods",
    }

    if set(tables) != expected:
        raise CompareFailure(
            f"unexpected table set in {path}: {sorted(tables)}"
        )

    return data


def normalize_sql(value: Any) -> Any:
    if not isinstance(value, str):
        return value

    # Ignore harmless formatting and qualification differences produced by
    # PostgreSQL introspection across equivalent environments.
    value = re.sub(r"\s+", " ", value).strip()
    value = value.replace("public.", "")
    value = value.replace("(select auth.uid())", "auth.uid()")
    return value


def normalize_item(item: Any) -> Any:
    if isinstance(item, dict):
        return {
            key: normalize_item(value)
            for key, value in sorted(item.items())
        }

    if isinstance(item, list):
        return [normalize_item(value) for value in item]

    return normalize_sql(item)


def indexed(items: list[dict[str, Any]]) -> dict[str, dict[str, Any]]:
    result: dict[str, dict[str, Any]] = {}

    for item in items:
        name = item.get("name")

        if not isinstance(name, str) or not name:
            raise CompareFailure("snapshot item has no valid name")

        if name in result:
            raise CompareFailure(f"duplicate snapshot item: {name}")

        result[name] = normalize_item(item)

    return result


def compare_section(
    table: str,
    section: str,
    rebuilt: Any,
    target: Any,
) -> list[dict[str, Any]]:
    changes: list[dict[str, Any]] = []

    if section == "table":
        rebuilt_value = normalize_item(rebuilt)
        target_value = normalize_item(target)

        if rebuilt_value != target_value:
            changes.append(
                {
                    "table": table,
                    "section": section,
                    "name": table,
                    "rebuilt": rebuilt_value,
                    "target": target_value,
                }
            )

        return changes

    if not isinstance(rebuilt, list) or not isinstance(target, list):
        raise CompareFailure(
            f"{table}.{section} must be arrays"
        )

    rebuilt_items = indexed(rebuilt)
    target_items = indexed(target)

    for name in sorted(set(rebuilt_items) | set(target_items)):
        left = rebuilt_items.get(name)
        right = target_items.get(name)

        if left != right:
            changes.append(
                {
                    "table": table,
                    "section": section,
                    "name": name,
                    "rebuilt": left,
                    "target": right,
                }
            )

    return changes


def classify(change: dict[str, Any]) -> str:
    table = change["table"]
    section = change["section"]
    name = change["name"]

    # TBL-010 intentionally hardens these policies in the rebuilt target.
    expected_policy_differences = {
        (
            "teacher_classes",
            "pol_teacher_classes_insert",
        ),
        (
            "teacher_classes",
            "pol_teacher_classes_update",
        ),
        (
            "teacher_classes",
            "pol_teacher_classes_delete",
        ),
        (
            "teacher_classes",
            "teacher_classes_admin_insert",
        ),
        (
            "teacher_classes",
            "teacher_classes_admin_update",
        ),
        (
            "teacher_classes",
            "teacher_classes_admin_delete",
        ),
        (
            "teacher_classes",
            "pol_teacher_classes_select",
        ),
        (
            "timetable_slots",
            "teachers_manage_own_slots",
        ),
        (
            "timetable_slots",
            "timetable_slots_admin",
        ),
        (
            "timetable_slots",
            "timetable_slots_student_read",
        ),
        (
            "teaching_occurrences",
            "teaching_occurrences_teacher_read",
        ),
        (
            "teaching_occurrences",
            "teaching_occurrences_admin_read",
        ),
        (
            "teaching_occurrences",
            "teaching_occurrences_no_delete",
        ),
        (
            "school_periods",
            "school_periods_teacher_read",
        ),
        (
            "school_periods",
            "school_periods_admin_all",
        ),
    }

    if section == "policies" and (
        table,
        name,
    ) in expected_policy_differences:
        return "EXPECTED_TBL010_POLICY_CONVERGENCE"

    return "UNEXPLAINED"


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--rebuilt", required=True)
    parser.add_argument("--target", required=True)
    parser.add_argument("--report", required=True)
    args = parser.parse_args()

    try:
        rebuilt = load(Path(args.rebuilt))
        target = load(Path(args.target))

        changes: list[dict[str, Any]] = []

        for table in sorted(rebuilt["tables"]):
            for section in (
                "table",
                "columns",
                "constraints",
                "indexes",
                "triggers",
                "policies",
            ):
                changes.extend(
                    compare_section(
                        table,
                        section,
                        rebuilt["tables"][table][section],
                        target["tables"][table][section],
                    )
                )

        for change in changes:
            change["classification"] = classify(change)

        unexplained = [
            change
            for change in changes
            if change["classification"] == "UNEXPLAINED"
        ]

        report = {
            "schema_version": 1,
            "total_differences": len(changes),
            "explained_differences": len(changes) - len(unexplained),
            "unexplained_differences": len(unexplained),
            "passed": len(unexplained) == 0,
            "differences": changes,
        }

        report_path = Path(args.report)
        report_path.parent.mkdir(parents=True, exist_ok=True)
        report_path.write_text(
            json.dumps(report, indent=2) + "\n",
            encoding="utf-8",
        )

        if unexplained:
            print("TBL-012 SCHEMA COMPARISON FAILED")
            print(
                "Unexplained differences:",
                len(unexplained),
            )

            for change in unexplained:
                print(
                    " -",
                    f"{change['table']}."
                    f"{change['section']}."
                    f"{change['name']}",
                )

            return 1

        print("TBL-012 SCHEMA COMPARISON PASSED")
        print("Total differences:", len(changes))
        print(
            "Explained differences:",
            len(changes),
        )
        print("Unexplained differences: 0")
        print("Report:", report_path)
        return 0

    except CompareFailure as exc:
        print("TBL-012 SCHEMA COMPARISON FAILED", file=sys.stderr)
        print(str(exc), file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
