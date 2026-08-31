import { supabase } from '@/lib/supabase'
import {
  getActiveTerm,
  currentWeekOf,
} from '@/lib/academicTerm'
import type {
  CurriculumSuggestion,
} from '@/lib/types'

export interface LessonSourceSuggestion extends CurriculumSuggestion {
  objectives: string | null
  keyInquiryQuestion: string | null
  learningResources: string | null
  resources: string | null
  reference: string | null
  learningExperiences: string | null
  assessmentMethods: string | null
  lessonNumber: number | null
  period: number | null
  sequenceNumber: number | null
}

export interface ResolveLessonSourceInput {
  userId: string
  schoolId: string
  classId: string
  subjectId: string
  subjectName: string
  grade: string
  occurrenceDate?: string | null
  requestedSchemeId?: string | null
}

interface SchemeSourceRow {
  id: string
  curriculum_id: string | null
  sub_strand_id: string | null
  strand: string | null
  sub_strand: string | null
  topic: string
  week: number
  objectives: string | null
  key_inquiry_question: string | null
  learning_resources: string | null
  resources: string | null
  reference: string | null
  learning_experiences: string | null
  assessment_methods: string | null
  lesson_number: number | null
  period: number | null
  sequence_number: number | null
}

const SCHEME_SOURCE_COLUMNS = [
  'id',
  'curriculum_id',
  'sub_strand_id',
  'strand',
  'sub_strand',
  'topic',
  'week',
  'objectives',
  'key_inquiry_question',
  'learning_resources',
  'resources',
  'reference',
  'learning_experiences',
  'assessment_methods',
  'lesson_number',
  'period',
  'sequence_number',
].join(',')

function weekForOccurrence(
  startDate: string,
  occurrenceDate: string | null | undefined,
): number | null {
  if (
    !occurrenceDate ||
    !/^\d{4}-\d{2}-\d{2}$/.test(startDate) ||
    !/^\d{4}-\d{2}-\d{2}$/.test(occurrenceDate)
  ) {
    return null
  }

  const start = Date.parse(`${startDate}T00:00:00Z`)
  const occurrence = Date.parse(`${occurrenceDate}T00:00:00Z`)

  if (
    Number.isNaN(start) ||
    Number.isNaN(occurrence) ||
    occurrence < start
  ) {
    return null
  }

  return Math.floor((occurrence - start) / 604800000) + 1
}

function toSuggestion(
  row: SchemeSourceRow,
  termNumber: number,
): LessonSourceSuggestion {
  return {
    id: row.curriculum_id,
    strand: row.strand ?? '',
    subStrand: row.sub_strand ?? '',
    topic: row.topic,
    term: termNumber,
    week: row.week,
    strandId: row.sub_strand_id ?? null,
    schemeId: row.id,
    objectives: row.objectives ?? null,
    keyInquiryQuestion: row.key_inquiry_question ?? null,
    learningResources: row.learning_resources ?? null,
    resources: row.resources ?? null,
    reference: row.reference ?? null,
    learningExperiences: row.learning_experiences ?? null,
    assessmentMethods: row.assessment_methods ?? null,
    lessonNumber: row.lesson_number ?? null,
    period: row.period ?? null,
    sequenceNumber: row.sequence_number ?? null,
  }
}

async function loadSchemeSourceById({
  schemeId,
  userId,
  schoolId,
  classId,
  subjectId,
  academicTermId,
}: {
  schemeId: string
  userId: string
  schoolId: string
  classId: string
  subjectId: string
  academicTermId: string
}): Promise<SchemeSourceRow | null> {
  const { data, error } = await supabase
    .from('scheme_of_work')
    .select(SCHEME_SOURCE_COLUMNS)
    .eq('id', schemeId)
    .eq('teacher_id', userId)
    .eq('class_id', classId)
    .eq('subject_id', subjectId)
    .eq('academic_term_id', academicTermId)
    .eq('school_id', schoolId)
    .maybeSingle()

  if (error) throw error

  return data as unknown as SchemeSourceRow | null
}

/**
 * Resolves the educational source for a lesson occurrence.
 *
 * Authority order:
 * 1. Explicit Scheme item selected by the teacher.
 * 2. Next Scheme item after actual completed teaching progress.
 * 3. Curriculum fallback for the occurrence's academic week.
 * 4. No source — the teacher may enter a custom topic.
 *
 * A Scheme row remains authoritative even when legacy curriculum rows do not
 * yet have a reusable sub_strand_id. That condition may disable canonical
 * asset reuse, but it must never force the teacher to retype a known topic or
 * detach the lesson from its Scheme of Work.
 *
 * This function is read-only. It never creates or updates lesson plans,
 * Scheme rows, curriculum rows or teaching occurrences.
 */
export async function resolveLessonSource({
  userId,
  schoolId,
  classId,
  subjectId,
  subjectName,
  grade,
  occurrenceDate = null,
  requestedSchemeId = null,
}: ResolveLessonSourceInput): Promise<LessonSourceSuggestion | null> {
  const term = await getActiveTerm(schoolId)

  if (!term) return null

  if (requestedSchemeId) {
    const requestedScheme = await loadSchemeSourceById({
      schemeId: requestedSchemeId,
      userId,
      schoolId,
      classId,
      subjectId,
      academicTermId: term.id,
    })

    if (!requestedScheme) {
      throw new Error(
        'The selected Scheme item does not belong to this lesson.',
      )
    }

    return toSuggestion(requestedScheme, term.term)
  }

  const {
    data: nextSchemeRows,
    error: nextSchemeError,
  } = await supabase.rpc(
    'get_next_scheme_item',
    {
      p_class_id: classId,
      p_subject_id: subjectId,
      p_academic_term_id: term.id,
    },
  )

  if (nextSchemeError) throw nextSchemeError

  const nextScheme = nextSchemeRows?.[0]

  if (nextScheme?.scheme_id) {
    const exactScheme = await loadSchemeSourceById({
      schemeId: nextScheme.scheme_id,
      userId,
      schoolId,
      classId,
      subjectId,
      academicTermId: term.id,
    })

    if (exactScheme) {
      return toSuggestion(exactScheme, term.term)
    }
  }

  const occurrenceWeek =
    weekForOccurrence(term.start_date, occurrenceDate) ??
    currentWeekOf(term)

  const { data: curriculumRows, error: curriculumError } =
    await supabase
      .from('curriculum')
      .select('id, strand, sub_strand, topic, sub_strand_id')
      .eq('grade', grade)
      .eq('subject', subjectName)
      .eq('term', term.term)
      .eq('week', occurrenceWeek)
      .limit(1)

  if (curriculumError) throw curriculumError

  const curriculumRow = curriculumRows?.[0]
  if (!curriculumRow) return null

  return {
    id: curriculumRow.id,
    strand: curriculumRow.strand,
    subStrand: curriculumRow.sub_strand,
    topic: curriculumRow.topic,
    term: term.term,
    week: occurrenceWeek,
    strandId: curriculumRow.sub_strand_id ?? null,
    schemeId: null,
    objectives: null,
    keyInquiryQuestion: null,
    learningResources: null,
    resources: null,
    reference: null,
    learningExperiences: null,
    assessmentMethods: null,
    lessonNumber: null,
    period: null,
    sequenceNumber: null,
  }
}
