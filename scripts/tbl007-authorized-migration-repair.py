#!/usr/bin/env python3
"""
TBL-007 authorized migration-history repair executor.

This is the canonical repository path for:

    supabase migration repair <version> --status <status> --linked

It refuses execution unless a valid, unexpired, single-use authorization
created by tbl007-migration-repair-gate.py exists.

The executor repeats all critical preflight checks immediately before the
repair command. Authorization is consumed before execution and cannot be
reused, even if the CLI command fails.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import shutil
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]

PROJECT_REF = "yauqsxggtuxuykcbrtzf"
ENVIRONMENT = "PRODUCTION"
ALLOWED_STATUSES = {"applied", "reverted"}
VERSION_RE = re.compile(r"^\d{8,14}$")

DEFAULT_AUTHORIZATION = (
    ROOT / ".git/tbl007-migration-repair-authorization.json"
)
CONSUMED_RECORD = ROOT / ".git/tbl007-last-consumed-authorization.json"

CLASSIFICATION = (
    ROOT / "supabase/reconciliation/migration_classification.json"
)
COLLISION_REGISTER = (
    ROOT / "supabase/reconciliation/tbl006_collision_register.json"
)
CLASSIFICATION_VALIDATOR = (
    ROOT / "scripts/validate-migration-classification.py"
)
COLLISION_VALIDATOR = (
    ROOT / "scripts/validate-tbl006-collision-register.py"
)


class RepairDenied(Exception):
    pass


def run(
    command: list[str],
    *,
    check: bool = True,
) -> subprocess.CompletedProcess[str]:
    result = subprocess.run(
        command,
        cwd=ROOT,
        text=True,
        capture_output=True,
    )

    if check and result.returncode != 0:
        output = (result.stdout + "\n" + result.stderr).strip()
        raise RepairDenied(
            f"Command failed: {' '.join(command)}"
            + (f"\n{output}" if output else "")
        )

    return result


def git_output(*args: str) -> str:
    return run(["git", *args]).stdout.strip()


def sha256_file(path: Path) -> str:
    if not path.is_file():
        raise RepairDenied(
            f"Required file is missing: {path.relative_to(ROOT)}"
        )

    return hashlib.sha256(path.read_bytes()).hexdigest()


def migrations_tree_hash() -> str:
    migration_dir = ROOT / "supabase/migrations"

    if not migration_dir.is_dir():
        raise RepairDenied("supabase/migrations directory is missing")

    files = sorted(migration_dir.glob("*.sql"))

    if not files:
        raise RepairDenied("No migration SQL files were found")

    digest = hashlib.sha256()

    for path in files:
        digest.update(
            path.relative_to(ROOT).as_posix().encode("utf-8")
        )
        digest.update(b"\0")
        digest.update(hashlib.sha256(path.read_bytes()).digest())
        digest.update(b"\0")

    return digest.hexdigest()


def require_string(data: dict[str, Any], key: str) -> str:
    value = data.get(key)

    if not isinstance(value, str) or not value.strip():
        raise RepairDenied(
            f"Authorization field {key!r} must be a non-empty string"
        )

    return value.strip()


def load_authorization(path: Path) -> dict[str, Any]:
    if not path.is_file():
        raise RepairDenied(
            f"Authorization does not exist: {path}"
        )

    try:
        authorization = json.loads(
            path.read_text(encoding="utf-8")
        )
    except Exception as exc:
        raise RepairDenied(
            f"Authorization is not valid JSON: {exc}"
        ) from exc

    if not isinstance(authorization, dict):
        raise RepairDenied(
            "Authorization root must be a JSON object"
        )

    return authorization


def validate_authorization(
    authorization: dict[str, Any],
    supplied_token: str,
) -> tuple[str, str]:
    if authorization.get("schema_version") != 1:
        raise RepairDenied(
            "Unsupported authorization schema version"
        )

    if authorization.get("issued_by") != "TBL-007":
        raise RepairDenied(
            "Authorization was not issued by TBL-007"
        )

    if authorization.get("single_use") is not True:
        raise RepairDenied(
            "Authorization is not marked single-use"
        )

    stored_token = require_string(authorization, "token")

    if not supplied_token:
        raise RepairDenied("--token is required")

    if not secrets_equal(stored_token, supplied_token):
        raise RepairDenied("Authorization token does not match")

    if require_string(authorization, "project_ref") != PROJECT_REF:
        raise RepairDenied("Authorization targets the wrong project")

    if require_string(authorization, "environment") != ENVIRONMENT:
        raise RepairDenied(
            "Authorization targets the wrong environment"
        )

    expires_text = require_string(authorization, "expires_at")

    try:
        expires = datetime.fromisoformat(expires_text)
    except ValueError as exc:
        raise RepairDenied(
            "Authorization expiry is invalid"
        ) from exc

    if expires.tzinfo is None:
        raise RepairDenied(
            "Authorization expiry must include a timezone"
        )

    if datetime.now(timezone.utc) >= expires.astimezone(timezone.utc):
        raise RepairDenied("Authorization has expired")

    action = authorization.get("repair_action")

    if not isinstance(action, dict):
        raise RepairDenied(
            "Authorization repair_action is missing"
        )

    version = require_string(action, "version")
    status = require_string(action, "status")

    if not VERSION_RE.fullmatch(version):
        raise RepairDenied(
            "Authorized migration version is invalid"
        )

    if status not in ALLOWED_STATUSES:
        raise RepairDenied(
            "Authorized repair status is invalid"
        )

    return version, status


def secrets_equal(left: str, right: str) -> bool:
    import hmac

    return hmac.compare_digest(left, right)


def validate_repository(
    authorization: dict[str, Any],
) -> None:
    branch = git_output("branch", "--show-current")
    head = git_output("rev-parse", "HEAD")
    expected_head = require_string(
        authorization,
        "repository_head",
    )

    if branch != "main":
        raise RepairDenied(
            f"Repair requires branch main; found {branch!r}"
        )

    if head != expected_head:
        raise RepairDenied(
            "Repository HEAD changed after authorization: "
            f"expected {expected_head}, found {head}"
        )

    status = git_output("status", "--porcelain")

    if status:
        raise RepairDenied(
            "Working tree is not clean. Repair denied."
        )


def validate_hashes(
    authorization: dict[str, Any],
) -> None:
    expected = authorization.get("validated_hashes")

    if not isinstance(expected, dict):
        raise RepairDenied(
            "Authorization validated_hashes is missing"
        )

    actual = {
        "migration_classification_sha256": sha256_file(
            CLASSIFICATION
        ),
        "tbl006_collision_register_sha256": sha256_file(
            COLLISION_REGISTER
        ),
        "migrations_tree_sha256": migrations_tree_hash(),
    }

    for key, actual_value in actual.items():
        if expected.get(key) != actual_value:
            raise RepairDenied(
                f"Validated repair input changed: {key}"
            )


def run_validators() -> None:
    checks = [
        (
            "migration classification",
            CLASSIFICATION_VALIDATOR,
        ),
        (
            "TBL-006 collision register",
            COLLISION_VALIDATOR,
        ),
    ]

    for label, validator in checks:
        result = run(
            [sys.executable, str(validator)],
            check=False,
        )

        if result.returncode != 0:
            output = (
                result.stdout + result.stderr
            ).strip()

            raise RepairDenied(
                f"{label} validation failed. Repair denied."
                + (f"\n{output}" if output else "")
            )


def validate_linked_project() -> None:
    project_ref_file = (
        ROOT / "supabase/.temp/project-ref"
    )

    if not project_ref_file.is_file():
        raise RepairDenied(
            "Supabase linked-project proof is missing at "
            "supabase/.temp/project-ref"
        )

    linked_ref = project_ref_file.read_text(
        encoding="utf-8"
    ).strip()

    if linked_ref != PROJECT_REF:
        raise RepairDenied(
            "Supabase CLI is linked to the wrong project: "
            f"expected {PROJECT_REF}, found {linked_ref!r}"
        )


def consume_authorization(
    path: Path,
    authorization: dict[str, Any],
) -> None:
    consumed = dict(authorization)
    consumed["consumed_at"] = datetime.now(
        timezone.utc
    ).isoformat()
    consumed["consumed_by"] = (
        "tbl007-authorized-migration-repair"
    )
    consumed.pop("token", None)

    CONSUMED_RECORD.write_text(
        json.dumps(consumed, indent=2) + "\n",
        encoding="utf-8",
    )

    try:
        os.chmod(CONSUMED_RECORD, 0o600)
    except OSError:
        pass

    path.unlink()


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()

    parser.add_argument(
        "--authorization",
        default=str(DEFAULT_AUTHORIZATION),
        help="TBL-007 authorization JSON path",
    )

    parser.add_argument(
        "--token",
        required=True,
        help="Exact token printed from the authorization file",
    )

    parser.add_argument(
        "--print-command",
        action="store_true",
        help=(
            "Validate authorization and print the approved CLI "
            "command without consuming or executing it"
        ),
    )

    parser.add_argument(
        "--execute",
        action="store_true",
        help="Execute the approved repair",
    )

    return parser.parse_args()


def main() -> int:
    args = parse_args()

    if args.print_command == args.execute:
        print(
            "REPAIR DENIED",
            file=sys.stderr,
        )
        print(
            "Choose exactly one of --print-command or --execute",
            file=sys.stderr,
        )
        return 1

    authorization_path = Path(
        args.authorization
    ).expanduser().resolve()

    try:
        authorization = load_authorization(
            authorization_path
        )

        version, status = validate_authorization(
            authorization,
            args.token,
        )

        validate_repository(authorization)
        validate_hashes(authorization)
        run_validators()

        command = [
            "supabase",
            "migration",
            "repair",
            version,
            "--status",
            status,
            "--linked",
        ]

        if args.print_command:
            print("TBL-007 AUTHORIZATION VALID")
            print("Approved command:")
            print(" ".join(command))
            print(
                "Authorization was not consumed because "
                "--print-command was used."
            )
            return 0

        validate_linked_project()

        if shutil.which("supabase") is None:
            raise RepairDenied(
                "Supabase CLI is not installed or not executable"
            )

        expected_confirmation = (
            f"REPAIR {version} {status} ON {PROJECT_REF}"
        )
        supplied_confirmation = os.environ.get(
            "TBL007_REPAIR_CONFIRM",
            "",
        )

        if not secrets_equal(
            expected_confirmation,
            supplied_confirmation,
        ):
            raise RepairDenied(
                "Exact execution confirmation is missing. Set:\n"
                f"TBL007_REPAIR_CONFIRM='{expected_confirmation}'"
            )

        # Single-use means consume before invoking the destructive
        # migration-history command. A failed CLI call does not restore it.
        consume_authorization(
            authorization_path,
            authorization,
        )

        print("Executing authorized migration-history repair:")
        print(" ".join(command))

        result = subprocess.run(
            command,
            cwd=ROOT,
            text=True,
        )

        if result.returncode != 0:
            print(
                "REPAIR COMMAND FAILED — authorization remains consumed",
                file=sys.stderr,
            )
            return result.returncode

        print("AUTHORIZED MIGRATION REPAIR COMPLETED")
        print(
            "Run the TBL-008 postflight immediately before "
            "performing any further migration action."
        )
        return 0

    except RepairDenied as exc:
        print("REPAIR DENIED", file=sys.stderr)
        print(str(exc), file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
