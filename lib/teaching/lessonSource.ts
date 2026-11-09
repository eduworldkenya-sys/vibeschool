import { supabase } from '@/lib/supabase'
import { nairobiDateAdd, nairobiDayOfWeek } from '@/lib/time'
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

interface TimetableSourceRow {
  id: string
  day_of_week: number
  start_time: string
  effective_from: string | null
  effective_until: string | null
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

async function loadSchemeSourceForOccurrenceFallback({
  timetableSlotId,
  occurrenceDate,
  instructionalWeek,
  userId,
  schoolId,
  classId,
  subjectId,
  academicTerm,
}: {
  timetableSlotId: string
  occurrenceDate: string
  instructionalWeek: InstructionalWeekRow
  userId: string
  schoolId: string
  classId: string
  subjectId: string
  academicTerm: ActiveTerm
}): Promise<SchemeSourceRow | null> {
  const { data: slotRows, error: slotError } = await supabase
    .from('timetable_slots')
    .select('id, day_of_week, start_time, effective_from, effective_until')
    .eq('school_id', schoolId)
    .eq('teacher_id', userId)
    .eq('class_id', classId)
    .eq('subject_id', subjectId)

  if (slotError) throw slotError

  const firstDay = nairobiDayOfWeek(new Date(`${instructionalWeek.week_start}T12:00:00+03:00`))
  const activeSlots = ((slotRows ?? []) as TimetableSourceRow[])
    .map(slot => ({
      slot,
      date: nairobiDateAdd(instructionalWeek.week_start, (slot.day_of_week - firstDay + 7) % 7),
    }))
    .filter(({ slot, date }) =>
      date <= instructionalWeek.week_end &&
      (!slot.effective_from || slot.effective_from <= date) &&
      (!slot.effective_until || slot.effective_until >= date),
    )
    .sort((left, right) =>
      left.date.localeCompare(right.date) ||
      left.slot.start_time.localeCompare(right.slot.start_time) ||
      left.slot.id.localeCompare(right.slot.id),
    )

  const weeklyPeriodIndex = activeSlots.findIndex(({ slot, date }) => slot.id === timetableSlotId && date === occurrenceDate)
  if (weeklyPeriodIndex < 0) return null

  const { data: exactScheme, error: exactSchemeError } = await supabase
    .from('scheme_of_work')
    .select(SCHEME_SOURCE_COLUMNS)
    .eq('teacher_id', userId)
    .eq('school_id', schoolId)
    .eq('class_id', classId)
    .eq('subject_id', subjectId)
    .eq('academic_term_id', academicTerm.id)
    .eq('week', instructionalWeek.week_number)
    .eq('period', weeklyPeriodIndex + 1)
    .maybeSingle()

  if (exactSchemeError) throw exactSchemeError
  if (!exactScheme) return null
  if (!isSchemeSourceRow(exactScheme)) {
    throw new Error('lessonSource: fallback occurrence Scheme source is missing required fields.')
  }
  return exactScheme
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
 * 3. exact dated timetable ordinal for scheduled lessons
 * 4. completed-teaching Scheme progression for undated lessons
 * 5. curriculum fallback
 * 6. custom teacher topic
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
      throw new Error('The selected Scheme item does not belong to this lesson.')
    }
    return enrichedSchemeSuggestion(requestedScheme, term.term)
  }

  const instructionalWeek = occurrenceDate
    ? await resolveInstructionalWeekForDate(schoolId, occurrenceDate)
    : null
  if (instructionalWeek) {
    if (instructionalWeek.term_id !== term.id) {
      throw new Error('lessonSource: term and instructional-week authorities disagree.')
    }
  }

  if (timetableSlotId && occurrenceDate && instructionalWeek) {
    const occurrenceScheme = await loadSchemeSourceForOccurrenceFallback({
      timetableSlotId,
      occurrenceDate,
      instructionalWeek,
      userId,
      schoolId,
      classId,
      subjectId,
      academicTerm: term,
    })
    if (occurrenceScheme) {
      return enrichedSchemeSuggestion(occurrenceScheme, term.term)
    }
  }

  // A dated occurrence must never inherit the next unfinished Scheme item.
  // Only an explicit scheme selection (above) or the exact occurrence/week
  // lookup may supply its Scheme topic. Preserve progression for undated flows.
  if (!occurrenceDate) {
    // Progression is a convenience lookup, not the sole authority for a dated
    // lesson. If it is unavailable, try the timetable/week and curriculum sources.
    // Authorization failures remain fatal: never turn them into a fallback.
    let progressionScheme: SchemeSourceRow | null = null
    try {
      progressionScheme = await loadCurrentSchemeProgression({
        userId,
        schoolId,
        classId,
        subjectId,
        academicTerm: term,
      })
    } catch (progressionError) {
      const detail = String(
        progressionError instanceof Error
          ? progressionError.message
          : (progressionError as { message?: string } | null)?.message ?? progressionError,
      )
      if (/auth|permission|access|assignment_not_found|academic_term_not_found|jwt|403|401/i.test(detail)) {
        throw progressionError
      }
      console.error('[lessonSource] progression unavailable; trying dated sources', progressionError)
    }
    if (progressionScheme) {
      return enrichedSchemeSuggestion(progressionScheme, term.term)
    }

  }

  const curriculumWeek = instructionalWeek?.week_number ?? currentWeekOf(term)
  const { data: curriculumRows, error: curriculumError } = await supabase
    .from('curriculum')
    .select('id, strand, sub_strand, topic, sub_strand_id, reference')
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
