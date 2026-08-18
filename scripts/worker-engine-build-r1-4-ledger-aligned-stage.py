#!/usr/bin/env python3
"""R1.4 production-promotion wrapper for the generic Worker Engine ledger-aligned stage builder.

This deliberately narrows the approved promotion set to the forward-only R1.4
reconciliation/closure sequence. Historical R1.3X repository-only migrations that
were superseded by the 20260818111900 reconciliation bridge are therefore excluded
from the ephemeral production stage rather than pushed to production.
"""
from __future__ import annotations

import importlib.util
from pathlib import Path

BASE = Path(__file__).with_name("worker-engine-build-ledger-aligned-stage.py")
spec = importlib.util.spec_from_file_location("worker_engine_stage_builder", BASE)
assert spec and spec.loader
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)

R1_4_PRODUCTION_VERSIONS = {
    "20260818111900",
    "20260818112000",
    "20260818112100",
    "20260818112200",
    "20260818112300",
    "20260818112400",
    "20260818112500",
    "20260818112600",
    "20260818112700",
    "20260818112800",
    "20260818112900",
    "20260818113000",
}

SUPERSEDED_R1_3X_REPOSITORY_ONLY = {
    "20260815091000",
    "20260815092000",
    "20260815093000",
    "20260815094000",
    "20260815095000",
    "20260815110000",
    "20260815111000",
    "20260815120000",
    "20260815130000",
    "20260815133000",
}


def configure_r1_4_scope() -> None:
    if R1_4_PRODUCTION_VERSIONS & SUPERSEDED_R1_3X_REPOSITORY_ONLY:
        raise RuntimeError("R1.4 certified set overlaps superseded R1.3X history")
    module.APPROVED_WORKER_ENGINE_VERSIONS = set(R1_4_PRODUCTION_VERSIONS)


def main() -> int:
    configure_r1_4_scope()
    return module.main()


if __name__ == "__main__":
    raise SystemExit(main())
