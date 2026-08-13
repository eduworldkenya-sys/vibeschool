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

const SITE = "https://www.vibeschool.co.ke";

type ReaderParams = { publicationId: string };

export async function generateMetadata({
  params,
}: {
  params: ReaderParams;
}): Promise<Metadata> {
  const canonical = `${SITE}/read/textbook/${params.publicationId}`;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    return {
      title: "VibeSchool Reader",
      robots: { index: false, follow: true },
      alternates: { canonical },
    };
  }

  const supabase = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: publication } = await supabase
    .from("vibe_publications")
    .select("title, subtitle, description, cover_url, published_at, updated_at")
    .eq("id", params.publicationId)
    .eq("format", "vibetextbook")
    .eq("status", "published")
    .maybeSingle();

  if (!publication) {
    return {
      title: "VibeSchool Reader",
      robots: { index: false, follow: true },
      alternates: { canonical },
    };
  }

  const title = publication.title || "VibeSchool Reader";
  const description =
    publication.description ||
    publication.subtitle ||
    `Read ${title} on VibeSchool.`;

  return {
    title,
    description,
    robots: { index: true, follow: true },
    alternates: { canonical },
    openGraph: {
      type: "article",
      url: canonical,
      siteName: "VibeSchool",
      title,
      description,
      publishedTime: publication.published_at || undefined,
      modifiedTime: publication.updated_at || undefined,
      images: publication.cover_url ? [{ url: publication.cover_url }] : undefined,
    },
  };
}

export default function TextbookReaderLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: ReaderParams;
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
