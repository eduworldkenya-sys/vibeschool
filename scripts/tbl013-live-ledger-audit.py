#!/usr/bin/env python3
"""TBL-013 production migration-ledger reconciliation audit.

Compares repository migration filenames with output captured from:

    supabase migration list --linked

This tool is deliberately read-only. A one-sided ledger difference is evidence
of drift, not evidence that `supabase migration repair` is safe. In particular,
a production-only version may be legitimate historical/baseline/out-of-band
history and MUST NOT be inferred to be reverted from set membership alone.
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from collections import defaultdict
from pathlib import Path
from typing import Any

MIGRATION_FILE_RE = re.compile(r"^(?P<version>\d{8,14})_(?P<name>.+)\.sql$")
LEDGER_VERSION_RE = re.compile(r"^\d{8,14}$")
EXPECTED_PROJECT_REF = "yauqsxggtuxuykcbrtzf"


class AuditFailure(Exception):
    pass


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--migrations-dir", default="supabase/migrations")
    parser.add_argument(
        "--ledger",
        required=True,
        help="Captured output from supabase migration list --linked",
    )
    parser.add_argument("--report", required=True, help="JSON audit report")
    parser.add_argument("--plan", required=True, help="Human-readable reconciliation plan")
    parser.add_argument("--project-ref", required=True)
    return parser.parse_args()


def load_local_migrations(
    migrations_dir: Path,
) -> tuple[list[dict[str, str]], dict[str, list[dict[str, str]]]]:
    if not migrations_dir.is_dir():
        raise AuditFailure(f"migration directory missing: {migrations_dir}")

    migrations: list[dict[str, str]] = []
    by_version: dict[str, list[dict[str, str]]] = defaultdict(list)

    for path in sorted(migrations_dir.glob("*.sql")):
        match = MIGRATION_FILE_RE.fullmatch(path.name)
        if match is None:
            raise AuditFailure(f"migration filename has invalid format: {path.name}")

        entry = {
            "version": match.group("version"),
            "name": match.group("name"),
            "file": path.name,
        }
        migrations.append(entry)
        by_version[entry["version"]].append(entry)

    if not migrations:
        raise AuditFailure("no repository migrations found")
    return migrations, by_version


def normalize_ledger_field(raw: str) -> str | None:
    value = raw.strip()
    if value.startswith("`") and value.endswith("`") and len(value) >= 2:
        value = value[1:-1].strip()
    if not value:
        return None
    if LEDGER_VERSION_RE.fullmatch(value) is None:
        raise ValueError(value)
    return value


def parse_live_ledger(path: Path) -> dict[str, dict[str, Any]]:
    if not path.is_file():
        raise AuditFailure(f"live ledger capture missing: {path}")

    text = path.read_text(encoding="utf-8", errors="replace")
    if not text.strip():
        raise AuditFailure("live ledger capture is empty")

    remote_versions: dict[str, dict[str, Any]] = {}
    matched_rows = 0

    for line_number, line in enumerate(text.splitlines(), start=1):
        columns = line.split("|")
        if len(columns) < 3:
            continue

        try:
            local = normalize_ledger_field(columns[0])
            remote = normalize_ledger_field(columns[1])
        except ValueError:
            continue

        if local is None and remote is None:
            continue

        matched_rows += 1
        if remote is None:
            continue

        entry = remote_versions.setdefault(
            remote,
            {
                "version": remote,
                "occurrences": 0,
                "line_numbers": [],
                "raw_rows": [],
            },
        )
        entry["occurrences"] += 1
        entry["line_numbers"].append(line_number)
        entry["raw_rows"].append(line.strip())

    if matched_rows == 0:
        raise AuditFailure("no migration ledger rows could be parsed")
    if not remote_versions:
        raise AuditFailure("no remote migration versions were found")
    return remote_versions


def build_report(
    local_migrations: list[dict[str, str]],
    local_by_version: dict[str, list[dict[str, str]]],
    remote_by_version: dict[str, dict[str, Any]],
    project_ref: str,
) -> dict[str, Any]:
    local_versions = set(local_by_version)
    remote_versions = set(remote_by_version)

    duplicate_local_versions = [
        {"version": version, "files": [entry["file"] for entry in entries]}
        for version, entries in sorted(local_by_version.items())
        if len(entries) > 1
    ]
    duplicate_remote_versions = [
        {
            "version": version,
            "occurrences": entry["occurrences"],
            "line_numbers": entry["line_numbers"],
        }
        for version, entry in sorted(remote_by_version.items())
        if entry["occurrences"] > 1
    ]

    local_only = [
        {
            "version": version,
            "files": [entry["file"] for entry in local_by_version[version]],
            "classification": "REPOSITORY_ONLY_UNVERIFIED",
            "safe_next_action": "ESTABLISH_PROVENANCE_BEFORE_ANY_REPAIR",
            "repair_status": "NOT_AUTHORIZED",
        }
        for version in sorted(local_versions - remote_versions)
    ]
    remote_only = [
        {
            "version": version,
            "occurrences": remote_by_version[version]["occurrences"],
            "classification": "PRODUCTION_ONLY_BASELINE_OR_OUT_OF_BAND",
            "safe_next_action": "ESTABLISH_PROVENANCE_BEFORE_ANY_REPAIR",
            "repair_status": "NOT_AUTHORIZED",
        }
        for version in sorted(remote_versions - local_versions)
    ]

    parity_versions = sorted(local_versions & remote_versions)
    classification_required = [
        {
            "version": entry["version"],
            "classification": entry["classification"],
            "repair_status": "NOT_AUTHORIZED",
        }
        for entry in [*local_only, *remote_only]
    ]

    blocking_conditions: list[str] = []
    if duplicate_local_versions:
        blocking_conditions.append("DUPLICATE_LOCAL_VERSIONS")
    if duplicate_remote_versions:
        blocking_conditions.append("DUPLICATE_REMOTE_VERSIONS")
    if local_only:
        blocking_conditions.append("REPOSITORY_ONLY_VERSIONS_REQUIRE_PROVENANCE")
    if remote_only:
        blocking_conditions.append("PRODUCTION_ONLY_VERSIONS_REQUIRE_PROVENANCE")

    return {
        "schema_version": 2,
        "fix_id": "TBL-013",
        "project_ref": project_ref,
        "environment": "PRODUCTION",
        "read_only_audit": True,
        "repair_inference_from_set_difference": False,
        "counts": {
            "local_files": len(local_migrations),
            "local_distinct_versions": len(local_versions),
            "remote_distinct_versions": len(remote_versions),
            "parity_versions": len(parity_versions),
            "local_only_versions": len(local_only),
            "remote_only_versions": len(remote_only),
            "duplicate_local_versions": len(duplicate_local_versions),
            "duplicate_remote_versions": len(duplicate_remote_versions),
            "classification_required": len(classification_required),
            "authorized_repairs": 0,
        },
        "parity_versions": parity_versions,
        "local_only": local_only,
        "remote_only": remote_only,
        "duplicate_local_versions": duplicate_local_versions,
        "duplicate_remote_versions": duplicate_remote_versions,
        "classification_required": classification_required,
        "authorized_repairs": [],
        "blocking_conditions": blocking_conditions,
        "reconciliation_status": (
            "RECONCILED" if not blocking_conditions else "REQUIRES_PROVENANCE_CLASSIFICATION"
        ),
        "safety_rule": (
            "Never infer applied/reverted repair status solely from repository/production "
            "set difference. Establish migration provenance and mutation equivalence first."
        ),
    }


def write_plan(path: Path, report: dict[str, Any]) -> None:
    counts = report["counts"]
    lines = [
        "# TBL-013 Live Migration History Audit",
        "",
        "## Environment",
        "",
        f"- Project: `{report['project_ref']}`",
        "- Classification: `PRODUCTION`",
        "- Audit mode: read-only",
        "- Automatic migration repair: disabled",
        "",
        "## Counts",
        "",
        f"- Repository migration files: {counts['local_files']}",
        f"- Repository distinct versions: {counts['local_distinct_versions']}",
        f"- Production distinct ledger versions: {counts['remote_distinct_versions']}",
        f"- Matching versions: {counts['parity_versions']}",
        f"- Repository-only versions: {counts['local_only_versions']}",
        f"- Production-only versions: {counts['remote_only_versions']}",
        f"- Duplicate repository versions: {counts['duplicate_local_versions']}",
        f"- Duplicate production versions: {counts['duplicate_remote_versions']}",
        f"- Versions requiring provenance: {counts['classification_required']}",
        "- Authorized repairs: 0",
        "",
        "## Repository-only versions",
        "",
    ]

    if report["local_only"]:
        for entry in report["local_only"]:
            lines.append(
                f"- `{entry['version']}` — {', '.join(entry['files'])} — "
                "provenance required; no repair authorized"
            )
    else:
        lines.append("- None")

    lines.extend(["", "## Production-only versions", ""])
    if report["remote_only"]:
        for entry in report["remote_only"]:
            lines.append(
                f"- `{entry['version']}` (occurrences: {entry['occurrences']}) — "
                "baseline/out-of-band provenance required; no repair authorized"
            )
    else:
        lines.append("- None")

    lines.extend(["", "## Duplicate repository versions", ""])
    if report["duplicate_local_versions"]:
        for entry in report["duplicate_local_versions"]:
            lines.append(f"- `{entry['version']}` — {', '.join(entry['files'])}")
    else:
        lines.append("- None")

    lines.extend(["", "## Duplicate production versions", ""])
    if report["duplicate_remote_versions"]:
        for entry in report["duplicate_remote_versions"]:
            lines.append(f"- `{entry['version']}` — {entry['occurrences']} occurrences")
    else:
        lines.append("- None")

    lines.extend(
        [
            "",
            "## Safety result",
            "",
            f"Status: `{report['reconciliation_status']}`",
            "",
            "A ledger difference is not a repair instruction. Before any production repair, "
            "establish the provenance and mutation equivalence of every one-sided version.",
            "",
            "No production migration repair was executed or authorized by this audit.",
            "",
        ]
    )

    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text("\n".join(lines), encoding="utf-8")


def main() -> int:
    args = parse_args()
    try:
        if args.project_ref != EXPECTED_PROJECT_REF:
            raise AuditFailure(f"wrong Supabase project; expected {EXPECTED_PROJECT_REF}")

        local_migrations, local_by_version = load_local_migrations(Path(args.migrations_dir))
        remote_by_version = parse_live_ledger(Path(args.ledger))
        report = build_report(
            local_migrations,
            local_by_version,
            remote_by_version,
            args.project_ref,
        )

        report_path = Path(args.report)
        report_path.parent.mkdir(parents=True, exist_ok=True)
        report_path.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
        write_plan(Path(args.plan), report)

        print("TBL-013 LIVE LEDGER AUDIT COMPLETE")
        for key, value in report["counts"].items():
            print(f"{key}: {value}")
        print("reconciliation_status:", report["reconciliation_status"])
        print("report:", report_path)
        print("plan:", args.plan)
        return 0
    except AuditFailure as exc:
        print("TBL-013 LIVE LEDGER AUDIT FAILED", file=sys.stderr)
        print(str(exc), file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
