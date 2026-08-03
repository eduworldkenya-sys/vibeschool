#!/usr/bin/env python3
"""
Fail-closed tests for the TBL-007 authorized repair executor.

No Supabase command is run.
"""

from __future__ import annotations

import json
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
EXECUTOR = (
    ROOT / "scripts/tbl007-authorized-migration-repair.py"
)


def run_executor(
    authorization: dict | None,
    token: str = "test-token",
) -> subprocess.CompletedProcess[str]:
    path: Path | None = None

    if authorization is not None:
        handle = tempfile.NamedTemporaryFile(
            mode="w",
            suffix=".json",
            encoding="utf-8",
            delete=False,
        )
        json.dump(authorization, handle)
        handle.close()
        path = Path(handle.name)
    else:
        path = Path("/tmp/tbl007-does-not-exist.json")

    try:
        return subprocess.run(
            [
                sys.executable,
                str(EXECUTOR),
                "--authorization",
                str(path),
                "--token",
                token,
                "--print-command",
            ],
            cwd=ROOT,
            text=True,
            capture_output=True,
        )
    finally:
        if authorization is not None and path is not None:
            path.unlink(missing_ok=True)


def expect_denied(
    name: str,
    result: subprocess.CompletedProcess[str],
    expected: str,
) -> None:
    combined = result.stdout + result.stderr

    if result.returncode == 0:
        raise AssertionError(
            f"{name}: executor unexpectedly passed"
        )

    if "REPAIR DENIED" not in combined:
        raise AssertionError(
            f"{name}: denial heading missing\n{combined}"
        )

    if expected not in combined:
        raise AssertionError(
            f"{name}: expected {expected!r} missing\n{combined}"
        )

    print(f"PASS: {name}")


def main() -> int:
    expect_denied(
        "missing authorization",
        run_executor(None),
        "Authorization does not exist",
    )

    expect_denied(
        "invalid authorization issuer",
        run_executor(
            {
                "schema_version": 1,
                "issued_by": "OTHER",
                "single_use": True,
                "token": "test-token",
            }
        ),
        "not issued by TBL-007",
    )

    expect_denied(
        "wrong token",
        run_executor(
            {
                "schema_version": 1,
                "issued_by": "TBL-007",
                "single_use": True,
                "token": "correct-token",
                "project_ref": "yauqsxggtuxuykcbrtzf",
                "environment": "PRODUCTION",
                "expires_at": "2099-01-01T00:00:00+00:00",
                "repair_action": {
                    "version": "20260720123500",
                    "status": "reverted",
                },
            },
            token="wrong-token",
        ),
        "token does not match",
    )

    expect_denied(
        "expired authorization",
        run_executor(
            {
                "schema_version": 1,
                "issued_by": "TBL-007",
                "single_use": True,
                "token": "test-token",
                "project_ref": "yauqsxggtuxuykcbrtzf",
                "environment": "PRODUCTION",
                "expires_at": "2020-01-01T00:00:00+00:00",
                "repair_action": {
                    "version": "20260720123500",
                    "status": "reverted",
                },
            }
        ),
        "Authorization has expired",
    )

    print("TBL-007 authorized-repair refusal tests PASSED")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
