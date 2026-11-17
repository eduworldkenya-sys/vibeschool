#!/usr/bin/env python3
"""Read-only TBL-013 evidence; never authorizes migration apply."""
import argparse
import csv
import json
import re
from pathlib import Path

FIELDS = ("duplicate_assignment_groups", "duplicate_dated_plan_groups",
          "ambiguous_homework_rows", "exact_homework_backfill_rows")

def assess(path):
    with Path(path).open(newline="", encoding="utf-8-sig") as stream:
        reader = csv.DictReader(stream)
        if reader.fieldnames != list(FIELDS):
            raise ValueError("aggregate columns do not match audited SQL")
        rows = list(reader)
    if len(rows) != 1 or set(rows[0]) != set(FIELDS):
        raise ValueError("expected exactly one aggregate row")
    counts = {}
    for field in FIELDS:
        raw = rows[0][field]
        if not isinstance(raw, str) or not re.fullmatch(r"[0-9]+", raw):
            raise ValueError(f"invalid count: {field}")
        counts[field] = int(raw)
    return {"schema_version": 1, "mode": "READ_ONLY_ASSIGNMENT_HOMEWORK_PREFLIGHT",
            "applies_migrations": False, "counts": counts,
            "passed": all(counts[field] == 0 for field in FIELDS[:3])}

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--csv", required=True)
    parser.add_argument("--report", required=True)
    args = parser.parse_args()
    try:
        result = assess(args.csv)
    except (ValueError, OSError, UnicodeError, csv.Error) as exc:
        result = {"schema_version": 1, "mode": "READ_ONLY_ASSIGNMENT_HOMEWORK_PREFLIGHT",
                  "applies_migrations": False, "passed": False, "error": str(exc)}
    report = Path(args.report)
    report.parent.mkdir(parents=True, exist_ok=True)
    report.write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")
    print("Assignment/homework preflight:", "PASS" if result["passed"] else "BLOCKED")
    return 0 if result["passed"] else 1

if __name__ == "__main__":
    raise SystemExit(main())
