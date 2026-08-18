#!/usr/bin/env python3
"""Content Engine Gate 1 wrapper for the certified ledger-aligned Supabase stage builder.

This intentionally approves only the repository-certified Content Factory R1/R2.1/R2.2
schema set required to close production parity. It does not activate Worker Engine runtime,
Content Engine autonomy, model authority, or publishing authority.
"""
from __future__ import annotations

import importlib.util
from pathlib import Path

BASE = Path(__file__).with_name("worker-engine-build-ledger-aligned-stage.py")
spec = importlib.util.spec_from_file_location("ledger_aligned_stage_builder", BASE)
assert spec and spec.loader
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)

CONTENT_ENGINE_GATE1_VERSIONS = {
    "20260818114500",  # Content Factory R1 throughput/remediation closure
    "20260818130850",  # curriculum intelligence source repository parity
    "20260818130900",  # curriculum research queue repository parity
    "20260818131000",  # R2.1 governed Research Worker bridge
    "20260818131100",  # R2.1 semantic evidence trust hardening
    "20260818131200",  # R2.2 semantic verifier
    "20260818131210",  # R2.2 immutable material binding
}


def configure_scope() -> None:
    # The generic builder stages exactly production history plus the approved local-only set.
    # Reusing it avoids a second migration-history implementation while retaining a narrow,
    # explicit Content Engine production allowlist.
    module.APPROVED_WORKER_ENGINE_VERSIONS = set(CONTENT_ENGINE_GATE1_VERSIONS)


def main() -> int:
    configure_scope()
    return module.main()


if __name__ == "__main__":
    raise SystemExit(main())
