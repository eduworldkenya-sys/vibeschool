import type { ReactNode } from "react";
import { StudyCapturePanel } from "@/components/read/StudyCapturePanel";
import { ReaderStudyViewControls } from "@/components/read/ReaderStudyViewControls";
import { ReadingAnalyticsTracker } from "@/components/read/ReadingAnalyticsTracker";
import { ReaderAssessmentLauncher } from "@/components/read/ReaderAssessmentLauncher";
import { ReaderLearningLauncher } from "@/components/read/ReaderLearningLauncher";
import { TeacherContentDeriveLauncher } from "@/components/read/TeacherContentDeriveLauncher";
import { TeacherMaterialLauncher } from "@/components/read/TeacherMaterialLauncher";

export default function TextbookReaderLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: { publicationId: string };
}) {
  return (
    <div id="vibetextbook-reader-shell">
      <ReaderStudyViewControls />
      <ReadingAnalyticsTracker />
      <div id="vibetextbook-reading-content" tabIndex={-1}>
        {children}
      </div>
      <StudyCapturePanel publicationId={params.publicationId} />
      <ReaderLearningLauncher />
      <ReaderAssessmentLauncher />
      <TeacherMaterialLauncher />
      <TeacherContentDeriveLauncher />
    </div>
  );
}
