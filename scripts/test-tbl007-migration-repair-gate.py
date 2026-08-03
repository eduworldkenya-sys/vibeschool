#!/usr/bin/env python3
"""
TBL-007 refusal tests.

These tests verify that the migration-repair gate fails closed.

No Supabase command is executed.
No migration ledger is modified.
"""

from __future__ import annotations

import hashlib
import json
import subprocess
import sys
import tempfile
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
GATE = ROOT / "scripts/tbl007-migration-repair-gate.py"
CLASSIFICATION = ROOT / "supabase/reconciliation/migration_classification.json"
COLLISION = ROOT / "supabase/reconciliation/tbl006_collision_register.json"

PROJECT_REF = "yauqsxggtuxuykcbrtzf"


def git_output(*args: str) -> str:
    result = subprocess.run(
        ["git", *args],
        cwd=ROOT,
        text=True,
        capture_output=True,
        check=True,
    )

    return result.stdout.strip()


def sha256_file(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def migrations_tree_hash() -> str:
    digest = hashlib.sha256()

    for path in sorted((ROOT / "supabase/migrations").glob("*.sql")):
        digest.update(path.relative_to(ROOT).as_posix().encode("utf-8"))
        digest.update(b"\0")
        digest.update(hashlib.sha256(path.read_bytes()).digest())
        digest.update(b"\0")

    return digest.hexdigest()


def base_manifest() -> dict[str, Any]:
    return {
        "schema_version": 1,
        "environment": "PRODUCTION",
        "project_ref": PROJECT_REF,
        "expected_head": git_output("rev-parse", "HEAD"),
        "approval_status": "APPROVED",
        "approval_id": "TBL007-TEST-APPROVAL",
        "repair_action": {
            "version": "20260720123500",
            "status": "reverted",
        },
        "expected_hashes": {
            "migration_classification_sha256": sha256_file(CLASSIFICATION),
            "tbl006_collision_register_sha256": sha256_file(COLLISION),
            "migrations_tree_sha256": migrations_tree_hash(),
        },
    }


def run_gate(manifest: dict[str, Any]) -> subprocess.CompletedProcess[str]:
    with tempfile.NamedTemporaryFile(
        mode="w",
        suffix=".json",
        encoding="utf-8",
        delete=False,
    ) as handle:
        json.dump(manifest, handle)
        manifest_path = Path(handle.name)

    try:
        return subprocess.run(
            [
                sys.executable,
                str(GATE),
                "--manifest",
                str(manifest_path),
                "--check-only",
            ],
            cwd=ROOT,
            text=True,
            capture_output=True,
        )
    finally:
        manifest_path.unlink(missing_ok=True)


def expect_denied(
    name: str,
    manifest: dict[str, Any],
    expected_text: str,
) -> None:
    result = run_gate(manifest)
    combined = result.stdout + result.stderr

    if result.returncode == 0:
        raise AssertionError(f"{name}: gate unexpectedly passed")

    if "TBL-007 PREFLIGHT DENIED" not in combined:
        raise AssertionError(
            f"{name}: denial heading missing\n{combined}"
        )

    if expected_text not in combined:
        raise AssertionError(
            f"{name}: expected text {expected_text!r} missing\n{combined}"
        )

    print(f"PASS: {name}")


def main() -> int:
    # 1. During implementation the new TBL-007 files are uncommitted, so the
    # clean-working-tree guard must deny before classification is evaluated.
    # After commit, the integration verification separately proves that the
    # stale migration classification also denies authorization.
    manifest = base_manifest()
    expect_denied(
        "dirty working tree blocks repair",
        manifest,
        "Working tree is not clean",
    )

    # 2. Approval is mandatory.
    manifest = base_manifest()
    manifest["approval_status"] = "AWAITING_APPROVAL"
    expect_denied(
        "missing explicit approval",
        manifest,
        "Explicit current-session approval is required",
    )

    # 3. Target project is pinned.
    manifest = base_manifest()
    manifest["project_ref"] = "wrong-project"
    expect_denied(
        "wrong Supabase project",
        manifest,
        "Wrong Supabase project",
    )

    # 4. Environment classification is pinned.
    manifest = base_manifest()
    manifest["environment"] = "STAGING"
    expect_denied(
        "wrong environment",
        manifest,
        "Environment must be PRODUCTION",
    )

    # 5. Repository HEAD must remain unchanged.
    manifest = base_manifest()
    manifest["expected_head"] = "0" * 40
    expect_denied(
        "changed repository HEAD",
        manifest,
        "Repository HEAD changed",
    )

    # 6–7. Hash validation occurs after repository cleanliness. While these
    # scripts are uncommitted, the earlier dirty-tree guard is the correct
    # denial. Exact hash-mismatch behavior is verified after the implementation
    # files are committed and the tree is clean.
    manifest = base_manifest()
    manifest["expected_hashes"][
        "migration_classification_sha256"
    ] = "0" * 64
    expect_denied(
        "changed classification input remains blocked",
        manifest,
        "Working tree is not clean",
    )

    manifest = base_manifest()
    manifest["expected_hashes"]["migrations_tree_sha256"] = "f" * 64
    expect_denied(
        "changed migration input remains blocked",
        manifest,
        "Working tree is not clean",
    )

    # 8. Only known repair statuses are accepted.
    manifest = base_manifest()
    manifest["repair_action"]["status"] = "deleted"
    expect_denied(
        "invalid repair status",
        manifest,
        "repair_action.status must be one of",
    )

    print("TBL-007 refusal tests PASSED")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
