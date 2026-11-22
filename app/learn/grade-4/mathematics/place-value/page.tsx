import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import ReaderClient from '@/app/read/textbook/[publicationId]/ReaderClient'
import { findChapter, loadPublicReader } from '@/app/read/textbook/[publicationId]/readerServer'

// This lesson is a view of an existing released textbook, never a separate
// publication or a rendering of a private/editorial manuscript.
const PUBLICATION_ID = '6fc551d7-c9ae-4402-ac52-3d0a46461e87'
const CHAPTER_ID = 'b23413c2-f7ae-44c2-9f5e-98f3cdeeeb8a'
const FIRST_LESSON_STOP = 'Reading and writing numerals'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = {
  title: 'Lesson 1: Place Value and Total Value | Grade 4 Mathematics | VibeSchool',
  description: 'Learn place value with published textbook explanations, interactive exploration and connected practice.',
  // Keep one canonical indexed source until the independently verified
  // outcome-level textbook release is available.
  robots: { index: false, follow: true },
}

export default async function Grade4PlaceValueLessonPage() {
  // The public reader RPC is the entitlement/release authority. In particular,
  // do not fall back to the former GitHub editorial preview on access failure.
  const reader = await loadPublicReader(PUBLICATION_ID)
  const chapter = reader && findChapter(reader, CHAPTER_ID)
  if (!reader || !chapter || chapter.status !== 'published' || !chapter.can_read ||
      !Array.isArray(chapter.blocks) || chapter.blocks.length === 0) notFound()

  // A safe lesson boundary must exist within the currently released version.
  // Otherwise fail closed instead of silently showing a different lesson.
  const stop = chapter.blocks.findIndex(block => block.type === 'heading2' &&
    String(block.content ?? '').trim().toLowerCase() === FIRST_LESSON_STOP.toLowerCase())
  if (stop <= 0) notFound()

  return <ReaderClient
    publicationId={PUBLICATION_ID}
    initialPayload={reader}
    initialChapterId={CHAPTER_ID}
    lessonFocus={{
      chapterId: CHAPTER_ID,
      title: 'Lesson 1 · Place Value and Total Value',
      stopBeforeHeading: FIRST_LESSON_STOP,
    }}
  />
}
