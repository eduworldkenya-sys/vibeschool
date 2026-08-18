#!/usr/bin/env python3
"""Build a CI-only Supabase migration view for Worker Engine promotion dry-runs.

The staged timestamp set is exactly production history plus pending approved Worker
Engine promotion migrations. Repository-only migrations outside the approved set are
omitted. Production-only versions receive inert placeholders.

A caller may also set VERSION_PLACEHOLDER_OVERRIDES for a version known to exist on
both sides with different semantic identity. Such a version is staged as an inert
historical placeholder, never as the repository SQL. This prevents version equality
from being mistaken for migration equivalence.
"""

from __future__ import annotations

import argparse
import json
import re
import shutil
from pathlib import Path

MIGRATION_RE = re.compile(r"^(\d{8,14})_.+\.sql$")

APPROVED_WORKER_ENGINE_VERSIONS = {
    "20260812191500", "20260812191600", "20260812193000",
    "20260812194000", "20260812195000", "20260812200000",
    "20260812201000", "20260812202000", "20260812202100",
    "20260812202200", "20260812202300", "20260812202400",
    "20260812202500", "20260812202600", "20260812211500",
    "20260812213000", "20260812214500", "20260812215500",
    "20260812221000", "20260812222000", "20260812223000",
    "20260813023028", "20260814094000",
    "20260814111500", "20260814152000", "20260814153500",
    "20260814155000", "20260814160000", "20260814162000",
    "20260815080000", "20260815090000", "20260815091000",
    "20260815092000", "20260815093000", "20260815094000",
    "20260815095000", "20260815110000", "20260815111000",
    "20260815120000", "20260815130000", "20260815133000",
}

# Callers may override known shared-version/non-equivalent identities. The value is a
# human-readable provenance reason included in the manifest and placeholder comment.
VERSION_PLACEHOLDER_OVERRIDES: dict[str, str] = {}


class StageFailure(Exception):
    pass


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--report", required=True)
    parser.add_argument("--migrations-dir", default="supabase/migrations")
    parser.add_argument("--config", default="supabase/config.toml")
    parser.add_argument("--stage-dir", required=True)
    parser.add_argument("--manifest", required=True)
    parser.add_argument("--expected-versions", required=True)
    return parser.parse_args()


def load_report(path: Path) -> dict:
    if not path.is_file():
        raise StageFailure(f"TBL-013 report missing: {path}")
    report = json.loads(path.read_text(encoding="utf-8"))
    if report.get("read_only_audit") is not True:
        raise StageFailure("TBL-013 report is not read-only")
    if report.get("authorized_repairs"):
        raise StageFailure("TBL-013 unexpectedly authorized repairs")
    counts = report.get("counts", {})
    if counts.get("duplicate_local_versions") != 0:
        raise StageFailure("duplicate repository migration versions")
    if counts.get("duplicate_remote_versions") != 0:
        raise StageFailure("duplicate production migration versions")
    return report


def version_set(rows: list[dict], label: str) -> set[str]:
    result: set[str] = set()
    for row in rows:
        version = str(row.get("version", ""))
        if not re.fullmatch(r"\d{8,14}", version):
            raise StageFailure(f"invalid {label} version: {version!r}")
        if version in result:
            raise StageFailure(f"duplicate {label} version in report: {version}")
        result.add(version)
    return result


