import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { chapterUrl, findChapter, firstChapter, loadPublicReader, metadataForChapter } from "./readerServer";

type PageProps = {
  params: { publicationId: string };
  searchParams?: { chapter?: string };
};

export async function generateMetadata({ params, searchParams }: PageProps): Promise<Metadata> {
  const payload = await loadPublicReader(params.publicationId);
  if (!payload) {
    return {
      title: "Textbook not found | VibeSchool",
      robots: { index: false, follow: false },
    };
  }

  const chapter = findChapter(payload, searchParams?.chapter) ?? firstChapter(payload);
  if (!chapter) {
    return {
      title: `${payload.publication.title || "VibeSchool Textbook"} | VibeSchool`,
      robots: { index: false, follow: true },
    };
  }

  return metadataForChapter(payload, params.publicationId, chapter);
}

export default async function ReadTextbookPage({ params, searchParams }: PageProps) {
  const payload = await loadPublicReader(params.publicationId);
  if (!payload) notFound();

  const chapter = findChapter(payload, searchParams?.chapter) ?? firstChapter(payload);
  if (!chapter) notFound();

  permanentRedirect(chapterUrl(params.publicationId, chapter.id));
}
