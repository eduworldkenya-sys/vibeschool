#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import subprocess
from datetime import datetime, timezone
from pathlib import Path


def run_git(*args: str) -> str:
    completed = subprocess.run(
        ["git", *args],
        check=True,
        text=True,
        capture_output=True,
    )
    return completed.stdout.strip()


def extract_value(lines: list[str], key: str, default: str = "UNKNOWN") -> str:
    prefix = f"{key}="
    for line in reversed(lines):
        if line.startswith(prefix):
            return line[len(prefix):].strip() or default
    return default


def first_matching(lines: list[str], prefixes: tuple[str, ...]) -> str:
    for line in lines:
        stripped = line.strip()
        if stripped.startswith(prefixes):
            return stripped
    return "none"


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--fix-id", required=True)
    parser.add_argument("--run-id", required=True)
    parser.add_argument("--exit-code", required=True, type=int)
    parser.add_argument("--raw-log", required=True)
    parser.add_argument("--report", required=True)
    parser.add_argument("--state", required=True)
    args = parser.parse_args()

    raw_path = Path(args.raw_log)
    report_path = Path(args.report)
    state_path = Path(args.state)

    raw = raw_path.read_text(encoding="utf-8", errors="replace")
    lines = raw.splitlines()

    audit = extract_value(lines, "AUDIT_EXIT")
    tests = extract_value(lines, "TEST_EXIT")
    diff = extract_value(lines, "DIFF_EXIT")
    scope = extract_value(lines, "SCOPE_EXIT")
    finding = first_matching(
        lines,
        (
            "FINDING=",
            "BLOCKER=",
            "NEXT_ACTION=",
        ),
    )

    status = "PASS" if args.exit_code == 0 else "FAIL"
    branch = run_git("branch", "--show-current")
    head = run_git("rev-parse", "--short", "HEAD")
    timestamp = datetime.now(timezone.utc).isoformat()

    report_path.parent.mkdir(parents=True, exist_ok=True)
    report_path.write_text(
        "\n".join(
            [
                f"# Vibeschool Agent Report — {args.fix_id}",
                "",
                f"- Run: `{args.run_id}`",
                f"- Status: **{status}**",
                f"- Branch: `{branch}`",
                f"- Head: `{head}`",
                f"- Audit: `{audit}`",
                f"- Tests: `{tests}`",
                f"- Scope: `{scope}`",
                f"- Diff: `{diff}`",
                f"- Signal: `{finding}`",
                f"- Raw log: `{raw_path}`",
                "",
                "```text",
                f"FIX={args.fix_id}",
                f"RUN={args.run_id}",
                f"RESULT={status}",
                f"HEAD={head}",
                f"AUDIT={audit}",
                f"TESTS={tests}",
                f"SCOPE={scope}",
                f"DIFF={diff}",
                finding,
                "```",
                "",
            ]
        ),
        encoding="utf-8",
    )

    state: dict[str, object] = {
        "schema_version": 1,
        "mode": "read_only",
        "active_fix": args.fix_id,
        "last_run": {
            "fix_id": args.fix_id,
            "run_id": args.run_id,
            "status": status,
            "exit_code": args.exit_code,
            "branch": branch,
            "head": head,
            "timestamp": timestamp,
            "report": str(report_path),
            "raw_log": str(raw_path),
        },
    }

    state_path.parent.mkdir(parents=True, exist_ok=True)
    state_path.write_text(
        json.dumps(state, indent=2) + "\n",
        encoding="utf-8",
    )

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
