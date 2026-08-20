#!/usr/bin/env python3
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
def read(path):
 p=ROOT/path
 if not p.is_file(): raise AssertionError(f"missing reader contract file: {path}")
 return p.read_text(encoding="utf-8")
def require(text,needle,label):
 if needle not in text: raise AssertionError(f"{label}: missing {needle!r}")
def forbid(text,needle,label):
 if needle in text: raise AssertionError(f"{label}: forbidden {needle!r}")
def main():
 layout=read("app/read/textbook/[publicationId]/layout.tsx");page=read("app/read/textbook/[publicationId]/page.tsx");continuity=read("components/read/ReaderContinuityCoordinator.tsx");listen=read("components/read/ReaderListenContinuity.tsx");study=read("components/read/ReaderStudyInteractions.tsx");annotations=read("components/read/ReaderAnnotationManager.tsx");explainer=read("components/read/ReaderTermExplainer.tsx");search=read("lib/read/readerSearch.ts");sw=read("public/sw.js");purchase=read("components/read/ReaderPurchaseBar.tsx")
 for v in ["<ReadingAnalyticsTracker/>","<ReaderListenContinuity publicationId={params.publicationId}/>","<ReaderContinuityCoordinator/>","<ReaderStudyInteractions/>","<ReaderTermExplainer/>","<ReaderAnnotationManager/>","<ReaderPurchaseBar publicationId={params.publicationId}/>","<ReaderLearningLauncher/>","<ReaderAssessmentLauncher/>"]: require(layout,v,"canonical reader capability")
 for v in ["Contents","What you’ll learn","Reading tools","Learn with Twin","Practice this unit","Listen to this unit","Text size","Focus reading","data-reader-block-id","record_reading_progress","vibe:reader-chapter"]: require(page,v,"flagship reader")
 for v in ["ReaderCalmSurface","ReaderHumanFirstPolish","ReaderExcellenceShell","ReaderModeController","ReaderSecondaryToolsDrawer"]: forbid(layout,v,"legacy wrapper retirement")
 for v in ["vibeschool.reader.pending-progress.v1","record_reading_progress","reader_continuity_v2"]: require(continuity,v,"continuity")
 for v in ["data-reader-block-id","startOffset","endOffset"]: require(study,v,"study anchors")
 for v in ["delete_study_workspace_item","upsert_study_workspace_item","data-reader-annotation-overlay"]: require(annotations,v,"annotations")
 for v in ["Explain EN / SW","No verified definition"]: require(explainer,v,"term explainer")
 require(search,"if (!chapter.can_read) continue","entitled search");require(listen,"localStorage","listen continuity");require(purchase,"Unlock with M-Pesa","commerce")
 for v in ["SAFE_PUBLIC_ROUTES","url.pathname.startsWith('/api/')","url.pathname.startsWith('/auth/')"]: require(sw,v,"service worker boundary")
 forbid(sw,"'/read/textbook","paid reader cache");forbid(sw,"url.pathname.startsWith('/read')","reader cache")
 print("READER EXCELLENCE CONTRACT PASSED");return 0
if __name__=="__main__": raise SystemExit(main())
