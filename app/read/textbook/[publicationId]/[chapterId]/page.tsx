import type { Metadata } from "next";
import { notFound } from "next/navigation";
import ReaderClient from "../ReaderClient";
import { findChapter, loadPublicReader, metadataForChapter } from "../readerServer";

type PageProps = {
  params: { publicationId: string; chapterId: string };
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const payload = await loadPublicReader(params.publicationId);
  if (!payload) {
    return {
      title: "Textbook not found | VibeSchool",
      robots: { index: false, follow: false },
    };
  }

  const chapter = findChapter(payload, params.chapterId);
  if (!chapter) {
    return {
      title: "Chapter not found | VibeSchool",
      robots: { index: false, follow: false },
    };
  }

  return metadataForChapter(payload, params.publicationId, chapter);
}

export default async function ChapterPage({ params }: PageProps) {
  const payload = await loadPublicReader(params.publicationId);
  if (!payload) notFound();

  const chapter = findChapter(payload, params.chapterId);
  if (!chapter) notFound();

  return (
    <ReaderClient
      publicationId={params.publicationId}
      initialPayload={payload}
      initialChapterId={chapter.id}
    />
  );
}
