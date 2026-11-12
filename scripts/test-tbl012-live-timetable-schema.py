#!/usr/bin/env python3
"""Prove the live timetable fingerprint gate fails closed, without network access."""
from __future__ import annotations

import copy
import csv
import importlib.util
import json
import tempfile
from pathlib import Path

HERE = Path(__file__).parent
spec = importlib.util.spec_from_file_location(
    "tbl012_live_schema_preflight", HERE / "tbl012-audit-live-timetable-schema.py"
)
assert spec and spec.loader
gate = importlib.util.module_from_spec(spec)
spec.loader.exec_module(gate)

OBSERVED = Path("supabase/reconciliation/tbl012_live_observation_20261112.json")
PINNED = Path("supabase/reconciliation/tbl012_production_core_schema_hashes.json")


def main() -> None:
    observed = json.loads(OBSERVED.read_text(encoding="utf-8"))
    pinned = json.loads(PINNED.read_text(encoding="utf-8"))
    good = gate.assess(observed, pinned, copy.deepcopy(observed))
    assert good["passed"], good
    assert good["schema_sections_checked"] == 20
    assert len(good["classified_historic_differences"]) == 4
    assert good["already_applied_unscheduled_sections_checked"] == 3
    assert not good["already_applied_unscheduled_mismatches"]
    assert not good["historic_reference_is_production_parity"]
    assert not good["production_migration_authorized"]
    assert not good["school_schedule_verified"]

    stale = copy.deepcopy(observed)
    stale["tables"]["timetable_slots"]["triggers_hash"] = "0" * 32
    result = gate.assess(observed, pinned, stale)
    assert not result["passed"]
    assert result["fresh_live_differences"] == [{
        "table": "timetable_slots",
        "section": "triggers",
        "reviewed": observed["tables"]["timetable_slots"]["triggers_hash"],
        "current": "0" * 32,
    }]

    # A change in the historic baseline cannot be silently reclassified as
    # an acceptable observed structural difference.
    unexpected = copy.deepcopy(pinned)
    unexpected["tables"]["school_periods"]["columns_hash"] = "0" * 32
    result = gate.assess(observed, unexpected, copy.deepcopy(observed))
    assert not result["passed"]
    assert result["unrecognized_baseline_differences"]

    unscheduled = copy.deepcopy(pinned)
    unscheduled["tables"]["teaching_occurrences"]["columns_hash"] = "0" * 32
    result = gate.assess(observed, unscheduled, observed)
    assert not result["passed"]
    assert "teaching_occurrences.columns" in result["already_applied_unscheduled_mismatches"]

    missing = copy.deepcopy(pinned)
    missing["tables"]["teacher_classes"]["indexes_hash"] = observed["tables"]["teacher_classes"]["indexes_hash"]
    result = gate.assess(observed, missing, observed)
    assert not result["passed"]
    assert "teacher_classes.indexes" in result["missing_classifications"]

    with tempfile.TemporaryDirectory() as temp:
        path = Path(temp) / "observed.csv"
        with path.open("w", newline="", encoding="utf-8") as f:
            out = csv.DictWriter(f, fieldnames=["jsonb_pretty"])
            out.writeheader()
            out.writerow({"jsonb_pretty": json.dumps(observed, indent=2)})
        assert gate.csv_snapshot(path) == observed
        with path.open("w", newline="", encoding="utf-8") as f:
            f.write("jsonb_pretty\nnot-json\n")
        try:
            gate.csv_snapshot(path)
        except gate.PreflightError:
            pass
        else:
            raise AssertionError("malformed live SQL result must be blocked")

    print("TBL-012 exact live schema fingerprint preflight regression PASSED")


if __name__ == "__main__":
    main()
