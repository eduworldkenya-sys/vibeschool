#!/usr/bin/env python3
"""TBL-012 read-only observed-production schema gate.

Historic pinned production fingerprint != current live schema. This script
preserves both identities, checks *all* current live hashes and explicitly
classifies exactly seven known differences. It is NOT a migration approval
and must never be treated as production parity with a clean rebuild.
"""
from __future__ import annotations

import argparse
import csv
import json
import re
import sys
from pathlib import Path

CORE_TABLES = frozenset(
    ("school_periods", "teacher_classes", "teaching_occurrences", "timetable_slots")
)
HASH_KEYS = frozenset(
    ("table_hash", "columns_hash", "constraints_hash", "indexes_hash", "triggers_hash")
)
ALREADY_APPLIED_UNSCHEDULED = frozenset(
    (
        ("teaching_occurrences", "columns_hash"),
        ("teaching_occurrences", "constraints_hash"),
        ("teaching_occurrences", "indexes_hash"),
    )
)
EXISTING_STRUCTURE_DIFFERENCES = frozenset(
    (
        ("teacher_classes", "indexes_hash"),
        ("timetable_slots", "triggers_hash"),
        ("timetable_slots", "constraints_hash"),
        ("teaching_occurrences", "triggers_hash"),
    )
)
REVIEWED_DIFFERENCES = ALREADY_APPLIED_UNSCHEDULED | EXISTING_STRUCTURE_DIFFERENCES


class PreflightError(ValueError):
    pass


def validate(raw: object, source: str) -> dict:
    if not isinstance(raw, dict) or raw.get("schema_version") != 1:
        raise PreflightError(f"invalid v1 schema snapshot: {source}")
    tables = raw.get("tables")
    if not isinstance(tables, dict) or set(tables) != CORE_TABLES:
        raise PreflightError(f"wrong core table set: {source}")
    for table, data in tables.items():
        if not isinstance(data, dict) or set(data) != HASH_KEYS:
            raise PreflightError(f"missing or unexpected hash fields: {table} {source}")
        if not all(isinstance(v, str) and re.fullmatch(r"[a-f0-9]{32}", v) for v in data.values()):
            raise PreflightError(f"invalid schema hash: {table} {source}")
    return raw


def csv_snapshot(path: Path) -> dict:
    with path.open(newline="", encoding="utf-8") as f:
        rows = list(csv.DictReader(f))
    if len(rows) != 1 or set(rows[0]) != {"jsonb_pretty"}:
        raise PreflightError("Supabase live query must produce one jsonb_pretty CSV row")
    try:
        return validate(json.loads(rows[0]["jsonb_pretty"]), str(path))
    except (TypeError, json.JSONDecodeError) as exc:
        raise PreflightError("live schema query returned invalid JSON") from exc


def assess(observed: dict, pinned: dict, live: dict) -> dict:
    observed = validate(observed, "reviewed live observation")
    pinned = validate(pinned, "historic repository reference")
    live = validate(live, "fresh live query")

    baseline_differences = []
    unexpected_baseline = []
    observation_differences = []

    for table in sorted(CORE_TABLES):
        for key in sorted(HASH_KEYS):
            before = pinned["tables"][table][key]
            expected = observed["tables"][table][key]
            current = live["tables"][table][key]
            identity = (table, key)
            if before != expected:
                category = (
                    "EXACT_ALREADY_APPLIED_UNSCHEDULED"
                    if identity in ALREADY_APPLIED_UNSCHEDULED
                    else "OBSERVED_EXISTING_STRUCTURE"
                    if identity in EXISTING_STRUCTURE_DIFFERENCES
                    else "UNRECOGNIZED_BASELINE_DIFFERENCE"
                )
                item = {
                    "table": table,
                    "section": key.removesuffix("_hash"),
                    "historic": before,
                    "observed": expected,
                    "classification": category,
                }
                baseline_differences.append(item)
                if identity not in REVIEWED_DIFFERENCES:
                    unexpected_baseline.append(item)
            if current != expected:
                observation_differences.append(
                    {"table": table, "section": key.removesuffix("_hash"),
                     "reviewed": expected, "current": current}
                )

    missing_classifications = sorted(
        f"{table}.{key.removesuffix('_hash')}"
        for table, key in REVIEWED_DIFFERENCES
        if pinned["tables"][table][key] == observed["tables"][table][key]
    )
    passed = (
        len(baseline_differences) == len(REVIEWED_DIFFERENCES)
        and not missing_classifications
        and not unexpected_baseline
        and not observation_differences
    )
    return {
        "schema_version": 1,
        "fix_id": "TBL-012",
        "mode": "READ_ONLY_LIVE_SCHEMA_PREFLIGHT",
        "passed": passed,
        "live_observation_matches_reviewed_hashes": not observation_differences,
        "historic_reference_is_production_parity": False,
        "production_migration_authorized": False,
        "school_schedule_verified": False,
        "schema_sections_checked": len(CORE_TABLES) * len(HASH_KEYS),
        "classified_historic_differences": baseline_differences,
        "missing_classifications": missing_classifications,
        "unrecognized_baseline_differences": unexpected_baseline,
        "fresh_live_differences": observation_differences,
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--observed", required=True)
    parser.add_argument("--pinned", required=True)
    parser.add_argument("--live-csv", required=True)
    parser.add_argument("--report", required=True)
    args = parser.parse_args()
    report_path = Path(args.report)
    report_path.parent.mkdir(parents=True, exist_ok=True)
    try:
        outcome = assess(
            json.loads(Path(args.observed).read_text(encoding="utf-8")),
            json.loads(Path(args.pinned).read_text(encoding="utf-8")),
            csv_snapshot(Path(args.live_csv)),
        )
        report_path.write_text(json.dumps(outcome, indent=2) + "\n", encoding="utf-8")
        print(
            "TBL-012 LIVE READ-ONLY OBSERVATION",
            "MATCH" if outcome["passed"] else "BLOCKED",
        )
        print("checked", outcome["schema_sections_checked"], "schema hash sections")
        print("reviewed historic differences", len(outcome["classified_historic_differences"]))
        print("fresh differences", len(outcome["fresh_live_differences"]))
        return 0 if outcome["passed"] else 1
    except (OSError, PreflightError, ValueError, json.JSONDecodeError) as exc:
        report_path.write_text(
            json.dumps({"schema_version": 1, "passed": False, "error": str(exc)}, indent=2)
            + "\n", encoding="utf-8",
        )
        print(f"TBL-012 LIVE SCHEMA PREFLIGHT BLOCKED: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
