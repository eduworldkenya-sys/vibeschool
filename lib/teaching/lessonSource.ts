import { supabase } from '@/lib/supabase'
import {
  getActiveTerm,
  getTermForDate,
  currentWeekOf,
} from '@/lib/academicTerm'
import type {
  ActiveTerm,
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
  timetableSlotId?: string | null
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

interface InstructionalWeekRow {
  term_id: string
  term_number: number
  week_number: number
  week_start: string
  week_end: string
}

interface CurriculumAuthorityDetailRow {
  learning_outcomes: string[] | null
  key_inquiry_questions: string[] | null
  suggested_experiences: string[] | null
  source_ref: string | null
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

function meaningful(value: string | null | undefined): string | null {
  const cleaned = value?.trim() ?? ''
  return cleaned.length > 0 ? cleaned : null
}

function authorityList(values: string[] | null | undefined): string | null {
  const cleaned = (values ?? []).map(value => value.trim()).filter(Boolean)
  return cleaned.length > 0 ? cleaned.join('\n') : null
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
    objectives: meaningful(row.objectives),
    keyInquiryQuestion: meaningful(row.key_inquiry_question),
    learningResources: meaningful(row.learning_resources),
    resources: meaningful(row.resources),
    reference: meaningful(row.reference),
    learningExperiences: meaningful(row.learning_experiences),
    assessmentMethods: meaningful(row.assessment_methods),
    lessonNumber: row.lesson_number ?? null,
    period: row.period ?? null,
    sequenceNumber: row.sequence_number ?? null,
  }
}

/**
 * Fills blank Scheme pedagogical fields from the already-linked CBC curriculum
 * authority. Scheme-authored values always win. This is read-time enrichment:
 * it never mutates Scheme rows and never invents curriculum content.
 */
export async function enrichLessonSourceFromCurriculum(
  source: LessonSourceSuggestion,
): Promise<LessonSourceSuggestion> {
  if (!source.strandId) return source

  const needsAuthority =
    !meaningful(source.objectives) ||
    !meaningful(source.keyInquiryQuestion) ||
    !meaningful(source.learningExperiences) ||
    !meaningful(source.reference)

  if (!needsAuthority) return source

  const { data, error } = await supabase
    .from('cbc_strands')
    .select('learning_outcomes,key_inquiry_questions,suggested_experiences,source_ref')
    .eq('id', source.strandId)
    .maybeSingle()

  // Authority enrichment is optional. A temporary source read failure must not
  // discard an otherwise authorized teacher-authored Scheme lesson. Missing
  // fields stay missing and are never represented as verified KICD outcomes.
  if (error) {
    console.error('[lessonSource] curriculum enrichment unavailable', error)
    return source
  }
  if (!data) return source

  const authority = data as CurriculumAuthorityDetailRow
  return {
    ...source,
    objectives:
      meaningful(source.objectives) ?? authorityList(authority.learning_outcomes),
    keyInquiryQuestion:
      meaningful(source.keyInquiryQuestion) ?? authorityList(authority.key_inquiry_questions),
    learningExperiences:
      meaningful(source.learningExperiences) ?? authorityList(authority.suggested_experiences),
    reference:
      meaningful(source.reference) ?? meaningful(authority.source_ref),
  }
}

function isSchemeSourceRow(value: object | null): value is SchemeSourceRow {
  if (!value) return false
  return (
    'id' in value &&
    'topic' in value &&
    'week' in value &&
    typeof value.id === 'string' &&
    typeof value.topic === 'string' &&
    typeof value.week === 'number'
  )
}

async function resolveInstructionalWeekForDate(
  schoolId: string,
  occurrenceDate: string,
): Promise<InstructionalWeekRow> {
  const { data, error } = await supabase.rpc(
    'resolve_instructional_week_for_date',
    {
      p_school_id: schoolId,
      p_date: occurrenceDate,
    },
  )
  if (error) throw error

  const row = Array.isArray(data) ? data[0] : null
  if (
    !row ||
    typeof row.term_id !== 'string' ||
    typeof row.term_number !== 'number' ||
    typeof row.week_number !== 'number' ||
    typeof row.week_start !== 'string' || typeof row.week_end !== 'string'
  ) {
    throw new Error(
      `lessonSource: no authoritative instructional week for ${occurrenceDate}.`,
    )
  }
  return row as InstructionalWeekRow
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
  if (data === null) return null
  if (!isSchemeSourceRow(data)) {
    throw new Error('lessonSource: Scheme source response is missing required fields.')
  }
  return data
}

async function loadCurrentSchemeProgression({
  userId,
  schoolId,
  classId,
  subjectId,
  academicTerm,
}: {
  userId: string
  schoolId: string
  classId: string
  subjectId: string
  academicTerm: ActiveTerm
}): Promise<SchemeSourceRow | null> {
  const { data, error } = await supabase.rpc('get_next_scheme_item', {
    p_class_id: classId,
    p_subject_id: subjectId,
    p_academic_term_id: academicTerm.id,
  })
  if (error) throw error

  const next = Array.isArray(data) ? data[0] : null
  if (!next?.scheme_id) return null

  return loadSchemeSourceById({
    schemeId: next.scheme_id,
    userId,
    schoolId,
    classId,
    subjectId,
    academicTermId: academicTerm.id,
  })
}

async function enrichedSchemeSuggestion(
  row: SchemeSourceRow,
  termNumber: number,
): Promise<LessonSourceSuggestion> {
  return enrichLessonSourceFromCurriculum(toSuggestion(row, termNumber))
}

/**
 * Resolves the educational source for a lesson occurrence.
 * Authority order:
 * 1. occurrence date -> academic term
 * 2. explicit/persisted Scheme item
 * 3. saved dated plan identity (never inferred from timetable position)
 * 4. progression suggestions for undated preparation only
 * 5. curriculum fallback remains an unconfirmed suggestion
 */
export async function resolveLessonSource({
  userId,
  schoolId,
  classId,
  subjectId,
  subjectName,
  grade,
  timetableSlotId = null,
  occurrenceDate = null,
  requestedSchemeId = null,
}: ResolveLessonSourceInput): Promise<LessonSourceSuggestion | null> {
  const term = occurrenceDate
    ? await getTermForDate(schoolId, occurrenceDate)
    : await getActiveTerm(schoolId)

  if (!term) return null

  const instructionalWeek = occurrenceDate
    ? await resolveInstructionalWeekForDate(
        schoolId,
        occurrenceDate,
      )
    : null

  if (
    instructionalWeek &&
    instructionalWeek.term_id !== term.id
  ) {
    throw new Error(
      'lessonSource: academic term and week disagree.',
    )
  }

  async function loadCheckedScheme(
    schemeId: string,
  ): Promise<LessonSourceSuggestion> {
    const row = await loadSchemeSourceById({
      schemeId,
      userId,
      schoolId,
      classId,
      subjectId,
      academicTermId: term.id,
    })

    if (!row) {
      throw new Error(
        'The selected Scheme item does not belong to this lesson.',
      )
    }

    if (
      instructionalWeek &&
      row.week !== instructionalWeek.week_number
    ) {
      throw new Error(
        'The Scheme item belongs to another instructional week.',
      )
    }

    return enrichedSchemeSuggestion(row, term.term)
  }

  // First authority: an explicitly saved Scheme relationship
  // on this exact timetable slot and occurrence date.
  if (timetableSlotId && occurrenceDate) {
    const { data: plan, error } = await supabase
      .from('lesson_plans')
      .select('id,scheme_id')
      .eq('teacher_id', userId)
      .eq('school_id', schoolId)
      .eq('class_id', classId)
      .eq('subject_id', subjectId)
      .eq('timetable_slot_id', timetableSlotId)
      .eq('taught_date', occurrenceDate)
      .maybeSingle()

    if (error) throw error

    if (plan?.scheme_id) {
      if (
        requestedSchemeId &&
        requestedSchemeId !== plan.scheme_id
      ) {
        throw new Error(
          'This lesson already has a different saved Scheme item.',
        )
      }

      return loadCheckedScheme(plan.scheme_id)
    }
  }

  // Explicit teacher selection: a proposed source until
  // attach_scheme_to_dated_lesson persists the relationship.
  if (requestedSchemeId) {
    return loadCheckedScheme(requestedSchemeId)
  }

  // Undated preparation may suggest the next Scheme item.
  // Never apply this progression to a dated occurrence.
  if (!occurrenceDate) {
    let progressionScheme: SchemeSourceRow | null = null

    try {
      progressionScheme = await loadCurrentSchemeProgression({
        userId,
        schoolId,
        classId,
        subjectId,
        academicTerm: term,
      })
    } catch (error) {
      const detail = String(
        error instanceof Error
          ? error.message
          : error,
      )

      if (
        /auth|permission|access|assignment_not_found|academic_term_not_found|jwt|403|401/i
          .test(detail)
      ) {
        throw error
      }

      console.error(
        '[lessonSource] progression unavailable; trying dated sources',
        error,
      )
    }

    if (progressionScheme) {
      return enrichedSchemeSuggestion(
        progressionScheme,
        term.term,
      )
    }
  }

  // Curriculum is a suggestion, not a saved Scheme link.
  const curriculumWeek =
    instructionalWeek?.week_number ?? currentWeekOf(term)

  const { data: curriculumRows, error: curriculumError } =
    await supabase
      .from('curriculum')
      .select(
        'id,strand,sub_strand,topic,sub_strand_id,reference',
      )
      .eq('grade', grade)
      .eq('subject', subjectName)
      .eq('term', term.term)
      .eq('week', curriculumWeek)
      .limit(1)

  if (curriculumError) throw curriculumError

  const curriculumRow = curriculumRows?.[0]
  if (!curriculumRow) return null

  return enrichLessonSourceFromCurriculum({
    id: curriculumRow.id,
    strand: curriculumRow.strand,
    subStrand: curriculumRow.sub_strand,
    topic: curriculumRow.topic,
    term: term.term,
    week: curriculumWeek,
    strandId: curriculumRow.sub_strand_id ?? null,
    schemeId: null,
    objectives: null,
    keyInquiryQuestion: null,
    learningResources: null,
    resources: null,
    reference: meaningful(curriculumRow.reference),
    learningExperiences: null,
    assessmentMethods: null,
    lessonNumber: null,
    period: null,
    sequenceNumber: null,
  })
}
