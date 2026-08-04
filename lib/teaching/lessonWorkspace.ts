import { supabase } from '@/lib/supabase'
import {
  loadLessonContext,
} from '@/lib/teaching/lessonContext'
import type {
  LessonContext,
} from '@/lib/teaching/lessonContext'
import {
  resolveLessonSource,
} from '@/lib/teaching/lessonSource'
import {
  loadLessonPlanForOccurrence,
} from '@/lib/teaching/lessonRepository'
import type {
  ExistingLessonPlan,
} from '@/lib/teaching/lessonRepository'
import {
  loadLessonOccurrence,
} from '@/lib/teaching/lessonLifecycle'
import type {
  TeachingOccurrence,
} from '@/lib/teaching/types'
import type {
  CurriculumSuggestion,
} from '@/lib/types'

export interface LoadLessonWorkspaceInput {
  timetableSlotId: string
  occurrenceDate: string
  classId: string
  subjectId: string
  subjectName: string
  requestedSchemeId?: string | null
}

export interface LessonWorkspaceBootResult {
  teacherId: string
  context: Omit<LessonContext, 'grade'>
  existingPlan: ExistingLessonPlan | null
  source: CurriculumSuggestion | null
  sourceLinked: boolean
  occurrence: TeachingOccurrence | null
  occurrenceError: string | null
}

/**
 * Restores the educational identity persisted on an existing lesson plan.
 *
 * Persisted scheme_id is authoritative over a current-week suggestion.
 */
async function restorePersistedLessonSource(
  existingPlan: ExistingLessonPlan,
): Promise<CurriculumSuggestion | null> {
  if (existingPlan.scheme_id) {
    const {
      data: schemeRow,
      error: schemeError,
    } = await supabase
      .from('scheme_of_work')
      .select(
        'id, curriculum_id, strand, sub_strand, topic, week, term',
      )
      .eq('id', existingPlan.scheme_id)
      .single()

    if (schemeError) {
      throw schemeError
    }

    return {
      id:
        schemeRow.curriculum_id ??
        existingPlan.curriculum_id ??
        null,
      strand: schemeRow.strand ?? '',
      subStrand: schemeRow.sub_strand ?? '',
      topic: schemeRow.topic,
      term: schemeRow.term,
      week: schemeRow.week,
      strandId: existingPlan.strand_id ?? null,
      schemeId: schemeRow.id,
    }
  }

  if (existingPlan.curriculum_id) {
    const {
      data: curriculumRow,
      error: curriculumError,
    } = await supabase
      .from('curriculum')
      .select(
        'id, strand, sub_strand, topic, week, term',
      )
      .eq('id', existingPlan.curriculum_id)
      .single()

    if (curriculumError) {
      throw curriculumError
    }

    return {
      id: curriculumRow.id,
      strand: curriculumRow.strand,
      subStrand: curriculumRow.sub_strand,
      topic: curriculumRow.topic,
      term: curriculumRow.term,
      week: curriculumRow.week,
      strandId: existingPlan.strand_id ?? null,
      schemeId: null,
    }
  }

  return null
}

/**
 * Loads all read-only state required to open one exact Lesson Workspace.
 *
 * The occurrence read is intentionally nonfatal: a temporary lifecycle read
 * failure must not prevent a teacher from opening or editing the lesson plan.
 */
export async function loadLessonWorkspace({
  timetableSlotId,
  occurrenceDate,
  classId,
  subjectId,
  subjectName,
  requestedSchemeId = null,
}: LoadLessonWorkspaceInput): Promise<LessonWorkspaceBootResult | null> {
  if (!occurrenceDate) {
    throw new Error(
      'lessonWorkspace: occurrenceDate is required.',
    )
  }

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return null
  }

  const [
    loadedContext,
    existingPlan,
  ] = await Promise.all([
    loadLessonContext({
      userId: user.id,
      classId,
      subjectId,
    }),
    loadLessonPlanForOccurrence({
      teacherId: user.id,
      timetableSlotId,
      taughtDate: occurrenceDate,
    }),
  ])

  const {
    grade,
    ...context
  } = loadedContext

  let source: CurriculumSuggestion | null = null
  let sourceLinked = false

  if (context.schoolId && grade) {
    try {
      source = await resolveLessonSource({
        userId: user.id,
        schoolId: context.schoolId,
        classId,
        subjectId,
        subjectName,
        grade,
        requestedSchemeId,
      })
    } catch (sourceError) {
      console.error(
        '[lessonWorkspace] lesson source resolution failed',
        sourceError,
      )
    }
  }

  if (existingPlan) {
    try {
      const persistedSource =
        await restorePersistedLessonSource(existingPlan)

      if (persistedSource) {
        source = persistedSource
        sourceLinked = true
      }
    } catch (sourceError) {
      console.error(
        '[lessonWorkspace] persisted source restoration failed',
        sourceError,
      )
    }
  }

  let occurrence: TeachingOccurrence | null = null
  let occurrenceError: string | null = null

  try {
    occurrence = await loadLessonOccurrence({
      timetableSlotId,
      occurrenceDate,
    })
  } catch (workspaceError) {
    console.error(
      '[lessonWorkspace] occurrence load failed',
      workspaceError,
    )
    occurrenceError =
      'Could not load the lesson teaching state.'
  }

  return {
    teacherId: user.id,
    context,
    existingPlan,
    source,
    sourceLinked,
    occurrence,
    occurrenceError,
  }
}
