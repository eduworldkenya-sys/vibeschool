#!/usr/bin/env python3
"""
TBL-009 canonical migration-repair request contract.

Both the normal GitHub workflow form and the fallback request generator must
produce this same normalized request.

This script never connects to Supabase and never performs a repair.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import sys
from pathlib import Path
from typing import Any

PROJECT_REF = "yauqsxggtuxuykcbrtzf"
ENVIRONMENT = "PRODUCTION"
REQUIRED_BRANCH = "main"

VERSION_RE = re.compile(r"^\d{8,14}$")
SHA_RE = re.compile(r"^[0-9a-f]{40}$")
APPROVAL_RE = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._:/-]{2,127}$")
ALLOWED_STATUSES = {"applied", "reverted"}


class RequestFailure(Exception):
    pass


def require_string(data: dict[str, Any], key: str) -> str:
    value = data.get(key)

    if not isinstance(value, str) or not value.strip():
        raise RequestFailure(f"{key} must be a non-empty string")

    return value.strip()


def normalize(data: dict[str, Any]) -> dict[str, Any]:
    version = require_string(data, "migration_version")
    status = require_string(data, "repair_status")
    expected_head = require_string(data, "expected_head").lower()
    approval_id = require_string(data, "approval_id")
    confirmation = require_string(data, "confirmation")
    project_ref = require_string(data, "project_ref")
    environment = require_string(data, "environment")
    branch = require_string(data, "branch")
    source = require_string(data, "source")

    if not VERSION_RE.fullmatch(version):
        raise RequestFailure(
            "migration_version must contain 8–14 digits"
        )

    if status not in ALLOWED_STATUSES:
        raise RequestFailure(
            f"repair_status must be one of {sorted(ALLOWED_STATUSES)}"
        )

    if not SHA_RE.fullmatch(expected_head):
        raise RequestFailure(
            "expected_head must be a full 40-character lowercase SHA"
        )

    if not APPROVAL_RE.fullmatch(approval_id):
        raise RequestFailure(
            "approval_id contains invalid characters or has invalid length"
        )

    if project_ref != PROJECT_REF:
        raise RequestFailure(
            f"project_ref must be {PROJECT_REF}"
        )

    if environment != ENVIRONMENT:
        raise RequestFailure(
            f"environment must be {ENVIRONMENT}"
        )

    if branch != REQUIRED_BRANCH:
        raise RequestFailure(
            f"branch must be {REQUIRED_BRANCH}"
        )

    if source not in {"workflow_dispatch", "fallback_request"}:
        raise RequestFailure(
            "source must be workflow_dispatch or fallback_request"
        )

    expected_confirmation = (
        f"REPAIR {version} {status} ON {PROJECT_REF}"
    )

    if confirmation != expected_confirmation:
        raise RequestFailure(
            "confirmation does not match the requested repair action"
        )

    normalized_action = {
        "schema_version": 1,
        "environment": ENVIRONMENT,
        "project_ref": PROJECT_REF,
        "branch": REQUIRED_BRANCH,
        "expected_head": expected_head,
        "approval_id": approval_id,
        "repair_action": {
            "version": version,
            "status": status,
        },
        "confirmation": expected_confirmation,
    }

    canonical = json.dumps(
        normalized_action,
        sort_keys=True,
        separators=(",", ":"),
        ensure_ascii=False,
    ).encode("utf-8")

    normalized_action["request_sha256"] = hashlib.sha256(
        canonical
    ).hexdigest()

    normalized_action["source"] = source

    return normalized_action


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()

    parser.add_argument(
        "--input",
        required=True,
        help="Input JSON request",
    )

    parser.add_argument(
        "--output",
        required=True,
        help="Normalized JSON output",
    )

    return parser.parse_args()


def main() -> int:
    args = parse_args()
    input_path = Path(args.input)
    output_path = Path(args.output)

    try:
        if not input_path.is_file():
            raise RequestFailure(
                f"request file does not exist: {input_path}"
            )

        try:
            data = json.loads(
                input_path.read_text(encoding="utf-8")
            )
        except Exception as exc:
            raise RequestFailure(
                f"request is not valid JSON: {exc}"
            ) from exc

        if not isinstance(data, dict):
            raise RequestFailure(
                "request root must be a JSON object"
            )

        normalized = normalize(data)

        output_path.parent.mkdir(
            parents=True,
            exist_ok=True,
        )

        output_path.write_text(
            json.dumps(
                normalized,
                indent=2,
                ensure_ascii=False,
            )
            + "\n",
            encoding="utf-8",
        )

        print("TBL-009 REQUEST VALID")
        print("Source:", normalized["source"])
        print(
            "Version:",
            normalized["repair_action"]["version"],
        )
        print(
            "Status:",
            normalized["repair_action"]["status"],
        )
        print(
            "Request SHA-256:",
            normalized["request_sha256"],
        )
        print("Output:", output_path)

        return 0

    except RequestFailure as exc:
        print("TBL-009 REQUEST DENIED", file=sys.stderr)
        print(str(exc), file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
