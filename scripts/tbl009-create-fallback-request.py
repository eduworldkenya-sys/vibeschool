#!/usr/bin/env python3
"""
Generate a fallback TBL-009 repair request from Termux.

This generator never runs a repair. Its output must still be submitted through
the protected GitHub repair workflow and canonical TBL-007 controls.
"""

from __future__ import annotations

import argparse
import json
import re
import subprocess
from pathlib import Path

PROJECT_REF = "yauqsxggtuxuykcbrtzf"
VERSION_RE = re.compile(r"^\d{8,14}$")
ALLOWED_STATUSES = {"applied", "reverted"}

ROOT = Path(__file__).resolve().parents[1]


def git_output(*args: str) -> str:
    result = subprocess.run(
        ["git", *args],
        cwd=ROOT,
        text=True,
        capture_output=True,
    )

    if result.returncode != 0:
        raise SystemExit(
            f"Git failed: git {' '.join(args)}\n"
            f"{result.stdout}{result.stderr}"
        )

    return result.stdout.strip()


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()

    parser.add_argument("--version", required=True)
    parser.add_argument(
        "--status",
        required=True,
        choices=sorted(ALLOWED_STATUSES),
    )
    parser.add_argument("--approval-id", required=True)
    parser.add_argument(
        "--output",
        default=".git/tbl009-fallback-request.json",
    )

    return parser.parse_args()


def main() -> int:
    args = parse_args()

    if not VERSION_RE.fullmatch(args.version):
        raise SystemExit(
            "--version must contain 8–14 digits"
        )

    branch = git_output("branch", "--show-current")
    head = git_output("rev-parse", "HEAD")
    status = git_output("status", "--porcelain")

    if branch != "main":
        raise SystemExit(
            f"Fallback request requires main; found {branch!r}"
        )

    if status:
        raise SystemExit(
            "Working tree must be clean before generating a fallback request"
        )

    output = Path(args.output).expanduser()

    if not output.is_absolute():
        output = ROOT / output

    request = {
        "migration_version": args.version,
        "repair_status": args.status,
        "expected_head": head,
        "approval_id": args.approval_id,
        "confirmation": (
            f"REPAIR {args.version} {args.status} "
            f"ON {PROJECT_REF}"
        ),
        "project_ref": PROJECT_REF,
        "environment": "PRODUCTION",
        "branch": "main",
        "source": "fallback_request",
    }

    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(
        json.dumps(request, indent=2) + "\n",
        encoding="utf-8",
    )

    print("TBL-009 fallback request created")
    print("Path:", output.relative_to(ROOT))
    print("Repository HEAD:", head)
    print("This file does not authorize or execute a repair.")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
