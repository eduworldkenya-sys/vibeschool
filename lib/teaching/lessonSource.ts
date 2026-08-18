import { supabase } from '@/lib/supabase'
import {
  getActiveTerm,
  currentWeekOf,
} from '@/lib/academicTerm'
import type {
  CurriculumSuggestion,
} from '@/lib/types'

export interface ResolveLessonSourceInput {
  userId: string
  schoolId: string
  classId: string
  subjectId: string
  subjectName: string
  grade: string
  requestedSchemeId?: string | null
}

/**
 * Resolves the educational source for a lesson occurrence.
 *
 * Authority order:
 * 1. Explicit Scheme item selected by the teacher.
 * 2. Next Scheme item after actual completed teaching progress.
 * 3. Current-week national curriculum fallback.
 * 4. No source — the teacher may enter a custom topic.
 *
 * Stable curriculum identity is carried directly from persisted UUID columns.
 * Text labels are display/pedagogy data only and are never used to manufacture
 * canonical identity.
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
  requestedSchemeId = null,
}: ResolveLessonSourceInput): Promise<CurriculumSuggestion | null> {
  const term = await getActiveTerm(schoolId)

  if (!term) {
    return null
  }

  const currentWeek = currentWeekOf(term)

  let schemeSource: {
    schemeId: string
    curriculumId: string | null
    subStrandId: string | null
    strand: string | null
    subStrand: string | null
    topic: string
    week: number
  } | null = null

  if (requestedSchemeId) {
    const {
      data: requestedScheme,
      error: requestedSchemeError,
    } = await supabase
      .from('scheme_of_work')
      .select(
        'id, curriculum_id, sub_strand_id, strand, sub_strand, topic, week',
      )
      .eq('id', requestedSchemeId)
      .eq('teacher_id', userId)
      .eq('class_id', classId)
      .eq('subject_id', subjectId)
      .eq('academic_term_id', term.id)
      .eq('school_id', schoolId)
      .maybeSingle()

    if (requestedSchemeError) {
      throw requestedSchemeError
    }

    if (!requestedScheme) {
      throw new Error(
        'The selected Scheme item does not belong to this lesson.',
      )
    }

    schemeSource = {
      schemeId: requestedScheme.id,
      curriculumId:
        requestedScheme.curriculum_id ?? null,
      subStrandId:
        requestedScheme.sub_strand_id ?? null,
      strand: requestedScheme.strand,
      subStrand: requestedScheme.sub_strand,
      topic: requestedScheme.topic,
      week: requestedScheme.week,
    }
  } else {
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

    if (nextSchemeError) {
      throw nextSchemeError
    }

    const nextScheme = nextSchemeRows?.[0]

    if (nextScheme) {
      // get_next_scheme_item predates canonical reusable assets and may not
      // return sub_strand_id. Re-read the exact authoritative Scheme row by
      // its UUID rather than resolving identity from text labels.
      const {
        data: schemeIdentity,
        error: schemeIdentityError,
      } = await supabase
        .from('scheme_of_work')
        .select('curriculum_id, sub_strand_id')
        .eq('id', nextScheme.scheme_id)
        .eq('teacher_id', userId)
        .eq('class_id', classId)
        .eq('subject_id', subjectId)
        .eq('academic_term_id', term.id)
        .eq('school_id', schoolId)
        .single()

      if (schemeIdentityError) {
        throw schemeIdentityError
      }

      schemeSource = {
        schemeId: nextScheme.scheme_id,
        curriculumId:
          schemeIdentity.curriculum_id ??
          nextScheme.curriculum_id ??
          null,
        subStrandId:
          schemeIdentity.sub_strand_id ?? null,
        strand: nextScheme.strand,
        subStrand: nextScheme.sub_strand,
        topic: nextScheme.topic,
        week: nextScheme.week,
      }
    }
  }

  if (schemeSource) {
    return {
      id: schemeSource.curriculumId,
      strand: schemeSource.strand ?? '',
      subStrand: schemeSource.subStrand ?? '',
      topic: schemeSource.topic,
      term: term.term,
      week: schemeSource.week,
      // CurriculumSuggestion.strandId is the historical field name. For the
      // canonical path it carries the stable curriculum sub-strand UUID used
      // by learning_resources.sub_strand_id.
      strandId: schemeSource.subStrandId,
      schemeId: schemeSource.schemeId,
    }
  }

  const { data: curriculumRows, error: curriculumError } =
    await supabase
      .from('curriculum')
      .select('id, strand, sub_strand, topic, sub_strand_id')
      .eq('grade', grade)
      .eq('subject', subjectName)
      .eq('term', term.term)
      .eq('week', currentWeek)
      .limit(1)

  if (curriculumError) {
    throw curriculumError
  }

  const curriculumRow = curriculumRows?.[0]

  if (!curriculumRow) {
    return null
  }

  return {
    id: curriculumRow.id,
    strand: curriculumRow.strand,
    subStrand: curriculumRow.sub_strand,
    topic: curriculumRow.topic,
    term: term.term,
    week: currentWeek,
    strandId: curriculumRow.sub_strand_id ?? null,
    schemeId: null,
  }
}
