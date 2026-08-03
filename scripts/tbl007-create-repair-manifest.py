#!/usr/bin/env python3
"""
Create a TBL-007 migration-repair preflight manifest.

This script does not approve or execute a repair. It records the exact
repository and reconciliation inputs that a separately approved repair would
be allowed to use.

The generated manifest defaults to AWAITING_APPROVAL.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import subprocess
from datetime import datetime, timezone
from pathlib import Path

PROJECT_REF = "yauqsxggtuxuykcbrtzf"
ENVIRONMENT = "PRODUCTION"
ALLOWED_STATUSES = {"applied", "reverted"}
VERSION_RE = re.compile(r"^\d{8,14}$")

ROOT = Path(__file__).resolve().parents[1]
CLASSIFICATION = ROOT / "supabase/reconciliation/migration_classification.json"
COLLISION_REGISTER = (
    ROOT / "supabase/reconciliation/tbl006_collision_register.json"
)


def git_output(*args: str) -> str:
    result = subprocess.run(
        ["git", *args],
        cwd=ROOT,
        text=True,
        capture_output=True,
    )

    if result.returncode != 0:
        raise SystemExit(
            f"Git command failed: git {' '.join(args)}\n"
            f"{result.stdout}{result.stderr}"
        )

    return result.stdout.strip()


def sha256_file(path: Path) -> str:
    if not path.is_file():
        raise SystemExit(f"Missing required file: {path.relative_to(ROOT)}")

    return hashlib.sha256(path.read_bytes()).hexdigest()


def migrations_tree_hash() -> str:
    directory = ROOT / "supabase/migrations"

    if not directory.is_dir():
        raise SystemExit("Missing supabase/migrations directory")

    digest = hashlib.sha256()
    files = sorted(directory.glob("*.sql"))

    if not files:
        raise SystemExit("No SQL migrations found")

    for path in files:
        relative = path.relative_to(ROOT).as_posix()

        digest.update(relative.encode("utf-8"))
        digest.update(b"\0")
        digest.update(hashlib.sha256(path.read_bytes()).digest())
        digest.update(b"\0")

    return digest.hexdigest()


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()

    parser.add_argument(
        "--version",
        required=True,
        help="Migration version to repair, 8–14 digits",
    )

    parser.add_argument(
        "--status",
        required=True,
        choices=sorted(ALLOWED_STATUSES),
        help="Intended Supabase migration-repair status",
    )

    parser.add_argument(
        "--output",
        default=".git/tbl007-migration-repair-manifest.json",
        help="Output path; defaults inside .git so it cannot be committed",
    )

    parser.add_argument(
        "--approval-id",
        default="PENDING",
        help="External approval record ID; does not imply approval",
    )

    return parser.parse_args()


def main() -> int:
    args = parse_args()

    if not VERSION_RE.fullmatch(args.version):
        raise SystemExit("--version must contain 8–14 digits")

    branch = git_output("branch", "--show-current")
    head = git_output("rev-parse", "HEAD")
    status = git_output("status", "--porcelain")

    if branch != "main":
        raise SystemExit(f"Manifest creation requires main; found {branch!r}")

    if status:
        raise SystemExit(
            "Working tree must be clean before creating a repair manifest"
        )

    output = Path(args.output).expanduser()

    if not output.is_absolute():
        output = ROOT / output

    output = output.resolve()
    output.parent.mkdir(parents=True, exist_ok=True)

    manifest = {
        "schema_version": 1,
        "created_by": "TBL-007",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "environment": ENVIRONMENT,
        "project_ref": PROJECT_REF,
        "expected_head": head,
        "approval_status": "AWAITING_APPROVAL",
        "approval_id": args.approval_id,
        "repair_action": {
            "version": args.version,
            "status": args.status,
        },
        "expected_hashes": {
            "migration_classification_sha256": sha256_file(CLASSIFICATION),
            "tbl006_collision_register_sha256": sha256_file(
                COLLISION_REGISTER
            ),
            "migrations_tree_sha256": migrations_tree_hash(),
        },
        "safety_statement": (
            "This manifest authorizes nothing while approval_status is not "
            "APPROVED. Any change to repository HEAD, working tree, "
            "classification, collision register or migration files invalidates "
            "the manifest."
        ),
    }

    output.write_text(
        json.dumps(manifest, indent=2) + "\n",
        encoding="utf-8",
    )

    print("TBL-007 manifest created")
    print("Path:", output.relative_to(ROOT))
    print("Approval status: AWAITING_APPROVAL")
    print("Repository HEAD:", head)
    print(
        "Next step after explicit approval: change approval_status to "
        "APPROVED and set a real approval_id, then run the gate."
    )

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
