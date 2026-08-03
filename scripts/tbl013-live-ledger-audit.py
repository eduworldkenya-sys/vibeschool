#!/usr/bin/env python3
"""
TBL-013 live migration-ledger reconciliation audit.

Compares repository migration filenames with output captured from:

    supabase migration list --linked

This script is read-only. It never connects to Supabase and never executes a
migration repair.
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from collections import defaultdict
from pathlib import Path
from typing import Any

MIGRATION_FILE_RE = re.compile(
    r"^(?P<version>\d{8,14})_(?P<name>.+)\.sql$"
)

# Supabase CLI list output commonly contains rows such as:
#
#  Local          | Remote         | Time (UTC)
# ----------------|----------------|---------------------
#  20260720123500 |                | ...
#                 | 20260720142114 | ...
#  20260720200607 | 20260720200607 | ...
#
# Some CLI versions include the migration name after the version. The parser
# intentionally relies only on version columns.
LEDGER_ROW_RE = re.compile(
    r"^\s*(?P<local>\d{8,14})?\s*\|\s*"
    r"(?P<remote>\d{8,14})?\s*\|"
)

EXPECTED_PROJECT_REF = "yauqsxggtuxuykcbrtzf"


class AuditFailure(Exception):
    pass


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()

    parser.add_argument(
        "--migrations-dir",
        default="supabase/migrations",
    )

    parser.add_argument(
        "--ledger",
        required=True,
        help="Captured output from supabase migration list --linked",
    )

    parser.add_argument(
        "--report",
        required=True,
        help="JSON audit report",
    )

    parser.add_argument(
        "--plan",
        required=True,
        help="Human-readable reconciliation plan",
    )

    parser.add_argument(
        "--project-ref",
        required=True,
    )

    return parser.parse_args()


def load_local_migrations(
    migrations_dir: Path,
) -> tuple[
    list[dict[str, str]],
    dict[str, list[dict[str, str]]],
]:
    if not migrations_dir.is_dir():
        raise AuditFailure(
            f"migration directory missing: {migrations_dir}"
        )

    migrations: list[dict[str, str]] = []
    by_version: dict[str, list[dict[str, str]]] = defaultdict(list)

    for path in sorted(migrations_dir.glob("*.sql")):
        match = MIGRATION_FILE_RE.fullmatch(path.name)

        if match is None:
            raise AuditFailure(
                f"migration filename has invalid format: {path.name}"
            )

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


def parse_live_ledger(path: Path) -> dict[str, dict[str, Any]]:
    if not path.is_file():
        raise AuditFailure(
            f"live ledger capture missing: {path}"
        )

    text = path.read_text(
        encoding="utf-8",
        errors="replace",
    )

    if not text.strip():
        raise AuditFailure("live ledger capture is empty")

    remote_versions: dict[str, dict[str, Any]] = {}

    matched_rows = 0

    for line_number, line in enumerate(
        text.splitlines(),
        start=1,
    ):
        match = LEDGER_ROW_RE.match(line)

        if match is None:
            continue

        local = match.group("local")
        remote = match.group("remote")

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
        raise AuditFailure(
            "no migration ledger rows could be parsed"
        )

    if not remote_versions:
        raise AuditFailure(
            "no remote migration versions were found"
        )

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
        {
            "version": version,
            "files": [
                entry["file"]
                for entry in entries
            ],
        }
        for version, entries in sorted(
            local_by_version.items()
        )
        if len(entries) > 1
    ]

    duplicate_remote_versions = [
        {
            "version": version,
            "occurrences": entry["occurrences"],
            "line_numbers": entry["line_numbers"],
        }
        for version, entry in sorted(
            remote_by_version.items()
        )
        if entry["occurrences"] > 1
    ]

    local_only = [
        {
            "version": version,
            "files": [
                entry["file"]
                for entry in local_by_version[version]
            ],
            "recommended_action": "REVIEW_FOR_APPLIED_REPAIR",
        }
        for version in sorted(
            local_versions - remote_versions
        )
    ]

    remote_only = [
        {
            "version": version,
            "occurrences": remote_by_version[version][
                "occurrences"
            ],
            "recommended_action": (
                "REVIEW_FOR_REVERTED_REPAIR_OR_BASELINE"
            ),
        }
        for version in sorted(
            remote_versions - local_versions
        )
    ]

    parity_versions = sorted(
        local_versions & remote_versions
    )

    repair_candidates: list[dict[str, Any]] = []

    for entry in local_only:
        repair_candidates.append(
            {
                "version": entry["version"],
                "proposed_status": "applied",
                "reason": (
                    "Repository migration exists but production "
                    "ledger has no matching version."
                ),
                "approval_status": "AWAITING_CLASSIFICATION",
            }
        )

    for entry in remote_only:
        repair_candidates.append(
            {
                "version": entry["version"],
                "proposed_status": "reverted",
                "reason": (
                    "Production ledger version has no matching "
                    "repository migration."
                ),
                "approval_status": "AWAITING_CLASSIFICATION",
            }
        )

    blocking_conditions: list[str] = []

    if duplicate_local_versions:
        blocking_conditions.append(
            "DUPLICATE_LOCAL_VERSIONS"
        )

    if duplicate_remote_versions:
        blocking_conditions.append(
            "DUPLICATE_REMOTE_VERSIONS"
        )

    if local_only:
        blocking_conditions.append(
            "LOCAL_ONLY_VERSIONS_REQUIRE_CLASSIFICATION"
        )

    if remote_only:
        blocking_conditions.append(
            "REMOTE_ONLY_VERSIONS_REQUIRE_CLASSIFICATION"
        )

    return {
        "schema_version": 1,
        "fix_id": "TBL-013",
        "project_ref": project_ref,
        "environment": "PRODUCTION",
        "read_only_audit": True,
        "counts": {
            "local_files": len(local_migrations),
            "local_distinct_versions": len(local_versions),
            "remote_distinct_versions": len(remote_versions),
            "parity_versions": len(parity_versions),
            "local_only_versions": len(local_only),
            "remote_only_versions": len(remote_only),
            "duplicate_local_versions": len(
                duplicate_local_versions
            ),
            "duplicate_remote_versions": len(
                duplicate_remote_versions
            ),
            "repair_candidates": len(repair_candidates),
        },
        "parity_versions": parity_versions,
        "local_only": local_only,
        "remote_only": remote_only,
        "duplicate_local_versions": duplicate_local_versions,
        "duplicate_remote_versions": duplicate_remote_versions,
        "repair_candidates": repair_candidates,
        "blocking_conditions": blocking_conditions,
        "reconciliation_status": (
            "RECONCILED"
            if not blocking_conditions
            else "REQUIRES_CLASSIFICATION"
        ),
    }


def write_plan(
    path: Path,
    report: dict[str, Any],
) -> None:
    counts = report["counts"]

    lines = [
        "# TBL-013 Live Migration History Audit",
        "",
        "## Environment",
        "",
        f"- Project: `{report['project_ref']}`",
        "- Classification: `PRODUCTION`",
        "- Audit mode: read-only",
        "",
        "## Counts",
        "",
        f"- Repository migration files: {counts['local_files']}",
        (
            "- Repository distinct versions: "
            f"{counts['local_distinct_versions']}"
        ),
        (
            "- Production distinct ledger versions: "
            f"{counts['remote_distinct_versions']}"
        ),
        f"- Matching versions: {counts['parity_versions']}",
        f"- Repository-only versions: {counts['local_only_versions']}",
        f"- Production-only versions: {counts['remote_only_versions']}",
        (
            "- Duplicate repository versions: "
            f"{counts['duplicate_local_versions']}"
        ),
        (
            "- Duplicate production versions: "
            f"{counts['duplicate_remote_versions']}"
        ),
        "",
        "## Repository-only versions",
        "",
    ]

    if report["local_only"]:
        for entry in report["local_only"]:
            lines.append(
                f"- `{entry['version']}` — "
                + ", ".join(entry["files"])
            )
    else:
        lines.append("- None")

    lines.extend(
        [
            "",
            "## Production-only versions",
            "",
        ]
    )

    if report["remote_only"]:
        for entry in report["remote_only"]:
            lines.append(
                f"- `{entry['version']}` "
                f"(occurrences: {entry['occurrences']})"
            )
    else:
        lines.append("- None")

    lines.extend(
        [
            "",
            "## Duplicate repository versions",
            "",
        ]
    )

    if report["duplicate_local_versions"]:
        for entry in report["duplicate_local_versions"]:
            lines.append(
                f"- `{entry['version']}` — "
                + ", ".join(entry["files"])
            )
    else:
        lines.append("- None")

    lines.extend(
        [
            "",
            "## Duplicate production versions",
            "",
        ]
    )

    if report["duplicate_remote_versions"]:
        for entry in report["duplicate_remote_versions"]:
            lines.append(
                f"- `{entry['version']}` — "
                f"{entry['occurrences']} occurrences"
            )
    else:
        lines.append("- None")

    lines.extend(
        [
            "",
            "## Safety result",
            "",
            (
                f"Status: "
                f"`{report['reconciliation_status']}`"
            ),
            "",
            "No production migration repair was executed.",
            "",
        ]
    )

    path.parent.mkdir(
        parents=True,
        exist_ok=True,
    )
    path.write_text(
        "\n".join(lines),
        encoding="utf-8",
    )


def main() -> int:
    args = parse_args()

    try:
        if args.project_ref != EXPECTED_PROJECT_REF:
            raise AuditFailure(
                "wrong Supabase project; expected "
                f"{EXPECTED_PROJECT_REF}"
            )

        local_migrations, local_by_version = (
            load_local_migrations(
                Path(args.migrations_dir)
            )
        )

        remote_by_version = parse_live_ledger(
            Path(args.ledger)
        )

        report = build_report(
            local_migrations,
            local_by_version,
            remote_by_version,
            args.project_ref,
        )

        report_path = Path(args.report)
        report_path.parent.mkdir(
            parents=True,
            exist_ok=True,
        )

        report_path.write_text(
            json.dumps(report, indent=2) + "\n",
            encoding="utf-8",
        )

        write_plan(
            Path(args.plan),
            report,
        )

        print("TBL-013 LIVE LEDGER AUDIT COMPLETE")

        for key, value in report["counts"].items():
            print(f"{key}: {value}")

        print(
            "reconciliation_status:",
            report["reconciliation_status"],
        )
        print("report:", report_path)
        print("plan:", args.plan)

        # Drift is not a script failure. The audit ran successfully and
        # produced a plan. Only malformed inputs should fail execution.
        return 0

    except AuditFailure as exc:
        print(
            "TBL-013 LIVE LEDGER AUDIT FAILED",
            file=sys.stderr,
        )
        print(str(exc), file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
