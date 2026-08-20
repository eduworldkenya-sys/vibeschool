#!/usr/bin/env python3
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
PAGE=(ROOT/"app/read/textbook/[publicationId]/page.tsx").read_text(encoding="utf-8")
LAYOUT=(ROOT/"app/read/textbook/[publicationId]/layout.tsx").read_text(encoding="utf-8")
for forbidden in ["ReaderCalmSurface","ReaderHumanFirstPolish","ReaderExcellenceShell","ReaderModeController"]:
    if forbidden in LAYOUT: raise AssertionError(f"legacy reader layer still mounted: {forbidden}")
for required in ['position:"sticky"','Contents','Reading tools','Learn with Twin','Practice this unit','Listen to this unit','Text size','Focus reading','width:"min(calc(100% - 36px),700px)"','padding:"20px 18px calc(22px + env(safe-area-inset-bottom))"']:
    if required not in PAGE: raise AssertionError(f"missing flagship mobile invariant: {required}")
for forbidden in ['position:"fixed",right:16,bottom:82','reader-excellence-bar','ABOUT THIS UNIT']:
    if forbidden in PAGE: raise AssertionError(f"obsolete obstructive UI survived: {forbidden}")
print("READER FLAGSHIP MOBILE CONTRACT PASSED")