def build_stage(report: dict, migrations_dir: Path, config_path: Path, stage_dir: Path) -> dict:
    if not migrations_dir.is_dir():
        raise StageFailure(f"migration directory missing: {migrations_dir}")
    if not config_path.is_file():
        raise StageFailure(f"Supabase config missing: {config_path}")

    local_only = version_set(report.get("local_only", []), "local-only")
    remote_only = version_set(report.get("remote_only", []), "remote-only")
    parity = set(map(str, report.get("parity_versions", [])))
    if not all(re.fullmatch(r"\d{8,14}", v) for v in parity):
        raise StageFailure("invalid parity migration version")
    if parity & remote_only or parity & local_only or remote_only & local_only:
        raise StageFailure("TBL-013 version classes overlap")

    overrides = dict(VERSION_PLACEHOLDER_OVERRIDES)
    invalid_override = sorted(v for v in overrides if not re.fullmatch(r"\d{8,14}", v))
    if invalid_override:
        raise StageFailure(f"invalid identity-placeholder versions: {invalid_override}")
    non_remote_override = sorted(set(overrides) - (parity | remote_only))
    if non_remote_override:
        raise StageFailure("identity placeholder is not present in production ledger: " + ",".join(non_remote_override))

    approved = APPROVED_WORKER_ENGINE_VERSIONS
    known = parity | local_only | remote_only
    missing_approved = sorted(approved - known)
    if missing_approved:
        raise StageFailure("approved Worker Engine migration absent from ledger classification: " + ",".join(missing_approved))
    approved_remote_only = sorted(approved & remote_only)
    if approved_remote_only:
        raise StageFailure("approved Worker Engine migration exists only in production history: " + ",".join(approved_remote_only))

    pending = approved & local_only
    if not pending:
        raise StageFailure("no approved Worker Engine migrations are pending production promotion")
    unrelated_local_only = sorted(local_only - pending)

    if stage_dir.exists():
        shutil.rmtree(stage_dir)
    stage_migrations = stage_dir / "supabase" / "migrations"
    stage_migrations.mkdir(parents=True)
    shutil.copy2(config_path, stage_dir / "supabase" / "config.toml")

    staged_versions: set[str] = set()
    for source in sorted(migrations_dir.glob("*.sql")):
        match = MIGRATION_RE.fullmatch(source.name)
        if match is None:
            raise StageFailure(f"invalid migration filename: {source.name}")
        version = match.group(1)
        if version in staged_versions:
            raise StageFailure(f"duplicate local migration version: {version}")
        if version in unrelated_local_only or version in overrides:
            continue
        shutil.copy2(source, stage_migrations / source.name)
        staged_versions.add(version)

    for version in sorted(remote_only | set(overrides)):
        if version in staged_versions:
            raise StageFailure(f"historical placeholder version unexpectedly staged: {version}")
        reason = overrides.get(version, "production-only history")
        placeholder = stage_migrations / f"{version}_production_history_placeholder.sql"
        placeholder.write_text(
            "-- CI-only ledger-alignment placeholder for an already-applied production migration.\n"
            "-- Never executed; version exists in production history.\n"
            f"-- provenance: {reason}\n",
            encoding="utf-8",
        )
        staged_versions.add(version)

    remote_versions = parity | remote_only
    expected_stage = remote_versions | pending
    if staged_versions != expected_stage:
        missing = sorted(expected_stage - staged_versions)
        extra = sorted(staged_versions - expected_stage)
        raise StageFailure(f"staged ledger mismatch missing={missing} extra={extra}")

    return {
        "mode": "EPHEMERAL_LEDGER_ALIGNED_DRY_RUN_VIEW",
        "approved_worker_engine_versions": sorted(approved),
        "expected_worker_engine_versions": sorted(pending),
        "excluded_unrelated_repository_only": unrelated_local_only,
        "production_only_placeholders": sorted(remote_only),
        "identity_collision_placeholders": [
            {"version": version, "reason": overrides[version]}
            for version in sorted(overrides)
        ],
        "parity_versions": sorted(parity),
        "staged_version_count": len(staged_versions),
        "remote_version_count": len(remote_versions),
        "authorized_repairs": [],
        "production_mutation": False,
    }


def main() -> int:
    args = parse_args()
    try:
        report = load_report(Path(args.report))
        manifest = build_stage(report, Path(args.migrations_dir), Path(args.config), Path(args.stage_dir))
        manifest_path = Path(args.manifest)
        manifest_path.parent.mkdir(parents=True, exist_ok=True)
        manifest_path.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
        expected_path = Path(args.expected_versions)
        expected_path.parent.mkdir(parents=True, exist_ok=True)
        expected_path.write_text("\n".join(manifest["expected_worker_engine_versions"]) + "\n", encoding="utf-8")
        print("WORKER ENGINE LEDGER-ALIGNED DRY-RUN STAGE READY")
        print("approved migrations:", len(manifest["approved_worker_engine_versions"]))
        print("pending approved migrations:", len(manifest["expected_worker_engine_versions"]))
        print("excluded unrelated repository-only:", len(manifest["excluded_unrelated_repository_only"]))
        print("production-only placeholders:", len(manifest["production_only_placeholders"]))
        print("identity collision placeholders:", len(manifest["identity_collision_placeholders"]))
        print("staged versions:", manifest["staged_version_count"])
        return 0
    except (StageFailure, json.JSONDecodeError) as exc:
        print("WORKER ENGINE LEDGER-ALIGNED DRY-RUN STAGE BLOCKED")
        print(str(exc))
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
