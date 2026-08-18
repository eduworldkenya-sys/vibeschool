import type { Metadata } from "next";
import type { ReactNode } from "react";
import { StudyCapturePanel } from "@/components/read/StudyCapturePanel";
import { ReadingAnalyticsTracker } from "@/components/read/ReadingAnalyticsTracker";
import { ReaderExcellenceShell } from "@/components/read/ReaderExcellenceShell";
import { ReaderContinuityCoordinator } from "@/components/read/ReaderContinuityCoordinator";
import { ReaderStudyInteractions } from "@/components/read/ReaderStudyInteractions";
import { ReaderAnnotationManager } from "@/components/read/ReaderAnnotationManager";
import { ReaderTermExplainer } from "@/components/read/ReaderTermExplainer";
import { ReaderSecondaryToolsDrawer } from "@/components/read/ReaderSecondaryToolsDrawer";
import { ReaderModeController } from "@/components/read/ReaderModeController";
import { ReaderAssessmentLauncher } from "@/components/read/ReaderAssessmentLauncher";
import { ReaderLearningLauncher } from "@/components/read/ReaderLearningLauncher";
import { ReaderPurchaseBar } from "@/components/read/ReaderPurchaseBar";
import { TeacherContentDeriveLauncher } from "@/components/read/TeacherContentDeriveLauncher";
import { TeacherMaterialLauncher } from "@/components/read/TeacherMaterialLauncher";
import { getSupabaseServerClient } from "@/lib/supabaseServer";

const SITE_URL = "https://www.vibeschool.co.ke";

type PublicationMetadata = {
  id: string;
  title: string | null;
  description: string | null;
  cover_url: string | null;
  cbc_subject: string | null;
  cbc_grade: string | null;
  status: string | null;
  published_at: string | null;
  updated_at: string | null;
};

async function getPublishedPublication(publicationId: string): Promise<PublicationMetadata | null> {
  try {
    const supabase = getSupabaseServerClient();
    const { data } = await supabase
      .from("vibe_publications")
      .select("id,title,description,cover_url,cbc_subject,cbc_grade,status,published_at,updated_at")
      .eq("id", publicationId)
      .maybeSingle();

    const publication = data as PublicationMetadata | null;
    return publication?.status === "published" ? publication : null;
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: { params: { publicationId: string } }): Promise<Metadata> {
  const publication = await getPublishedPublication(params.publicationId);
  if (!publication) return { title: "VibeSchool Textbook", robots: { index: false, follow: false } };

  const title = publication.title?.trim() || "VibeSchool Textbook";
  const description = publication.description?.trim() || [publication.cbc_grade, publication.cbc_subject].filter(Boolean).join(" · ") || "A published educational resource from VibeSchool.";
  const canonical = `${SITE_URL}/read/textbook/${publication.id}`;

  return {
    title, description, alternates: { canonical }, robots: { index: true, follow: true },
    openGraph: {
      type: "book", url: canonical, title, description, siteName: "VibeSchool", locale: "en_KE",
      ...(publication.cover_url ? { images: [{ url: publication.cover_url, alt: title }] } : {}),
    },
  };
}

export default async function TextbookReaderLayout({ children, params }: { children: ReactNode; params: { publicationId: string } }) {
  const publication = await getPublishedPublication(params.publicationId);
  const title = publication?.title?.trim() || "VibeSchool Textbook";
  const description = publication?.description?.trim() || [publication?.cbc_grade, publication?.cbc_subject].filter(Boolean).join(" · ") || "A published educational resource from VibeSchool.";
  const canonical = `${SITE_URL}/read/textbook/${params.publicationId}`;

  const bookSchema = publication ? {
    "@context": "https://schema.org", "@type": "Book", "@id": `${canonical}#book`, name: title,
    description, url: canonical, inLanguage: "en-KE",
    publisher: { "@type": "EducationalOrganization", name: "VibeSchool", url: SITE_URL },
    ...(publication.cover_url ? { image: publication.cover_url } : {}),
    ...(publication.published_at ? { datePublished: publication.published_at } : {}),
    ...(publication.updated_at ? { dateModified: publication.updated_at } : {}),
    ...(publication.cbc_grade ? { educationalLevel: publication.cbc_grade } : {}),
    ...(publication.cbc_subject ? { about: publication.cbc_subject } : {}),
    mainEntityOfPage: { "@type": "WebPage", "@id": canonical },
  } : null;

  return (
    <div id="vibetextbook-reader-shell" data-reader-mode="read">
      {bookSchema ? <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(bookSchema) }} /> : null}
      <ReadingAnalyticsTracker />
      <ReaderExcellenceShell />
      <ReaderModeController />
      <div id="vibetextbook-reading-content" tabIndex={-1}>
        <ReaderContinuityCoordinator />
        <ReaderStudyInteractions />
        <ReaderTermExplainer />
        <ReaderAnnotationManager />
        <ReaderSecondaryToolsDrawer />
        {children}
      </div>
      <StudyCapturePanel publicationId={params.publicationId} />
      <ReaderPurchaseBar publicationId={params.publicationId} />
      <ReaderLearningLauncher />
      <ReaderAssessmentLauncher />
      <TeacherMaterialLauncher />
      <TeacherContentDeriveLauncher />
    </div>
  );
}
