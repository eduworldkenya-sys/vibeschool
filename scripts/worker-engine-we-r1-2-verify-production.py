#!/usr/bin/env python3
"""Extend the read-only Worker Engine production verifier for WE-R1.2."""
from __future__ import annotations

import importlib.util
import json
from pathlib import Path

BASE_PATH = Path(__file__).with_name("worker-engine-verify-production-contract.py")
spec = importlib.util.spec_from_file_location("worker_engine_base_verifier", BASE_PATH)
assert spec and spec.loader
base = importlib.util.module_from_spec(spec)
spec.loader.exec_module(base)

WE_R1_2_VERSION = "20260814094000"
if WE_R1_2_VERSION not in base.APPROVED_VERSIONS:
    base.APPROVED_VERSIONS.append(WE_R1_2_VERSION)


def main() -> None:
    # Base verifier now sees all 23 certified versions and therefore extracts and
    # verifies WE-R1.2 tables/functions, RLS/grants, legacy bypass closure, and cron.
    base.main()

    rows = base.query("""
        select heartbeat_enabled,
               factory_enabled,
               runtime_execution_enabled,
               runtime_autonomy_level,
               runtime_max_risk,
               runtime_anomaly_paused
        from public.hq_workforce_engine_contract
        where singleton=true
    """)
    if len(rows) != 1:
        base.die(f"expected singleton WE-R1.2 runtime contract row, found {len(rows)}")
    state = rows[0]
    expected = {
        "heartbeat_enabled": False,
        "factory_enabled": False,
        "runtime_execution_enabled": False,
        "runtime_autonomy_level": 0,
        "runtime_max_risk": 0,
        "runtime_anomaly_paused": False,
    }
    mismatches = {key: state.get(key) for key, value in expected.items() if state.get(key) != value}
    if mismatches:
        base.die(f"WE-R1.2 runtime is not fail-closed: {mismatches}")

    evidence_path = base.EVIDENCE_PATH
    evidence = json.loads(evidence_path.read_text(encoding="utf-8"))
    evidence["checks"]["we_r1_2_runtime_fail_closed"] = {
        "status": "PASSED",
        **expected,
    }
    evidence_path.write_text(json.dumps(evidence, indent=2, sort_keys=True) + "\n", encoding="utf-8")

    print("WE-R1.2 PRODUCTION RUNTIME POLICY VERIFICATION PASSED")
    print("approved_migrations=23")
    print("runtime_execution_enabled=false")
    print("runtime_autonomy_level=0")
    print("runtime_max_risk=0")
    print("runtime_anomaly_paused=false")


if __name__ == "__main__":
    main()
