#!/usr/bin/env python3

from __future__ import annotations

import json
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
POSTFLIGHT = ROOT / "scripts/tbl008-migration-postflight.py"
VERSION = "20260720123500"
OTHER = "20260720200607"


def ledger(rows: list[tuple[str, str]]) -> str:
    lines = [
        "",
        "   Local          | Remote         | Time (UTC)",
        "  ----------------|----------------|---------------------",
    ]

    for local, remote in rows:
        lines.append(
            f"   {local:<14} | {remote:<14} | 2026-07-20 00:00:00"
        )

    return "\n".join(lines) + "\n"


def run_case(
    before_text: str,
    after_text: str,
    status: str,
) -> subprocess.CompletedProcess[str]:
    with tempfile.TemporaryDirectory() as directory:
        root = Path(directory)
        before = root / "before.txt"
        after = root / "after.txt"
        report = root / "report.json"

        before.write_text(before_text, encoding="utf-8")
        after.write_text(after_text, encoding="utf-8")

        result = subprocess.run(
            [
                sys.executable,
                str(POSTFLIGHT),
                "--before",
                str(before),
                "--after",
                str(after),
                "--version",
                VERSION,
                "--status",
                status,
                "--report",
                str(report),
            ],
            cwd=ROOT,
            text=True,
            capture_output=True,
        )

        if report.exists():
            result.report = json.loads(report.read_text(encoding="utf-8"))
        else:
            result.report = None

        return result


def require_pass(name: str, result) -> None:
    if result.returncode != 0:
        raise AssertionError(
            f"{name}: expected pass\n{result.stdout}{result.stderr}"
        )

    if not result.report or result.report["passed"] is not True:
        raise AssertionError(f"{name}: passing report missing")

    print(f"PASS: {name}")


def require_fail(name: str, result, expected: str) -> None:
    combined = result.stdout + result.stderr

    if result.returncode == 0:
        raise AssertionError(f"{name}: unexpectedly passed")

    if expected not in combined:
        raise AssertionError(
            f"{name}: expected {expected!r}\n{combined}"
        )

    print(f"PASS: {name}")


def main() -> int:
    require_pass(
        "apply one approved version",
        run_case(
            ledger([(VERSION, ""), (OTHER, OTHER)]),
            ledger([(VERSION, VERSION), (OTHER, OTHER)]),
            "applied",
        ),
    )

    require_pass(
        "revert one approved version",
        run_case(
            ledger([(VERSION, VERSION), (OTHER, OTHER)]),
            ledger([(VERSION, ""), (OTHER, OTHER)]),
            "reverted",
        ),
    )

    require_fail(
        "approved version unchanged",
        run_case(
            ledger([(VERSION, VERSION), (OTHER, OTHER)]),
            ledger([(VERSION, VERSION), (OTHER, OTHER)]),
            "reverted",
        ),
        "did not change",
    )

    require_fail(
        "unexpected second migration changed",
        run_case(
            ledger([(VERSION, VERSION), (OTHER, OTHER)]),
            ledger([(VERSION, ""), (OTHER, "")]),
            "reverted",
        ),
        "Unexpected migration versions changed",
    )

    require_fail(
        "wrong final state for applied",
        run_case(
            ledger([(VERSION, ""), (OTHER, OTHER)]),
            ledger([(VERSION, ""), (OTHER, OTHER)]),
            "applied",
        ),
        "not remote-applied",
    )

    require_fail(
        "approved version local state changed",
        run_case(
            ledger([(VERSION, VERSION), (OTHER, OTHER)]),
            ledger([("", ""), (OTHER, OTHER)]),
            "reverted",
        ),
        "changed local migration state",
    )

    require_fail(
        "malformed empty snapshot",
        run_case(
            "not a ledger\n",
            ledger([(VERSION, VERSION)]),
            "applied",
        ),
        "No migration rows could be parsed",
    )

    print("TBL-008 postflight tests PASSED")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
