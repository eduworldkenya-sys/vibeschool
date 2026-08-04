#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import subprocess
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[2]
DEFAULT_REGISTRY = ROOT / "scripts/agent/registry.json"
DEFAULT_RUNTIME = ROOT / ".vibeschool-agent"


class HandoffError(RuntimeError):
    pass


def git_output(*args: str) -> str:
    result = subprocess.run(
        ["git", *args],
        cwd=ROOT,
        check=True,
        text=True,
        capture_output=True,
    )
    return result.stdout.strip()


def display_path(path: Path) -> str:
    """Use a repository-relative path when possible, otherwise an absolute path."""
    try:
        return str(path.resolve().relative_to(ROOT.resolve()))
    except ValueError:
        return str(path.resolve())


def load_registry(path: Path) -> dict[str, Any]:
    if not path.exists():
        raise HandoffError(f"registry missing: {path}")

    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as error:
        raise HandoffError(f"invalid registry JSON: {error}") from error

    if data.get("schema_version") != 1:
        raise HandoffError("unsupported registry schema")

    if not isinstance(data.get("fixes"), list):
        raise HandoffError("registry fixes must be a list")

    return data


def by_id(data: dict[str, Any]) -> dict[str, dict[str, Any]]:
    return {
        item["id"]: item
        for item in data["fixes"]
        if isinstance(item, dict) and isinstance(item.get("id"), str)
    }


def dependencies_complete(
    item: dict[str, Any],
    fixes: dict[str, dict[str, Any]],
) -> bool:
    return all(
        fixes.get(dep, {}).get("status") == "complete"
        for dep in item.get("depends_on", [])
    )


def select_fix(
    data: dict[str, Any],
    requested: str | None,
) -> dict[str, Any]:
    fixes = by_id(data)

    if requested:
        item = fixes.get(requested)
        if item is None:
            raise HandoffError(f"unknown fix id: {requested}")
    else:
        active_track = data.get("active_track")
        candidates = [
            item
            for item in data["fixes"]
            if item.get("status") in {"ready", "in_progress"}
            and item.get("definition")
            and dependencies_complete(item, fixes)
        ]

        preferred = [
            item
            for item in candidates
            if item.get("track") == active_track
        ]

        pool = preferred or candidates

        if not pool:
            raise HandoffError("no actionable fix has a handoff target")

        item = pool[0]

    if not dependencies_complete(item, fixes):
        raise HandoffError(
            f"{item['id']} has incomplete dependencies"
        )

    handoff = item.get("handoff")
    if not isinstance(handoff, dict):
        raise HandoffError(
            f"{item['id']} has no structured handoff contract"
        )

    return item


def latest_report_for(
    fix_id: str,
    runtime: Path,
) -> Path | None:
    reports = runtime / "reports"

    if not reports.exists():
        return None

    matches = sorted(
        reports.glob(f"*-{fix_id}.md"),
        key=lambda path: path.name,
    )

    return matches[-1] if matches else None


def bullets(items: list[str]) -> list[str]:
    return [f"- {item}" for item in items]


def render(
    item: dict[str, Any],
    runtime: Path,
) -> tuple[str, Path]:
    fix_id = item["id"]
    contract = item["handoff"]

    branch = git_output("branch", "--show-current")
    head = git_output("rev-parse", "--short", "HEAD")
    generated_at = datetime.now(timezone.utc).isoformat()
    report = latest_report_for(fix_id, runtime)

    output_dir = runtime / "handoffs"
    output_dir.mkdir(parents=True, exist_ok=True)

    output_path = output_dir / f"{fix_id}.md"

    lines = [
        f"# Vibeschool Implementation Handoff — {fix_id}",
        "",
        "## Repository state",
        "",
        f"- Branch: `{branch}`",
        f"- Head: `{head}`",
        f"- Generated: `{generated_at}`",
        (
            f"- Latest audit: `{display_path(report)}`"
            if report
            else "- Latest audit: `not available`"
        ),
        "",
        "## Fix identity",
        "",
        f"- Title: {item.get('title', '')}",
        f"- Track: `{item.get('track', '')}`",
        f"- Registry status: `{item.get('status', '')}`",
        (
            "- Dependencies: "
            + (
                ", ".join(f"`{dep}`" for dep in item.get("depends_on", []))
                or "none"
            )
        ),
        "",
        "## Proven finding",
        "",
        contract["finding"],
        "",
        "## Objective",
        "",
        contract["objective"],
        "",
        "## Required implementation scope",
        "",
        *bullets(contract["affected_files"]),
        "",
        "## Required contracts",
        "",
        *bullets(contract["required_contracts"]),
        "",
        "## Safety constraints",
        "",
        *bullets(contract["safety_constraints"]),
        "",
        "## Expected final scope",
        "",
        *bullets(contract["expected_scope"]),
        "",
        "## Required verification",
        "",
        "```bash",
        *contract["verification_commands"],
        "```",
        "",
        "## Immediate next action",
        "",
        contract["next_action"],
        "",
        "## Operating rule",
        "",
        (
            "Investigate first, produce evidence, implement only the proven "
            "gap, verify all contracts, then update the registry and HANDOVER.md. "
            "Do not expand into later fixes."
        ),
        "",
    ]

    text = "\n".join(lines)
    output_path.write_text(text, encoding="utf-8")

    return text, output_path


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("fix_id", nargs="?")
    parser.add_argument(
        "--registry",
        type=Path,
        default=DEFAULT_REGISTRY,
    )
    parser.add_argument(
        "--runtime",
        type=Path,
        default=DEFAULT_RUNTIME,
    )
    args = parser.parse_args()

    try:
        data = load_registry(args.registry)
        item = select_fix(data, args.fix_id)
        text, output_path = render(item, args.runtime)

        print(text)
        print(f"HANDOFF_FILE={display_path(output_path)}")
        return 0
    except HandoffError as error:
        print(f"HANDOFF_ERROR={error}")
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
