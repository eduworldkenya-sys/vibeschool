#!/usr/bin/env python3

from __future__ import annotations

import json
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
AUDITOR = ROOT / "scripts/tbl013-live-ledger-audit.py"
PROJECT = "yauqsxggtuxuykcbrtzf"


def create_migration(root: Path, version: str, name: str) -> None:
    path = root / f"{version}_{name}.sql"
    path.write_text("select 1;\n", encoding="utf-8")


def run_case(
    local_versions: list[tuple[str, str]],
    ledger_text: str,
    project: str = PROJECT,
):
    with tempfile.TemporaryDirectory() as directory:
        root = Path(directory)
        migrations = root / "migrations"
        migrations.mkdir()

        for version, name in local_versions:
            create_migration(migrations, version, name)

        ledger = root / "ledger.txt"
        report = root / "report.json"
        plan = root / "plan.md"
        ledger.write_text(ledger_text, encoding="utf-8")

        result = subprocess.run(
            [
                sys.executable,
                str(AUDITOR),
                "--migrations-dir",
                str(migrations),
                "--ledger",
                str(ledger),
                "--report",
                str(report),
                "--plan",
                str(plan),
                "--project-ref",
                project,
            ],
            cwd=ROOT,
            text=True,
            capture_output=True,
        )

        report_data = (
            json.loads(report.read_text(encoding="utf-8"))
            if report.exists()
            else None
        )
        plan_text = plan.read_text(encoding="utf-8") if plan.exists() else None
        return result, report_data, plan_text


def assert_no_repairs(report: dict) -> None:
    if report["counts"]["authorized_repairs"] != 0:
        raise AssertionError("audit unexpectedly authorized migration repairs")
    if report["authorized_repairs"]:
        raise AssertionError("authorized_repairs must remain empty")
    if report["repair_inference_from_set_difference"] is not False:
        raise AssertionError("set difference unexpectedly permits repair inference")


def main() -> int:
    ledger = """
 Local          | Remote         | Time (UTC)
----------------|----------------|---------------------
 20260701000000 | 20260701000000 | 2026-07-01
 20260702000000 | 20260702000000 | 2026-07-02
"""
    result, report, plan = run_case(
        [("20260701000000", "one"), ("20260702000000", "two")], ledger
    )
    if result.returncode != 0:
        raise AssertionError(result.stdout + result.stderr)
    if not report or report["reconciliation_status"] != "RECONCILED":
        raise AssertionError("parity case was not reconciled")
    assert_no_repairs(report)
    if not plan or "Automatic migration repair: disabled" not in plan:
        raise AssertionError("plan did not state the repair safety boundary")
    print("PASS: full parity")

    ledger = """
 Local          | Remote         | Time (UTC)
----------------|----------------|---------------------
 20260701000000 | 20260701000000 | 2026-07-01
 20260702000000 |                | 2026-07-02
"""
    result, report, _ = run_case(
        [("20260701000000", "one"), ("20260702000000", "two")], ledger
    )
    if result.returncode != 0:
        raise AssertionError(result.stdout + result.stderr)
    if not report or len(report["local_only"]) != 1:
        raise AssertionError("repository-only version was not detected")
    local_only = report["local_only"][0]
    if local_only["classification"] != "REPOSITORY_ONLY_UNVERIFIED":
        raise AssertionError("repository-only migration was prematurely classified")
    if local_only["repair_status"] != "NOT_AUTHORIZED":
        raise AssertionError("repository-only migration unexpectedly authorized repair")
    if report["reconciliation_status"] != "REQUIRES_PROVENANCE_CLASSIFICATION":
        raise AssertionError("repository-only drift did not require provenance")
    assert_no_repairs(report)
    print("PASS: repository-only migration requires provenance")

    ledger = """
 Local          | Remote         | Time (UTC)
----------------|----------------|---------------------
 20260701000000 | 20260701000000 | 2026-07-01
                | 20260703000000 | 2026-07-03
"""
    result, report, _ = run_case([("20260701000000", "one")], ledger)
    if result.returncode != 0:
        raise AssertionError(result.stdout + result.stderr)
    if not report or len(report["remote_only"]) != 1:
        raise AssertionError("production-only version was not detected")
    remote_only = report["remote_only"][0]
    if remote_only["classification"] != "PRODUCTION_ONLY_BASELINE_OR_OUT_OF_BAND":
        raise AssertionError("production-only migration was prematurely classified")
    if remote_only["repair_status"] != "NOT_AUTHORIZED":
        raise AssertionError("production-only migration unexpectedly authorized repair")
    if report["reconciliation_status"] != "REQUIRES_PROVENANCE_CLASSIFICATION":
        raise AssertionError("production-only drift did not require provenance")
    assert_no_repairs(report)
    print("PASS: production-only migration requires provenance")

    ledger = """
 Local          | Remote         | Time (UTC)
----------------|----------------|---------------------
 20260701000000 | 20260701000000 | 2026-07-01
                | 20260701000000 | 2026-07-01
"""
    result, report, _ = run_case([("20260701000000", "one")], ledger)
    if result.returncode != 0:
        raise AssertionError(result.stdout + result.stderr)
    if not report or len(report["duplicate_remote_versions"]) != 1:
        raise AssertionError("duplicate production version was not detected")
    assert_no_repairs(report)
    print("PASS: duplicate production version detected without repair")

    result, _, _ = run_case(
        [("20260701000000", "one")], ledger, project="wrong-project"
    )
    if result.returncode == 0:
        raise AssertionError("wrong production project unexpectedly passed")
    print("PASS: wrong project denied")

    print("TBL-013 live ledger audit tests PASSED")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
