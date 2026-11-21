import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { chapterUrl, findChapter, firstChapter, loadPublicReader, metadataForChapter } from "./readerServer";

type PageProps = {
  params: Promise<{ publicationId: string }>;
  searchParams?: Promise<{ chapter?: string }>;
};

export async function generateMetadata(props: PageProps): Promise<Metadata> {
  const searchParams = await props.searchParams;
  const params = await props.params;
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

export default async function ReadTextbookPage(props: PageProps) {
  const searchParams = await props.searchParams;
  const params = await props.params;
  const payload = await loadPublicReader(params.publicationId);
  if (!payload) notFound();

  const chapter = findChapter(payload, searchParams?.chapter) ?? firstChapter(payload);
  if (!chapter) notFound();

  permanentRedirect(chapterUrl(params.publicationId, chapter.id));
}
