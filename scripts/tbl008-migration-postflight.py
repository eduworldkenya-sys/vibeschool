#!/usr/bin/env python3
"""
TBL-008 migration-ledger postflight.

Compares captured `supabase migration list --linked` output before and after
one approved migration-history repair.

The comparator does not connect to Supabase and does not modify anything.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import sys
from pathlib import Path
from typing import Any

VERSION_RE = re.compile(r"^\d{8,14}$")
ROW_RE = re.compile(
    r"^\s*(?P<local>\d{8,14})?\s*\|\s*"
    r"(?P<remote>\d{8,14})?\s*\|\s*"
    r"(?P<time>.*?)\s*$"
)


class PostflightFailure(Exception):
    pass


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def parse_ledger(path: Path) -> dict[str, dict[str, Any]]:
    if not path.is_file():
        raise PostflightFailure(f"Ledger snapshot missing: {path}")

    rows: dict[str, dict[str, Any]] = {}

    for raw in path.read_text(encoding="utf-8", errors="replace").splitlines():
        line = raw.rstrip()

        if "|" not in line:
            continue

        match = ROW_RE.match(line)

        if not match:
            continue

        local = (match.group("local") or "").strip()
        remote = (match.group("remote") or "").strip()

        if not local and not remote:
            continue

        version = remote or local

        if not VERSION_RE.fullmatch(version):
            continue

        if version in rows:
            raise PostflightFailure(
                f"Duplicate migration version {version} in {path}"
            )

        rows[version] = {
            "local": bool(local),
            "remote": bool(remote),
            "local_version": local or None,
            "remote_version": remote or None,
            "time": match.group("time").strip(),
        }

    if not rows:
        raise PostflightFailure(
            f"No migration rows could be parsed from {path}"
        )

    return rows


def compare(
    before: dict[str, dict[str, Any]],
    after: dict[str, dict[str, Any]],
    version: str,
    expected_status: str,
) -> dict[str, Any]:
    versions = sorted(set(before) | set(after))
    changes = []

    for item in versions:
        old = before.get(item)
        new = after.get(item)

        if old != new:
            changes.append(
                {
                    "version": item,
                    "before": old,
                    "after": new,
                }
            )

    approved = next(
        (change for change in changes if change["version"] == version),
        None,
    )

    unexpected = [
        change for change in changes if change["version"] != version
    ]

    errors = []

    if unexpected:
        errors.append(
            "Unexpected migration versions changed: "
            + ", ".join(change["version"] for change in unexpected)
        )

    before_row = before.get(version)
    after_row = after.get(version)

    before_local = bool(before_row and before_row["local"])
    after_local = bool(after_row and after_row["local"])
    before_remote = bool(before_row and before_row["remote"])
    after_remote = bool(after_row and after_row["remote"])

    if before_local != after_local:
        errors.append(
            f"Approved version {version} changed local migration state "
            f"from {before_local} to {after_local}"
        )

    if expected_status == "applied":
        if not after_remote:
            errors.append(
                f"Approved version {version} is not remote-applied after repair"
            )

        if before_remote:
            errors.append(
                f"Approved version {version} was already remote-applied before repair"
            )

    elif expected_status == "reverted":
        if after_remote:
            errors.append(
                f"Approved version {version} remains remote-applied after repair"
            )

        if not before_remote:
            errors.append(
                f"Approved version {version} was not remote-applied before repair"
            )

    else:
        errors.append(f"Unsupported expected status: {expected_status}")

    if approved is None:
        errors.append(
            f"Approved version {version} did not change between snapshots"
        )

    return {
        "approved_version": version,
        "expected_status": expected_status,
        "before_local": before_local,
        "after_local": after_local,
        "before_remote": before_remote,
        "after_remote": after_remote,
        "changed_versions": [change["version"] for change in changes],
        "unexpected_changes": unexpected,
        "passed": not errors,
        "errors": errors,
    }


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()

    parser.add_argument("--before", required=True)
    parser.add_argument("--after", required=True)
    parser.add_argument("--version", required=True)
    parser.add_argument(
        "--status",
        required=True,
        choices=("applied", "reverted"),
    )
    parser.add_argument("--report", required=True)

    return parser.parse_args()


def main() -> int:
    args = parse_args()

    if not VERSION_RE.fullmatch(args.version):
        print("TBL-008 POSTFLIGHT FAILED", file=sys.stderr)
        print("Migration version must contain 8–14 digits", file=sys.stderr)
        return 1

    before_path = Path(args.before)
    after_path = Path(args.after)
    report_path = Path(args.report)

    try:
        before = parse_ledger(before_path)
        after = parse_ledger(after_path)

        report = compare(
            before,
            after,
            args.version,
            args.status,
        )

        report.update(
            {
                "schema_version": 1,
                "before_snapshot": str(before_path),
                "after_snapshot": str(after_path),
                "before_sha256": sha256(before_path),
                "after_sha256": sha256(after_path),
                "before_row_count": len(before),
                "after_row_count": len(after),
            }
        )

        report_path.parent.mkdir(parents=True, exist_ok=True)
        report_path.write_text(
            json.dumps(report, indent=2) + "\n",
            encoding="utf-8",
        )

        if not report["passed"]:
            print("TBL-008 POSTFLIGHT FAILED", file=sys.stderr)

            for error in report["errors"]:
                print(f"  - {error}", file=sys.stderr)

            return 1

        print("TBL-008 POSTFLIGHT PASSED")
        print(f"Approved version: {args.version}")
        print(f"Expected final status: {args.status}")
        print(
            "Changed versions:",
            ", ".join(report["changed_versions"]),
        )
        print("Report:", report_path)

        return 0

    except PostflightFailure as exc:
        print("TBL-008 POSTFLIGHT FAILED", file=sys.stderr)
        print(str(exc), file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
