#!/usr/bin/env python3
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
def read(path:str)->str:
    value=ROOT/path
    if not value.is_file(): raise AssertionError(f"missing reader contract file: {path}")
    return value.read_text(encoding="utf-8")
def require(text:str,needle:str,label:str)->None:
    if needle not in text: raise AssertionError(f"{label}: missing {needle!r}")
def forbid(text:str,needle:str,label:str)->None:
    if needle in text: raise AssertionError(f"{label}: forbidden {needle!r}")
def main()->int:
    layout=read("app/read/textbook/[publicationId]/layout.tsx");page=read("app/read/textbook/[publicationId]/page.tsx");purchase_page=read("app/learn/purchase/[publicationId]/page.tsx");purchase_bar=read("components/read/ReaderPurchaseBar.tsx");accessibility=read("components/read/ReaderAccessibilityStyles.tsx");shell=read("components/read/ReaderExcellenceShell.tsx");calm=read("components/read/ReaderCalmSurface.tsx");continuity=read("components/read/ReaderContinuityCoordinator.tsx");listen=read("components/read/ReaderListenContinuity.tsx");study=read("components/read/ReaderStudyInteractions.tsx");annotations=read("components/read/ReaderAnnotationManager.tsx");explainer=read("components/read/ReaderTermExplainer.tsx");search=read("lib/read/readerSearch.ts");sw=read("public/sw.js");anchor_migration=read("supabase/migrations/20260818071500_reader_durable_annotation_anchors.sql");glossary_migration=read("supabase/migrations/20260818075500_reader_governed_bilingual_glossary.sql");commerce_migration=read("supabase/migrations/20260818043000_learning_product_commerce_spine_v1.sql");commerce_verify=read("scripts/sql/learning_product_commerce_verify.sql")
    for value in ["<ReaderAccessibilityStyles />","<ReaderExcellenceShell />","<ReaderCalmSurface />","<ReaderListenContinuity publicationId={params.publicationId} />","<ReaderContinuityCoordinator />","<ReaderStudyInteractions />","<ReaderTermExplainer />","<ReaderAnnotationManager />","<ReaderModeController />","<ReaderPurchaseBar publicationId={params.publicationId} />"]: require(layout,value,"reader layout")
    for value in ["reader-calm-active",'data-reader-contents="true"',"#vibetextbook-reading-content main>:not(#reader-active-unit)",".reader-mode-switcher",".reader-practice-button","Contents","More reader options","Practice this topic","Get help","Notes & highlights","Focus mode",'window.dispatchEvent(new CustomEvent("vibe:reader-help"))']: require(calm,value,"human-first reader hierarchy")
    for value in ["min-height: 44px",":focus-visible","outline: 3px solid var(--reader-accent","@media (max-width: 380px)","@media (prefers-reduced-motion: reduce)","animation-duration: 0.01ms"]: require(accessibility,value,"reader accessibility baseline")
    for value in ["Paper","Light","Dark","Contrast","@media (max-width: 520px)","@media (prefers-reduced-motion: reduce)",'aria-label="Reading controls"',"Voice quality depends on the phone and browser"]: require(shell,value,"reader comfort")
    for value in ["vibeschool.reader.pending-progress.v1","viewerId","record_reading_progress","reader_continuity_v2",'window.addEventListener("online", onOnline)','window.addEventListener("offline", onOffline)','event === "SIGNED_OUT"',"writePendingProgress([])","Offline · progress will sync when connected"]: require(continuity,value,"reader reconnect")
    for value in ["SAFE_PUBLIC_ROUTES","url.pathname.startsWith('/api/')","url.pathname.startsWith('/auth/')","event.request.mode === 'navigate' && SAFE_PUBLIC_PATHS.has(url.pathname)"]: require(sw,value,"service worker boundary")
    forbid(sw,"'/read/textbook","service worker paid reader cache");forbid(sw,"url.pathname.startsWith('/read')","service worker reader cache");forbid(sw,"supabase","service worker Supabase cache")
    for value in ["data-reader-block-id","startOffset","endOffset","startBlock !== endBlock"]: require(study,value,"study anchors")
    for value in ["delete_study_workspace_item","upsert_study_workspace_item","data-reader-annotation-overlay","Anchored","Legacy"]: require(annotations,value,"annotation management")
    for value in ["block_id","start_offset","end_offset","anchor_version"]: require(anchor_migration,value,"annotation migration")
    for value in ["get_reader_term_explanation","no_verified_definition","source_label","can_viewer_read_chapter","-- access: service-only","-- authorization-test:"]: require(glossary_migration,value,"governed glossary")
    for value in ["Explain EN / SW","No verified definition","source_label"]: require(explainer,value,"reader explainer")
    require(search,"if (!chapter.can_read) continue","entitled search");require(search,"matchKind","strong search");require(search,"normalized.split(/[^a-z0-9]+/)","target-safe tokenizer");forbid(search,"\\p{L}","target-safe tokenizer");forbid(search,"/u)","target-safe tokenizer");require(page,'aria-label="Search this textbook"',"search accessibility")
    for value in ["publicationId","chapterId","blockId","localStorage"]: require(listen,value,"listen continuity")
    for value in ["commerce_get_publication_purchase_context","context.already_entitled","`/learn/purchase/${publicationId}`","Unlock with M-Pesa"]: require(purchase_bar,value,"reader purchase handoff")
    for value in ['supabase.functions.invoke("learning-product-stk-push"','state === "settled"',"handleSettlement","router.replace(`/read/textbook/${publicationId}`)","newIdempotencyKey","reconciliation_required"]: require(purchase_page,value,"purchase return path")
    for value in ["commerce_fulfill_learning_product_order","learning_product_entitlements","entitlement_granted","amount_mismatch","duplicate_provider_receipt"]: require(commerce_migration,value,"durable commerce entitlement")
    for value in ["learning_product_entitlements","can_viewer_read_chapter","commerce_fulfill_learning_product_order"]: require(commerce_verify,value,"commerce verification")
    print("READER EXCELLENCE CONTRACT PASSED");return 0
if __name__=="__main__": raise SystemExit(main())
