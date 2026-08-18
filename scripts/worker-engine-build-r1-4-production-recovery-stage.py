#!/usr/bin/env python3
"""Build the ledger-aligned Worker Engine R1.4 production recovery stage.

Production contains a superseded R1.3X generation whose migration source files are no
longer in repository history. The canonical repair is now represented by two real,
repository-tracked convergence migrations (150905 and 150925), so the protected
recovery stage contains no synthetic SQL injection and no fabricated ledger version.
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
REQUIRED_FOUNDATIONS = {
    "20260815090500",  # historical production-only R1.3X lineage quarantine
    "20260815091000",  # capability + competency graph
    "20260815092000",  # resource registry/resolver
    "20260815092500",  # deterministic historical evidence preservation
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


def configure_scope(migrations_dir: Path = Path("supabase/migrations")) -> set[str]:
    versions = discover_recovery_versions(migrations_dir)
    module.APPROVED_WORKER_ENGINE_VERSIONS = versions
    return versions


def main() -> int:
    configure_scope()
    return module.main()


if __name__ == "__main__":
    raise SystemExit(main())
