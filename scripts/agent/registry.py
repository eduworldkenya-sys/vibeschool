#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[2]
REGISTRY_PATH = ROOT / "scripts/agent/registry.json"


class RegistryError(RuntimeError):
    pass


def load_registry(path: Path = REGISTRY_PATH) -> dict[str, Any]:
    if not path.exists():
        raise RegistryError(f"registry missing: {path}")

    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as error:
        raise RegistryError(f"registry JSON invalid: {error}") from error

    if data.get("schema_version") != 1:
        raise RegistryError("unsupported registry schema_version")

    fixes = data.get("fixes")
    if not isinstance(fixes, list):
        raise RegistryError("registry fixes must be a list")

    seen: set[str] = set()

    for item in fixes:
        if not isinstance(item, dict):
            raise RegistryError("each fix must be an object")

        fix_id = item.get("id")
        if not isinstance(fix_id, str) or not fix_id:
            raise RegistryError("each fix requires a non-empty id")

        if fix_id in seen:
            raise RegistryError(f"duplicate fix id: {fix_id}")

        seen.add(fix_id)

        if item.get("status") not in {
            "planned",
            "blocked",
            "ready",
            "in_progress",
            "complete",
        }:
            raise RegistryError(f"invalid status for {fix_id}")

        dependencies = item.get("depends_on", [])
        if not isinstance(dependencies, list) or not all(
            isinstance(dep, str) for dep in dependencies
        ):
            raise RegistryError(f"invalid dependencies for {fix_id}")

    known = {item["id"] for item in fixes}
    for item in fixes:
        for dependency in item.get("depends_on", []):
            if dependency not in known:
                raise RegistryError(
                    f"{item['id']} depends on unknown fix {dependency}"
                )

    return data


def dependency_state(
    fix: dict[str, Any],
    by_id: dict[str, dict[str, Any]],
) -> tuple[bool, list[str]]:
    missing = [
        dependency
        for dependency in fix.get("depends_on", [])
        if by_id[dependency].get("status") != "complete"
    ]
    return len(missing) == 0, missing


def select_next(data: dict[str, Any]) -> dict[str, Any] | None:
    fixes = data["fixes"]
    by_id = {item["id"]: item for item in fixes}
    active_track = data.get("active_track")

    candidates: list[dict[str, Any]] = []

    for item in fixes:
        if item.get("status") not in {"ready", "in_progress"}:
            continue

        ready, _ = dependency_state(item, by_id)
        if not ready:
            continue

        if item.get("definition") is None:
            continue

        candidates.append(item)

    if active_track:
        track_candidates = [
            item for item in candidates if item.get("track") == active_track
        ]
        if track_candidates:
            return track_candidates[0]

    return candidates[0] if candidates else None


def print_fix(item: dict[str, Any]) -> None:
    print(f"FIX_ID={item['id']}")
    print(f"TITLE={item.get('title', '')}")
    print(f"TRACK={item.get('track', '')}")
    print(f"STATUS={item.get('status', '')}")
    print(f"DEFINITION={item.get('definition') or ''}")
    print(
        "DEPENDS_ON="
        + ",".join(item.get("depends_on", []))
    )


def command_validate(data: dict[str, Any]) -> int:
    fixes = data["fixes"]
    complete = sum(item["status"] == "complete" for item in fixes)
    ready = sum(item["status"] == "ready" for item in fixes)
    blocked = sum(item["status"] == "blocked" for item in fixes)

    print("REGISTRY=VALID")
    print(f"FIX_COUNT={len(fixes)}")
    print(f"COMPLETE={complete}")
    print(f"READY={ready}")
    print(f"BLOCKED={blocked}")
    return 0


def command_next(data: dict[str, Any]) -> int:
    item = select_next(data)
    if item is None:
        print("NEXT_FIX=NONE")
        return 2

    print(f"NEXT_FIX={item['id']}")
    print_fix(item)
    return 0


def command_get(data: dict[str, Any], fix_id: str) -> int:
    for item in data["fixes"]:
        if item["id"] == fix_id:
            print_fix(item)
            return 0

    raise RegistryError(f"unknown fix id: {fix_id}")


def command_list(data: dict[str, Any]) -> int:
    by_id = {item["id"]: item for item in data["fixes"]}

    print("ID\tSTATUS\tTRACK\tDEPENDENCIES\tTITLE")
    for item in data["fixes"]:
        ready, missing = dependency_state(item, by_id)
        dependency_display = ",".join(missing or item.get("depends_on", []))
        effective_status = item["status"]

        if item["status"] in {"ready", "in_progress"} and not ready:
            effective_status = "blocked"

        print(
            "\t".join(
                [
                    item["id"],
                    effective_status,
                    item.get("track", ""),
                    dependency_display,
                    item.get("title", ""),
                ]
            )
        )

    return 0


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "command",
        choices=["validate", "next", "get", "list"],
    )
    parser.add_argument("fix_id", nargs="?")
    parser.add_argument("--registry", type=Path, default=REGISTRY_PATH)
    args = parser.parse_args()

    try:
        data = load_registry(args.registry)

        if args.command == "validate":
            return command_validate(data)

        if args.command == "next":
            return command_next(data)

        if args.command == "list":
            return command_list(data)

        if args.command == "get":
            if not args.fix_id:
                raise RegistryError("get requires a fix id")
            return command_get(data, args.fix_id)

        raise RegistryError("unsupported command")
    except RegistryError as error:
        print(f"REGISTRY_ERROR={error}")
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
