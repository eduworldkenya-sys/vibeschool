#!/usr/bin/env python3
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
PAGE=(ROOT/"app/read/textbook/[publicationId]/page.tsx").read_text(encoding="utf-8")
CHAPTER_PAGE=(ROOT/"app/read/textbook/[publicationId]/[chapterId]/page.tsx").read_text(encoding="utf-8")
SERVER=(ROOT/"app/read/textbook/[publicationId]/readerServer.ts").read_text(encoding="utf-8")
CLIENT=(ROOT/"app/read/textbook/[publicationId]/ReaderClient.tsx").read_text(encoding="utf-8")
READER=PAGE+CHAPTER_PAGE+SERVER+CLIENT
LAYOUT=(ROOT/"app/read/textbook/[publicationId]/layout.tsx").read_text(encoding="utf-8")
SHEET=(ROOT/"components/read/ReaderLearningSheet.tsx").read_text(encoding="utf-8")
CSS=(ROOT/"components/read/ReaderLearningSheet.module.css").read_text(encoding="utf-8")
for forbidden in ["ReaderCalmSurface","ReaderHumanFirstPolish","ReaderExcellenceShell","ReaderModeController","ReaderLearningLauncher"]:
    if forbidden in LAYOUT: raise AssertionError(f"legacy/competing reader layer still mounted: {forbidden}")
for required in ['position:"sticky"','Contents','ReaderLearningSheet','ReaderNarrationMiniPlayer','width:"min(calc(100% - 36px),700px)"']:
    if required not in READER: raise AssertionError(f"missing flagship reader invariant: {required}")
if '"use client"' in PAGE or '"use client"' in CHAPTER_PAGE: raise AssertionError("reader route regressed to client-only rendering")
if 'get_public_vibetextbook_reader' not in SERVER: raise AssertionError("reader route no longer server-loads public content")
if 'initialPayload' not in CHAPTER_PAGE: raise AssertionError("canonical chapter route no longer hydrates from server payload")
for required in ['Reading tools','Learn','Practice','Listen','Text size','Focus reading','safe-area-inset-bottom','vibeReaderSheet','Escape','Tab']:
    target=SHEET+CSS
    if required not in target: raise AssertionError(f"missing responsive learning-sheet invariant: {required}")
for required in ['@media (min-width:768px)','@media (min-width:1100px)','orientation:landscape']:
    if required not in CSS: raise AssertionError(f"missing responsive breakpoint: {required}")
for forbidden in ['position:"fixed",right:16,bottom:82','reader-excellence-bar','ABOUT THIS UNIT','Listen to this unit']:
    if forbidden in READER: raise AssertionError(f"obsolete obstructive UI survived: {forbidden}")
print("READER FLAGSHIP MOBILE CONTRACT PASSED")
