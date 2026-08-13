#!/usr/bin/env python3
"""Fail closed unless Supabase dry-run output lists exactly approved migrations."""
from __future__ import annotations

import argparse
import re
from pathlib import Path

MIGRATION_TOKEN_RE = re.compile(r"(?<![0-9A-Za-z_])(\d{14})_[0-9A-Za-z_.-]+\.sql")


def parse_versions(path: Path) -> set[str]:
    versions = set(path.read_text(encoding="utf-8").split())
    if not versions or not all(re.fullmatch(r"\d{14}", v) for v in versions):
        raise ValueError("expected-version file must contain only 14-digit migration versions")
    return versions


def assert_plan(expected: set[str], output: str) -> list[str]:
    planned = set(MIGRATION_TOKEN_RE.findall(output))
    missing = sorted(expected - planned)
    unexpected = sorted(planned - expected)
    summary = [
        f"expected_count={len(expected)}",
        f"planned_migration_count={len(planned)}",
        f"missing_expected={missing}",
        f"unexpected_planned_versions={unexpected}",
    ]
    if missing:
        raise ValueError("not all approved migrations were planned: " + ",".join(missing))
    if unexpected:
        raise ValueError("dry run planned unapproved migrations: " + ",".join(unexpected))
    if len(planned) != len(expected):
        raise ValueError("planned migration count does not equal approved migration count")
    return summary


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--expected", required=True)
    parser.add_argument("--dry-run-output", required=True)
    parser.add_argument("--report", required=True)
    args = parser.parse_args()

    report_path = Path(args.report)
    report_path.parent.mkdir(parents=True, exist_ok=True)
    try:
        summary = assert_plan(
            parse_versions(Path(args.expected)),
            Path(args.dry_run_output).read_text(encoding="utf-8", errors="replace"),
        )
        report_path.write_text("\n".join(summary) + "\n", encoding="utf-8")
        print("\n".join(summary))
        print("WORKER ENGINE DRY-RUN PLAN ASSERTION PASSED")
        return 0
    except (OSError, ValueError) as exc:
        report_path.write_text(f"status=BLOCKED\nreason={exc}\n", encoding="utf-8")
        print("WORKER ENGINE DRY-RUN PLAN ASSERTION BLOCKED")
        print(str(exc))
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
