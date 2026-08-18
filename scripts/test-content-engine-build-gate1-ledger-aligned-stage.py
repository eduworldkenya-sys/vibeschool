#!/usr/bin/env python3
from __future__ import annotations

import importlib.util
from pathlib import Path

TARGET = Path(__file__).with_name("content-engine-build-gate1-ledger-aligned-stage.py")
spec = importlib.util.spec_from_file_location("content_engine_gate1", TARGET)
assert spec and spec.loader
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)

EXPECTED = {
    "20260818114500",
    "20260818130850",
    "20260818130900",
    "20260818131000",
    "20260818131100",
    "20260818131200",
    "20260818131210",
}

assert module.CONTENT_ENGINE_GATE1_VERSIONS == EXPECTED
assert len(module.CONTENT_ENGINE_GATE1_VERSIONS) == 7
assert all(v.isdigit() and len(v) == 14 for v in module.CONTENT_ENGINE_GATE1_VERSIONS)

module.configure_scope()
assert module.module.APPROVED_WORKER_ENGINE_VERSIONS == EXPECTED

print("CONTENT ENGINE GATE1 LEDGER-ALIGNED STAGE CONTRACT PASS")
