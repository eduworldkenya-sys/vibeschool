import type { Metadata } from "next";
import type { ReactNode } from "react";
import { createClient } from "@supabase/supabase-js";
import { StudyCapturePanel } from "@/components/read/StudyCapturePanel";
import { ReaderStudyViewControls } from "@/components/read/ReaderStudyViewControls";
import { ReadingAnalyticsTracker } from "@/components/read/ReadingAnalyticsTracker";
import { ReaderAssessmentLauncher } from "@/components/read/ReaderAssessmentLauncher";
import { ReaderLearningLauncher } from "@/components/read/ReaderLearningLauncher";
import { TeacherContentDeriveLauncher } from "@/components/read/TeacherContentDeriveLauncher";
import { TeacherMaterialLauncher } from "@/components/read/TeacherMaterialLauncher";

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

export async function generateMetadata({
  params,
}: {
  params: { publicationId: string };
}): Promise<Metadata> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    return {
      title: "VibeSchool Textbook",
      robots: { index: false, follow: false },
    };
  }

  const supabase = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data } = await supabase
    .from("vibe_publications")
    .select("id,title,description,cover_url,cbc_subject,cbc_grade,status,published_at,updated_at")
    .eq("id", params.publicationId)
    .maybeSingle();

  const publication = data as PublicationMetadata | null;

  if (!publication || publication.status !== "published") {
    return {
      title: "VibeSchool Textbook",
      robots: { index: false, follow: false },
    };
  }

  const title = publication.title?.trim() || "VibeSchool Textbook";
  const description =
    publication.description?.trim() ||
    [publication.cbc_grade, publication.cbc_subject]
      .filter(Boolean)
      .join(" · ") ||
    "A published educational resource from VibeSchool.";
  const canonical = `${SITE_URL}/read/textbook/${publication.id}`;

  return {
    title,
    description,
    alternates: { canonical },
    robots: { index: true, follow: true },
    openGraph: {
      type: "book",
      url: canonical,
      title,
      description,
      siteName: "VibeSchool",
      locale: "en_KE",
      ...(publication.cover_url
        ? { images: [{ url: publication.cover_url, alt: title }] }
        : {}),
    },
  };
}

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
