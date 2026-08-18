#!/usr/bin/env python3
"""Build the ledger-aligned Worker Engine R1.4 production recovery stage.

Production contains historical migration identities that cannot be inferred from version
set membership alone. In particular, version 20260815130100 is recorded in production
as create_open_schools_kenya_kibera_batch1 while repository history uses that version
for the R1.4 compensation foundation. Applied production history is immutable.

The recovery therefore treats the collided version as historical parity only and
requires a forward-only replacement migration before the R1.4 closure chain.
"""
from __future__ import annotations

import importlib.util
from pathlib import Path

BASE = Path(__file__).with_name("worker-engine-build-ledger-aligned-stage.py")
spec = importlib.util.spec_from_file_location("worker_engine_stage_builder", BASE)
assert spec and spec.loader
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)

START_VERSION = "20260815090500"
END_VERSION = "20260818113000"
PARITY_BRIDGE = "20260818111900"
COMPENSATION_COLLISION_VERSION = "20260815130100"
COMPENSATION_REPAIR_VERSION = "20260818111950"
REQUIRED_FOUNDATIONS = {
    "20260815090500",
    "20260815091000",
    "20260815092000",
    "20260815092500",
    "20260815093000",
    "20260815094000",
    "20260815095000",
    "20260815121500",
    "20260815123000",
}
REQUIRED_CLOSURE = {COMPENSATION_REPAIR_VERSION, "20260818112000", "20260818113000"}


def discover_recovery_versions(migrations_dir: Path) -> set[str]:
    versions: set[str] = set()
    for path in migrations_dir.glob("*.sql"):
        name = path.name.lower()
        version = path.name.split("_", 1)[0]
        if not version.isdigit():
            continue
        if START_VERSION <= version <= END_VERSION and "worker_engine" in name:
            versions.add(version)
    missing = (REQUIRED_FOUNDATIONS | REQUIRED_CLOSURE | {PARITY_BRIDGE, COMPENSATION_COLLISION_VERSION}) - versions
    if missing:
        raise RuntimeError(f"recovery source chain incomplete: missing {sorted(missing)}")
    return versions


def configure_scope(migrations_dir: Path = Path("supabase/migrations")) -> set[str]:
    versions = discover_recovery_versions(migrations_dir)
    module.APPROVED_WORKER_ENGINE_VERSIONS = versions
    # The production ledger owns this timestamp with a different migration identity.
    # Stage an inert version placeholder instead of pretending the repository migration
    # is semantically equivalent. The missing semantics are restored at 18111950.
    module.VERSION_PLACEHOLDER_OVERRIDES = {
        COMPENSATION_COLLISION_VERSION: (
            "production identity=create_open_schools_kenya_kibera_batch1; "
            "repository identity=worker_engine_we_r1_4_compensation; "
            f"forward replacement={COMPENSATION_REPAIR_VERSION}"
        )
    }
    return versions


def main() -> int:
    configure_scope()
    return module.main()


if __name__ == "__main__":
    raise SystemExit(main())
