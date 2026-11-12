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


# The only additional forward schema changes accepted for the pending school
# disruption migration. SHA-like fingerprints come from TBL-011 isolated rebuild
# run 43233363471, artifact 13951158098; never from guessed live DDL.
DISRUPTION_FORWARD_HASHES = {
    ("teaching_occurrences", "columns"): "7a7620c8a88a5b91052a63b9f3bb2bf3",
    ("teaching_occurrences", "constraints"): "d1e26c0cd4c8746e37298833034fcaa7",
    ("teaching_occurrences", "indexes"): "58a95a92d4ed6ce5d3d9950542194e02",
    ("teaching_occurrences", "triggers"): "f9d46b391fb98504786741e4fa53e161",
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
    parser.add_argument("--forward-deltas", default=None)
    parser.add_argument("--live-observation", default=None)
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

        # The checked-in production fingerprint is a claim, not live truth.
        # A promotion operator must supply a fresh read-only observation.
        live_verified = False
        if args.live_observation:
            live_path = Path(args.live_observation)
            live = validate_snapshot(load_json(live_path), live_path)
            baseline_drift = [
                {"table": table, "section": field.removesuffix("_hash"),
                 "recorded": target[table][field], "observed": live[table][field]}
                for table in sorted(EXPECTED_TABLES)
                for field in sorted(EXPECTED_FIELDS)
                if live[table][field] != target[table][field]
            ]
            if baseline_drift:
                report_path.parent.mkdir(parents=True, exist_ok=True)
                report_path.write_text(json.dumps({
                    "schema_version": 1,
                    "passed": False,
                    "production_reference_verified": False,
                    "error": "STALE_PRODUCTION_REFERENCE",
                    "baseline_differences": baseline_drift,
                }, indent=2) + "\n", encoding="utf-8")
                print("TBL-012 LIVE PRODUCTION REFERENCE MISMATCH", file=sys.stderr)
                for delta in baseline_drift:
                    print(f" - {delta['table']}.{delta['section']}", file=sys.stderr)
                return 1
            live_verified = True

        # A forward migration may intentionally change a production-owned
        # trigger. This is NOT production parity: require the immutable
        # old/new hashes, named migration and explicit acceptance in CI.
        permitted: dict[tuple[str,str], dict[str,str]] = {}
        if args.forward_deltas:
            meta = load_json(Path(args.forward_deltas))
            if meta.get("schema_version") != 1 or not isinstance(meta.get("deltas"), list):
                raise ComparisonFailure("invalid forward-delta declaration")
            for row in meta["deltas"]:
                if not isinstance(row, dict) or set(row) != {
                    "table", "section", "production_hash", "rebuilt_hash", "migration", "rationale"
                }:
                    raise ComparisonFailure("forward-delta metadata is incomplete")
                key = (row["table"], row["section"])
                # Only the specific audited pending migration structures may
                # differ. Their hashes must match the isolated local rebuild;
                # all other structures remain fail-closed.
                if key in permitted or key not in (
                    {("timetable_slots", "triggers")} | set(DISRUPTION_FORWARD_HASHES)
                ):
                    raise ComparisonFailure("unexpected or duplicated forward-delta scope")
                if key == ("timetable_slots", "triggers"):
                    school_period = Path("supabase/migrations/20261112101600_timetable_school_period_authority.sql")
                    if not school_period.is_file():
                        raise ComparisonFailure("school period migration is absent")
                    school_sql = school_period.read_text(encoding="utf-8").lower()
                    if any(requirement not in school_sql for requirement in (
                        "create trigger timetable_slot_period_guard",
                        "effective_from, effective_until",
                        "public.validate_timetable_slot_period()",
                    )):
                        raise ComparisonFailure("school period migration does not define reviewed guard")

                    if row["migration"] == "20261112101600_timetable_school_period_authority.sql":
                        if row["rebuilt_hash"] != "f5ad5e6b6f5dc8fac89fd5f8d20f39dd":
                            raise ComparisonFailure("period-guard forward fingerprint changed")
                    elif row["migration"] == "20261112150000_unified_school_tuition_schedule.sql":
                        tuition = Path("supabase/migrations") / row["migration"]
                        if not tuition.is_file():
                            raise ComparisonFailure("unified school/tuition migration is absent")
                        tuition_sql = tuition.read_text(encoding="utf-8").lower()
                        if (
                            row["rebuilt_hash"] != "a7ac9cc47ec44efe0eef1c1802559dac"
                            or any(requirement not in tuition_sql for requirement in (
                                "create trigger timetable_guard_tuition_schedule",
                                "on public.timetable_slots",
                                "public.timetable_school_tuition_overlap(new, l)",
                                "vibetutor_guard_cross_schedule",
                            ))
                        ):
                            raise ComparisonFailure("combined forward trigger fingerprint changed")
                    else:
                        raise ComparisonFailure("unreviewed forward timetable migration")
                else:
                    if row["migration"] != "20261112194500_school_disruption_occurrences_p0.sql":
                        raise ComparisonFailure("unreviewed disruption forward migration")
                    if row["rebuilt_hash"] != DISRUPTION_FORWARD_HASHES[key]:
                        raise ComparisonFailure("disruption forward fingerprint changed")
                    disruption = Path("supabase/migrations") / row["migration"]
                    if not disruption.is_file():
                        raise ComparisonFailure("disruption migration is absent")
                    disruption_sql = disruption.read_text(encoding="utf-8").lower()
                    required = (
                        "add column if not exists disruption_exception_id",
                        "add column if not exists disruption_previous_lifecycle",
                        "add column if not exists disruption_previous_reason",
                        "add constraint teaching_occurrences_disruption_previous_check",
                        "create index if not exists teaching_occurrences_disruption_exception_idx",
                        "create trigger guard_school_disruption_teaching",
                        "on public.teaching_occurrences",
                    )
                    if any(marker not in disruption_sql for marker in required):
                        raise ComparisonFailure("disruption migration evidence changed")
                permitted[key] = row

        # A single migration must not be represented by a selective subset
        # of its audited columns/constraints/indexes/triggers.
        disruption_keys = {
            key for key, row in permitted.items()
            if row["migration"] == "20261112194500_school_disruption_occurrences_p0.sql"
        }
        if disruption_keys and disruption_keys != set(DISRUPTION_FORWARD_HASHES):
            raise ComparisonFailure("incomplete disruption forward-delta declaration")

        differences: list[dict[str, str]] = []

        for table in sorted(EXPECTED_TABLES):
            for field in sorted(EXPECTED_FIELDS):
                rebuilt_value = rebuilt[table][field]
                target_value = target[table][field]

                if rebuilt_value != target_value:
                    key = (table, field.removesuffix("_hash"))
                    allowed = permitted.get(key)
                    classification = "UNEXPLAINED"
                    if allowed and (
                        allowed["production_hash"] == target_value
                        and allowed["rebuilt_hash"] == rebuilt_value
                    ):
                        classification = "EXPECTED_FORWARD_MIGRATION_UNDEPLOYED"
                    differences.append({
                        "table": table,
                        "section": key[1],
                        "rebuilt_hash": rebuilt_value,
                        "target_hash": target_value,
                        "classification": classification,
                    })

        expected_forward = [d for d in differences if d["classification"] == "EXPECTED_FORWARD_MIGRATION_UNDEPLOYED"]
        unexplained = [d for d in differences if d["classification"] == "UNEXPLAINED"]
        # Avoid retaining an obsolete production-delta exemption after the
        # authoritative production baseline itself has caught up.
        acknowledged_keys = {(d["table"], d["section"]) for d in expected_forward}
        stale_exemption = bool(set(permitted) - acknowledged_keys)
        if stale_exemption:
            raise ComparisonFailure("declared forward-delta exception is stale or changed")

        report = {
            "schema_version": 1,
            "scope": sorted(EXPECTED_TABLES),
            "policies_compared": False,
            "policy_status": (
                "Rebuilt policies are validated by TBL-010; "
                "production policy convergence is intentionally deferred."
            ),
            "structural_differences": len(differences),
            "unexplained_differences": len(unexplained),
            "expected_undeployed_forward_differences": len(expected_forward),
            "production_parity": live_verified and not differences,
            "production_reference_verified": live_verified,
            "release_requires_forward_migration": bool(expected_forward),
            "passed": not unexplained,
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

        if unexplained:
            print("TBL-012 STRUCTURAL COMPARISON FAILED")

            for difference in unexplained:
                print(
                    " -",
                    f"{difference['table']}."
                    f"{difference['section']}",
                )

            return 1

        print("TBL-012 STRUCTURAL COMPARISON PASSED")
        if expected_forward:
            print("EXPECTED FORWARD MIGRATION IS UNDEPLOYED: production parity is NOT certified")
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
