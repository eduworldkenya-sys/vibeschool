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
 layout=read("app/read/textbook/[publicationId]/layout.tsx");page=read("app/read/textbook/[publicationId]/page.tsx");sheet=read("components/read/ReaderLearningSheet.tsx");sheet_css=read("components/read/ReaderLearningSheet.module.css");panel=read("components/read/LearningTransformPanel.tsx");narrator=read("components/read/useReaderNarrator.ts");normalizer=read("lib/read/readerNarration.ts");access=read("lib/student/learningTransformAccess.ts");analytics=read("components/read/ReadingAnalyticsTracker.tsx");continuity=read("components/read/ReaderContinuityCoordinator.tsx");listen=read("components/read/ReaderListenContinuity.tsx");study=read("components/read/ReaderStudyInteractions.tsx");annotations=read("components/read/ReaderAnnotationManager.tsx");explainer=read("components/read/ReaderTermExplainer.tsx");search=read("lib/read/readerSearch.ts");sw=read("public/sw.js");purchase=read("components/read/ReaderPurchaseBar.tsx")
 for v in ["<ReadingAnalyticsTracker/>","<ReaderListenContinuity publicationId={params.publicationId}/>","<ReaderContinuityCoordinator/>","<ReaderStudyInteractions/>","<ReaderTermExplainer/>","<ReaderAnnotationManager/>","<ReaderPurchaseBar publicationId={params.publicationId}/>","<ReaderAssessmentLauncher/>"]: require(layout,v,"canonical reader capability")
 forbid(layout,"<ReaderLearningLauncher/>","single learning surface")
 for v in ["Contents","What you’ll learn","ReaderLearningSheet","ReaderNarrationMiniPlayer","Text size","Focus reading","data-reader-block-id","record_reading_progress","vibe:reader-chapter"]: require(page,v,"flagship reader")
 for v in ["ReaderCalmSurface","ReaderHumanFirstPolish","ReaderExcellenceShell","ReaderModeController","ReaderSecondaryToolsDrawer"]: forbid(layout,v,"legacy wrapper retirement")
 for v in ["Reading tools","Learn","Practice","Listen","vibeReaderSheet","safe-area-inset-bottom"]: require(sheet+sheet_css,v,"unified learning sheet")
 for v in ["quiz","flashcards","workedExamples","visualSteps","Recommended for you","friendlyError"]: require(panel,v,"learning transformation UX")
 require(access,"current_student_id","learner authority preflight");forbid(panel,"Edge Function returned","learner-safe errors")
 for v in ["SpeechSynthesisUtterance","voiceschanged","pause","resume","startAtElementId"]: require(narrator,v,"natural narrator")
 for v in ["normalizeNarrationText","chunkNarrationText","en-ke","degrees Celsius","percent"]: require(normalizer,v,"narration normalization")
 forbid(page,"Math.max(active.progress_percent??0,10)","truthful progress");forbid(analytics,"progressPercent ?? 10","truthful analytics")
 for v in ["vibeschool.reader.pending-progress.v1","record_reading_progress","reader_continuity_v2"]: require(continuity,v,"continuity")
 for v in ["data-reader-block-id","startOffset","endOffset"]: require(study,v,"study anchors")
 for v in ["delete_study_workspace_item","upsert_study_workspace_item","data-reader-annotation-overlay"]: require(annotations,v,"annotations")
 for v in ["Explain EN / SW","No verified definition"]: require(explainer,v,"term explainer")
 require(search,"if (!chapter.can_read) continue","entitled search");require(listen,"localStorage","listen continuity");require(listen,"vibe:reader-resume-listening","listen continuity event");require(purchase,"Unlock with M-Pesa","commerce")
 for v in ["SAFE_PUBLIC_ROUTES","url.pathname.startsWith('/api/')","url.pathname.startsWith('/auth/')"]: require(sw,v,"service worker boundary")
 forbid(sw,"'/read/textbook","paid reader cache");forbid(sw,"url.pathname.startsWith('/read')","reader cache")
 print("READER EXCELLENCE CONTRACT PASSED");return 0
if __name__=="__main__": raise SystemExit(main())
