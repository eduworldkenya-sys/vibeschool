import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Grade4PlaceValueContentReader from '@/components/learn/Grade4PlaceValueContentReader'
import { findChapter, loadPublicReader } from '@/app/read/textbook/[publicationId]/readerServer'

// Use only the existing published textbook and its public reader entitlement.
// The lesson view shares Grade 4 Time's UI, not an independent release system.
const PUBLICATION_ID = '6fc551d7-c9ae-4402-ac52-3d0a46461e87'
const CHAPTER_ID = 'b23413c2-f7ae-44c2-9f5e-98f3cdeeeb8a'
const FIRST_LESSON_STOP = 'Reading and writing numerals'
const REQUIRED_LESSON_HEADINGS = [
  'Learning Outcomes', 'Introduction', 'What is Place Value?',
  'Worked Example 1', 'Whole numbers in everyday life',
]

export const dynamic = 'force-dynamic'
export const metadata: Metadata = {
  title: 'Lesson 1: Place Value and Total Value | Grade 4 Mathematics',
  description: 'Learn place value with published explanations, worked examples, a number chart and connected practice.',
  robots: { index: false, follow: true },
}

export default async function Grade4PlaceValueLessonPage() {
  const reader = await loadPublicReader(PUBLICATION_ID)
  const chapter = reader && findChapter(reader, CHAPTER_ID)
  if (!reader || !chapter || chapter.status !== 'published' || !chapter.can_read ||
      !Array.isArray(chapter.blocks) || !chapter.blocks.length) notFound()

  const stop = chapter.blocks.findIndex(block => block.type === 'heading2' &&
    String(block.content ?? '').trim().toLowerCase() === FIRST_LESSON_STOP.toLowerCase())
  if (stop <= 0) notFound()

  const publishedLesson = chapter.blocks.slice(0, stop)
  // A changed or incomplete release must not silently show a different lesson.
  const hasHeading = (heading: string) => publishedLesson.some(block =>
    ['heading1', 'heading2', 'heading3'].includes(block.type) &&
    String(block.content ?? '').trim().toLowerCase() === heading.toLowerCase())
  if (!REQUIRED_LESSON_HEADINGS.every(hasHeading)) notFound()

  return <Grade4PlaceValueContentReader
    blocks={publishedLesson}
    publicationId={PUBLICATION_ID}
    chapterId={CHAPTER_ID}
  />
}
