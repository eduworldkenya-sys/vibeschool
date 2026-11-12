#!/usr/bin/env python3
"""Fail closed on a fresh read-only tuition conflict count before TBL-013 dry-run.

This is evidence for a protected plan, NOT approval to apply a migration.
"""
from __future__ import annotations

import argparse
import csv
import json
import re
from pathlib import Path

EXPECTED = ("tuition_tuition_conflicts", "school_tuition_conflicts")


class CollisionPreflightError(ValueError):
    pass


def validate_csv(path: Path) -> dict:
    try:
        with path.open(newline="", encoding="utf-8-sig") as handle:
            reader = csv.DictReader(handle)
            if reader.fieldnames != list(EXPECTED):
                raise CollisionPreflightError("unexpected or missing preflight CSV columns")
            rows = list(reader)
    except (OSError, UnicodeError, csv.Error) as exc:
        raise CollisionPreflightError("missing or invalid preflight CSV") from exc
    if len(rows) != 1:
        raise CollisionPreflightError("expected exactly one aggregate preflight row")
    counts = {}
    for field in EXPECTED:
        raw = rows[0].get(field)
        if not isinstance(raw, str) or not re.fullmatch(r"[0-9]+", raw):
            raise CollisionPreflightError(f"invalid nonnegative integer for {field}")
        counts[field] = int(raw)
    return {
        "schema_version": 1,
        "mode": "READ_ONLY_TUITION_COLLISION_PREFLIGHT",
        "applies_migrations": False,
        "migration": "20261112150000_unified_school_tuition_schedule.sql",
        "counts": counts,
        "passed": all(value == 0 for value in counts.values()),
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--csv", required=True)
    parser.add_argument("--report", required=True)
    args = parser.parse_args()
    path = Path(args.report)
    path.parent.mkdir(parents=True, exist_ok=True)
    try:
        result = validate_csv(Path(args.csv))
    except CollisionPreflightError as exc:
        result = {
            "schema_version": 1,
            "mode": "READ_ONLY_TUITION_COLLISION_PREFLIGHT",
            "applies_migrations": False,
            "passed": False,
            "error": str(exc),
        }
    path.write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")
    print("TBL-013 tuition collision preflight", "PASS" if result["passed"] else "BLOCKED")
    return 0 if result["passed"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
