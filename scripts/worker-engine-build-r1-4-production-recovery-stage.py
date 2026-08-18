#!/usr/bin/env python3
"""Build the ledger-aligned Worker Engine R1.4 production recovery stage.

After the first protected promotion legitimately applied 20260818111900, production
proved that the later R1.4 closure depends on historical Worker Engine foundations
that are still repository-only. Recovery therefore authorizes the actual repository
migration versions in the bounded Worker Engine interval and permits one explicit,
fail-closed transform inside the pending 20260815091000 staged copy to reconcile the
observed zero-row legacy relation-name collision. No synthetic migration version is
introduced into the production ledger.
"""
from __future__ import annotations

import importlib.util
from pathlib import Path

BASE = Path(__file__).with_name("worker-engine-build-ledger-aligned-stage.py")
LEGACY_COLLISION_REPAIR = Path(__file__).with_name(
    "worker-engine-r1-4-reconcile-legacy-capability-edge.sql"
)
TARGET_VERSION = "20260815091000"

spec = importlib.util.spec_from_file_location("worker_engine_stage_builder", BASE)
assert spec and spec.loader
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)

START_VERSION = TARGET_VERSION
END_VERSION = "20260818113000"
PARITY_BRIDGE = "20260818111900"
REQUIRED_FOUNDATIONS = {
    "20260815091000",  # capability + competency graph
    "20260815092000",  # resource registry/resolver
    "20260815093000",  # planning graph
    "20260815094000",  # plan simulation/selection
    "20260815095000",  # competency routing/collaboration
    "20260815121500",  # R1.4 capability authority
    "20260815123000",  # consequential execution gateway
}
REQUIRED_CLOSURE = {"20260818112000", "20260818113000"}


def discover_recovery_versions(migrations_dir: Path) -> set[str]:
    versions: set[str] = set()
    for path in migrations_dir.glob("*.sql"):
        name = path.name.lower()
        version = path.name.split("_", 1)[0]
        if not version.isdigit():
            continue
        if START_VERSION <= version <= END_VERSION and "worker_engine" in name:
            versions.add(version)
    missing = (REQUIRED_FOUNDATIONS | REQUIRED_CLOSURE | {PARITY_BRIDGE}) - versions
    if missing:
        raise RuntimeError(f"recovery source chain incomplete: missing {sorted(missing)}")
    return versions


def inject_legacy_collision_repair(stage_dir: Path) -> str:
    if not LEGACY_COLLISION_REPAIR.is_file():
        raise module.StageFailure(
            f"legacy capability-edge repair SQL missing: {LEGACY_COLLISION_REPAIR}"
        )
    candidates = list((stage_dir / "supabase" / "migrations").glob(f"{TARGET_VERSION}_*.sql"))
    if len(candidates) != 1:
        raise module.StageFailure(
            f"expected exactly one staged {TARGET_VERSION} migration, found {len(candidates)}"
        )
    target = candidates[0]
    repair = LEGACY_COLLISION_REPAIR.read_text(encoding="utf-8").rstrip() + "\n\n"
    original = target.read_text(encoding="utf-8")
    marker = "WE-R1.4 protected recovery prerequisite"
    if marker in original:
        raise module.StageFailure("legacy capability-edge repair already injected")
    target.write_text(repair + original, encoding="utf-8")
    return target.name


_original_build_stage = module.build_stage


def build_recovery_stage(report: dict, migrations_dir: Path, config_path: Path, stage_dir: Path) -> dict:
    manifest = _original_build_stage(report, migrations_dir, config_path, stage_dir)
    pending = set(manifest.get("expected_worker_engine_versions", []))
    if TARGET_VERSION in pending:
        transformed = inject_legacy_collision_repair(stage_dir)
        manifest["recovery_transforms"] = [
            {
                "version": TARGET_VERSION,
                "staged_file": transformed,
                "repair": "archive_exact_zero_row_legacy_skill_manifest_edge_name_collision",
                "synthetic_ledger_version": False,
            }
        ]
    else:
        manifest["recovery_transforms"] = []
    return manifest


def configure_scope(migrations_dir: Path = Path("supabase/migrations")) -> set[str]:
    versions = discover_recovery_versions(migrations_dir)
    module.APPROVED_WORKER_ENGINE_VERSIONS = versions
    module.build_stage = build_recovery_stage
    return versions


def main() -> int:
    configure_scope()
    return module.main()


if __name__ == "__main__":
    raise SystemExit(main())
