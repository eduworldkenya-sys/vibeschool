#!/usr/bin/env python3

from __future__ import annotations

import json
import subprocess
import sys
import tempfile
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
NORMALIZER = ROOT / "scripts/tbl009-repair-request.py"

VERSION = "20260720123500"
STATUS = "reverted"
HEAD = "4e5b151a8ed773a789b9d1b52c408e21a128734b"
PROJECT = "yauqsxggtuxuykcbrtzf"


def base_request(source: str) -> dict[str, Any]:
    return {
        "migration_version": VERSION,
        "repair_status": STATUS,
        "expected_head": HEAD,
        "approval_id": "TBL009-TEST",
        "confirmation": (
            f"REPAIR {VERSION} {STATUS} ON {PROJECT}"
        ),
        "project_ref": PROJECT,
        "environment": "PRODUCTION",
        "branch": "main",
        "source": source,
    }


def normalize(
    request: dict[str, Any],
) -> tuple[subprocess.CompletedProcess[str], dict | None]:
    with tempfile.TemporaryDirectory() as directory:
        root = Path(directory)
        source = root / "request.json"
        output = root / "normalized.json"

        source.write_text(
            json.dumps(request),
            encoding="utf-8",
        )

        result = subprocess.run(
            [
                sys.executable,
                str(NORMALIZER),
                "--input",
                str(source),
                "--output",
                str(output),
            ],
            cwd=ROOT,
            text=True,
            capture_output=True,
        )

        normalized = None

        if output.exists():
            normalized = json.loads(
                output.read_text(encoding="utf-8")
            )

        return result, normalized


def require_denied(
    name: str,
    request: dict[str, Any],
    expected: str,
) -> None:
    result, _ = normalize(request)
    combined = result.stdout + result.stderr

    if result.returncode == 0:
        raise AssertionError(
            f"{name}: unexpectedly passed"
        )

    if expected not in combined:
        raise AssertionError(
            f"{name}: expected {expected!r}\n{combined}"
        )

    print(f"PASS: {name}")


def main() -> int:
    primary_result, primary = normalize(
        base_request("workflow_dispatch")
    )
    fallback_result, fallback = normalize(
        base_request("fallback_request")
    )

    if primary_result.returncode != 0:
        raise AssertionError(
            primary_result.stdout + primary_result.stderr
        )

    if fallback_result.returncode != 0:
        raise AssertionError(
            fallback_result.stdout + fallback_result.stderr
        )

    if not primary or not fallback:
        raise AssertionError(
            "normalized request output missing"
        )

    primary_without_source = dict(primary)
    fallback_without_source = dict(fallback)

    primary_without_source.pop("source", None)
    fallback_without_source.pop("source", None)

    if primary_without_source != fallback_without_source:
        raise AssertionError(
            "primary and fallback normalized actions differ"
        )

    if primary["request_sha256"] != fallback["request_sha256"]:
        raise AssertionError(
            "primary and fallback request hashes differ"
        )

    print("PASS: primary and fallback equivalence")

    request = base_request("fallback_request")
    request["project_ref"] = "wrong-project"
    require_denied(
        "wrong project denied",
        request,
        "project_ref must be",
    )

    request = base_request("fallback_request")
    request["branch"] = "feature"
    require_denied(
        "wrong branch denied",
        request,
        "branch must be main",
    )

    request = base_request("fallback_request")
    request["expected_head"] = "abc123"
    require_denied(
        "short SHA denied",
        request,
        "full 40-character",
    )

    request = base_request("fallback_request")
    request["confirmation"] = "YES"
    require_denied(
        "wrong confirmation denied",
        request,
        "confirmation does not match",
    )

    request = base_request("fallback_request")
    request["repair_status"] = "deleted"
    require_denied(
        "invalid status denied",
        request,
        "repair_status must be one of",
    )

    request = base_request("unknown")
    require_denied(
        "unknown source denied",
        request,
        "source must be",
    )

    print("TBL-009 request equivalence tests PASSED")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
