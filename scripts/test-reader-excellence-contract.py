#!/usr/bin/env python3
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def read(path: str) -> str:
    value = ROOT / path
    if not value.is_file():
        raise AssertionError(f"missing reader contract file: {path}")
    return value.read_text(encoding="utf-8")


def require(text: str, needle: str, label: str) -> None:
    if needle not in text:
        raise AssertionError(f"{label}: missing {needle!r}")


def forbid(text: str, needle: str, label: str) -> None:
    if needle in text:
        raise AssertionError(f"{label}: forbidden {needle!r}")


def main() -> int:
    layout = read("app/read/textbook/[publicationId]/layout.tsx")
    page = read("app/read/textbook/[publicationId]/page.tsx")
    shell = read("components/read/ReaderExcellenceShell.tsx")
    continuity = read("components/read/ReaderContinuityCoordinator.tsx")
    listen = read("components/read/ReaderListenContinuity.tsx")
    study = read("components/read/ReaderStudyInteractions.tsx")
    annotations = read("components/read/ReaderAnnotationManager.tsx")
    explainer = read("components/read/ReaderTermExplainer.tsx")
    search = read("lib/read/readerSearch.ts")
    sw = read("public/sw.js")
    anchor_migration = read("supabase/migrations/20260818071500_reader_durable_annotation_anchors.sql")
    glossary_migration = read("supabase/migrations/20260818075500_reader_governed_bilingual_glossary.sql")

    # One canonical reader, explicit modes and product-core controls.
    for value in [
        "<ReaderExcellenceShell />",
        "<ReaderListenContinuity publicationId={params.publicationId} />",
        "<ReaderContinuityCoordinator />",
        "<ReaderStudyInteractions />",
        "<ReaderTermExplainer />",
        "<ReaderAnnotationManager />",
        "<ReaderModeController />",
    ]:
        require(layout, value, "reader layout")

    # Reading comfort and low-end/mobile accessibility basics.
    for value in [
        "Paper",
        "Light",
        "Dark",
        "Contrast",
        "@media (max-width: 520px)",
        "@media (prefers-reduced-motion: reduce)",
        "aria-label=\"Reading controls\"",
        "Voice quality depends on the phone and browser",
    ]:
        require(shell, value, "reader comfort")

    # Progress may queue offline, but only provisional state is local. Reconnect
    # must go back through canonical server authority and sign-out clears it.
    for value in [
        "vibeschool.reader.pending-progress.v1",
        "viewerId",
        "record_reading_progress",
        "reader_continuity_v2",
        'window.addEventListener("online", onOnline)',
        'window.addEventListener("offline", onOffline)',
        'event === "SIGNED_OUT"',
        "writePendingProgress([])",
        "Offline · progress will sync when connected",
    ]:
        require(continuity, value, "reader reconnect")

    # The service worker must remain public-shell-only. Reader/API/auth data is
    # network-owned; paid bytes must never become accidentally durable cache.
    for value in [
        "SAFE_PUBLIC_ROUTES",
        "url.pathname.startsWith('/api/')",
        "url.pathname.startsWith('/auth/')",
        "event.request.mode === 'navigate' && SAFE_PUBLIC_PATHS.has(url.pathname)",
    ]:
        require(sw, value, "service worker boundary")
    forbid(sw, "'/read/textbook", "service worker paid reader cache")
    forbid(sw, "url.pathname.startsWith('/read')", "service worker reader cache")
    forbid(sw, "supabase", "service worker Supabase cache")

    # Durable study identity and truthful cross-browser compatibility.
    for value in [
        "data-reader-block-id",
        "startOffset",
        "endOffset",
        "Cross-block",
    ]:
        require(study, value, "study anchors")
    for value in [
        "delete_study_workspace_item",
        "upsert_study_workspace_item",
        "data-reader-annotation-overlay",
        "Anchored",
        "Legacy",
    ]:
        require(annotations, value, "annotation management")
    for value in ["block_id", "start_offset", "end_offset", "anchor_version"]:
        require(anchor_migration, value, "annotation migration")

    # Definitions are source-governed and entitlement-aware, never fabricated.
    for value in [
        "get_reader_term_explanation",
        "no_verified_definition",
        "source_label",
        "can_viewer_read_chapter",
        "-- access: service-only",
        "-- authorization-test:",
    ]:
        require(glossary_migration, value, "governed glossary")
    for value in ["Explain EN / SW", "No verified definition", "source_label"]:
        require(explainer, value, "reader explainer")

    # Search remains entitled/local and compatible with this repository's target.
    require(search, "if (!chapter.can_read) continue", "entitled search")
    require(search, "matchKind", "strong search")
    require(search, "normalized.split(/[^a-z0-9]+/)", "target-safe tokenizer")
    forbid(search, "\\p{L}", "target-safe tokenizer")
    forbid(search, "/u)", "target-safe tokenizer")
    require(page, 'aria-label="Search this textbook"', "search accessibility")

    # Listening state is canonical-content based, not vendor/audio-file based.
    for value in ["publicationId", "chapterId", "blockId", "localStorage"]:
        require(listen, value, "listen continuity")

    print("READER EXCELLENCE CONTRACT PASSED")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
