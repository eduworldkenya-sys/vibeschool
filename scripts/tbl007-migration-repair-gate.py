#!/usr/bin/env python3
"""
TBL-007 — migration repair preflight gate.

This script never repairs migration history.

It issues a short-lived authorization record only when all repair inputs are
validated and unchanged:

- exact repository HEAD;
- main branch;
- clean working tree;
- PRODUCTION environment classification;
- exact Supabase project;
- explicit current-session approval;
- approved repair action;
- unchanged classification artifact;
- unchanged collision register;
- unchanged migration directory;
- all required validators passing.

The resulting authorization record is written inside .git/ and is therefore
ephemeral and never committed.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import secrets
import subprocess
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

PROJECT_REF = "yauqsxggtuxuykcbrtzf"
ALLOWED_ENVIRONMENT = "PRODUCTION"
ALLOWED_STATUSES = {"applied", "reverted"}
VERSION_RE = re.compile(r"^\d{8,14}$")

ROOT = Path(__file__).resolve().parents[1]
CLASSIFICATION = ROOT / "supabase/reconciliation/migration_classification.json"
COLLISION_REGISTER = (
    ROOT / "supabase/reconciliation/tbl006_collision_register.json"
)
CLASSIFICATION_VALIDATOR = ROOT / "scripts/validate-migration-classification.py"
COLLISION_VALIDATOR = ROOT / "scripts/validate-tbl006-collision-register.py"
AUTHORIZATION_PATH = ROOT / ".git/tbl007-migration-repair-authorization.json"


class GateFailure(Exception):
    pass


def run(command: list[str], *, check: bool = True) -> subprocess.CompletedProcess[str]:
    result = subprocess.run(
        command,
        cwd=ROOT,
        text=True,
        capture_output=True,
    )
    if check and result.returncode != 0:
        detail = (result.stdout + "\n" + result.stderr).strip()
        raise GateFailure(
            f"Command failed: {' '.join(command)}"
            + (f"\n{detail}" if detail else "")
        )
    return result


def git_output(*args: str) -> str:
    return run(["git", *args]).stdout.strip()


def sha256_file(path: Path) -> str:
    if not path.is_file():
        raise GateFailure(f"Required file is missing: {path.relative_to(ROOT)}")
    return hashlib.sha256(path.read_bytes()).hexdigest()


def migrations_tree_hash() -> str:
    directory = ROOT / "supabase/migrations"
    if not directory.is_dir():
        raise GateFailure("supabase/migrations is missing")

    digest = hashlib.sha256()
    files = sorted(directory.glob("*.sql"))

    if not files:
        raise GateFailure("No SQL migrations found")

    for path in files:
        relative = path.relative_to(ROOT).as_posix()
        digest.update(relative.encode("utf-8"))
        digest.update(b"\0")
        digest.update(hashlib.sha256(path.read_bytes()).digest())
        digest.update(b"\0")

    return digest.hexdigest()


def require_string(data: dict[str, Any], key: str) -> str:
    value = data.get(key)
    if not isinstance(value, str) or not value.strip():
        raise GateFailure(f"Manifest field {key!r} must be a non-empty string")
    return value.strip()


def load_manifest(path: Path) -> dict[str, Any]:
    if not path.is_file():
        raise GateFailure(f"Manifest does not exist: {path}")

    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except Exception as exc:
        raise GateFailure(f"Manifest is not valid JSON: {exc}") from exc

    if not isinstance(data, dict):
        raise GateFailure("Manifest root must be a JSON object")

    return data


def validate_repository(manifest: dict[str, Any]) -> tuple[str, str]:
    branch = git_output("branch", "--show-current")
    head = git_output("rev-parse", "HEAD")
    expected_head = require_string(manifest, "expected_head")

    if branch != "main":
        raise GateFailure(f"Repair requires branch main; current branch is {branch!r}")

    if head != expected_head:
        raise GateFailure(
            "Repository HEAD changed after preflight manifest creation: "
            f"expected {expected_head}, found {head}"
        )

    status = git_output("status", "--porcelain")
    if status:
        raise GateFailure(
            "Working tree is not clean. Migration repair authorization denied."
        )

    return branch, head


def validate_target(manifest: dict[str, Any]) -> None:
    environment = require_string(manifest, "environment")
    project_ref = require_string(manifest, "project_ref")

    if environment != ALLOWED_ENVIRONMENT:
        raise GateFailure(
            f"Environment must be {ALLOWED_ENVIRONMENT}; found {environment!r}"
        )

    if project_ref != PROJECT_REF:
        raise GateFailure(
            f"Wrong Supabase project: expected {PROJECT_REF}, found {project_ref}"
        )


def validate_approval(manifest: dict[str, Any]) -> str:
    approval_status = require_string(manifest, "approval_status")
    approval_id = require_string(manifest, "approval_id")

    if approval_status != "APPROVED":
        raise GateFailure(
            "Explicit current-session approval is required. "
            f"Found approval_status={approval_status!r}"
        )

    return approval_id


def validate_action(manifest: dict[str, Any]) -> dict[str, str]:
    action = manifest.get("repair_action")
    if not isinstance(action, dict):
        raise GateFailure("repair_action must be an object")

    version = require_string(action, "version")
    status = require_string(action, "status")

    if not VERSION_RE.fullmatch(version):
        raise GateFailure(
            "repair_action.version must contain 8–14 numeric characters"
        )

    if status not in ALLOWED_STATUSES:
        raise GateFailure(
            f"repair_action.status must be one of {sorted(ALLOWED_STATUSES)}"
        )

    return {"version": version, "status": status}


def validate_hashes(manifest: dict[str, Any]) -> dict[str, str]:
    expected = manifest.get("expected_hashes")
    if not isinstance(expected, dict):
        raise GateFailure("expected_hashes must be an object")

    actual = {
        "migration_classification_sha256": sha256_file(CLASSIFICATION),
        "tbl006_collision_register_sha256": sha256_file(COLLISION_REGISTER),
        "migrations_tree_sha256": migrations_tree_hash(),
    }

    for key, value in actual.items():
        expected_value = expected.get(key)
        if expected_value != value:
            raise GateFailure(
                f"Input changed or hash is invalid for {key}: "
                f"expected {expected_value!r}, found {value}"
            )

    return actual


def run_validators() -> None:
    classification = run(
        [sys.executable, str(CLASSIFICATION_VALIDATOR)],
        check=False,
    )
    if classification.returncode != 0:
        detail = (classification.stdout + classification.stderr).strip()
        raise GateFailure(
            "Migration classification validation failed. "
            "Repair authorization denied.\n"
            + detail
        )

    collision = run(
        [sys.executable, str(COLLISION_VALIDATOR)],
        check=False,
    )
    if collision.returncode != 0:
        detail = (collision.stdout + collision.stderr).strip()
        raise GateFailure(
            "TBL-006 collision-register validation failed. "
            "Repair authorization denied.\n"
            + detail
        )


def write_authorization(
    *,
    head: str,
    approval_id: str,
    action: dict[str, str],
    hashes: dict[str, str],
) -> None:
    now = datetime.now(timezone.utc)
    expires = now + timedelta(minutes=15)

    authorization = {
        "schema_version": 1,
        "issued_by": "TBL-007",
        "token": secrets.token_urlsafe(32),
        "issued_at": now.isoformat(),
        "expires_at": expires.isoformat(),
        "project_ref": PROJECT_REF,
        "environment": ALLOWED_ENVIRONMENT,
        "repository_head": head,
        "approval_id": approval_id,
        "repair_action": action,
        "validated_hashes": hashes,
        "single_use": True,
    }

    AUTHORIZATION_PATH.write_text(
        json.dumps(authorization, indent=2) + "\n",
        encoding="utf-8",
    )

    try:
        os.chmod(AUTHORIZATION_PATH, 0o600)
    except OSError:
        pass


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--manifest",
        required=True,
        help="Path to an explicit migration-repair preflight manifest",
    )
    parser.add_argument(
        "--check-only",
        action="store_true",
        help="Validate without writing an authorization record",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()

    try:
        manifest_path = Path(args.manifest).expanduser().resolve()
        manifest = load_manifest(manifest_path)

        validate_target(manifest)
        approval_id = validate_approval(manifest)
        action = validate_action(manifest)
        _, head = validate_repository(manifest)
        hashes = validate_hashes(manifest)
        run_validators()

        if args.check_only:
            print("TBL-007 PREFLIGHT PASSED — check only")
        else:
            write_authorization(
                head=head,
                approval_id=approval_id,
                action=action,
                hashes=hashes,
            )
            print("TBL-007 PREFLIGHT PASSED")
            print(
                "Authorization:",
                AUTHORIZATION_PATH.relative_to(ROOT),
            )
            print("Authorization expires in 15 minutes and is single-use.")

        return 0

    except GateFailure as exc:
        if AUTHORIZATION_PATH.exists():
            AUTHORIZATION_PATH.unlink()

        print("TBL-007 PREFLIGHT DENIED", file=sys.stderr)
        print(str(exc), file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
