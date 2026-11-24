import type { Metadata } from "next";
import { notFound } from "next/navigation";
import ReaderClient from "../ReaderClient";
import { findChapter, loadPublicReader, metadataForChapter } from "../readerServer";

type PageProps = {
  params: Promise<{ publicationId: string; chapterId: string }>;
  searchParams: Promise<{ block?: string | string[] }>;
};

export async function generateMetadata(props: PageProps): Promise<Metadata> {
  const params = await props.params;
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

export default async function ChapterPage(props: PageProps) {
  const params = await props.params;
  const payload = await loadPublicReader(params.publicationId);
  if (!payload) notFound();

  const chapter = findChapter(payload, params.chapterId);
  if (!chapter) notFound();
  const search = await props.searchParams;
  const initialBlockId = typeof search.block === 'string' && search.block.length <= 128 ? search.block : null;

  return (
    <ReaderClient
      publicationId={params.publicationId}
      initialPayload={payload}
      initialChapterId={chapter.id}
      initialBlockId={initialBlockId}
    />
  );
}
