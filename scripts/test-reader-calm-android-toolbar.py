#!/usr/bin/env python3
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CALM = (ROOT / "components/read/ReaderCalmSurface.tsx").read_text(encoding="utf-8")

if 'className="reader-calm-toolbar reader-excellence-ui"' in CALM:
    raise AssertionError("calm toolbar must not inherit reader-excellence-ui bottom positioning")

for needle in [
    'className="reader-calm-toolbar"',
    'bottom: auto;',
    'height: auto;',
    'min-height: 0;',
    'top: max(10px, env(safe-area-inset-top));',
]:
    if needle not in CALM:
        raise AssertionError(f"missing Android toolbar invariant: {needle}")

print("READER CALM ANDROID TOOLBAR CONTRACT PASSED")
