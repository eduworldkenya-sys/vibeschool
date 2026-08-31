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
import type {
  LessonSourceSuggestion,
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

export interface LoadLessonWorkspaceInput {
  timetableSlotId: string
  occurrenceDate: string
  classId: string
  subjectId: string
  subjectName: string
  requestedSchemeId?: string | null
}

export interface LessonCanonicalSourceIdentity {
  curriculumId: string
  subjectId: string
  grade: string
  subStrandId: string
}

export interface LessonWorkspaceBootResult {
  teacherId: string
  context: LessonContext
  existingPlan: ExistingLessonPlan | null
  source: LessonSourceSuggestion | null
  sourceLinked: boolean
  canonicalIdentity: LessonCanonicalSourceIdentity | null
  occurrence: TeachingOccurrence | null
  occurrenceError: string | null
}

function emptySourceDetails() {
  return {
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

/**
 * Restores the educational identity persisted on an existing lesson plan.
 * Persisted scheme_id is authoritative over a newly resolved suggestion.
 */
async function restorePersistedLessonSource(
  existingPlan: ExistingLessonPlan,
): Promise<LessonSourceSuggestion | null> {
  if (existingPlan.scheme_id) {
    const { data: schemeRow, error: schemeError } = await supabase
      .from('scheme_of_work')
      .select(
        'id, curriculum_id, sub_strand_id, strand, sub_strand, topic, week, term, objectives, key_inquiry_question, learning_resources, resources, reference, learning_experiences, assessment_methods, lesson_number, period, sequence_number',
      )
      .eq('id', existingPlan.scheme_id)
      .single()

    if (schemeError) throw schemeError

    return {
      id: schemeRow.curriculum_id ?? existingPlan.curriculum_id ?? null,
      strand: schemeRow.strand ?? '',
      subStrand: schemeRow.sub_strand ?? '',
      topic: schemeRow.topic,
      term: schemeRow.term,
      week: schemeRow.week,
      strandId:
        schemeRow.sub_strand_id ?? existingPlan.strand_id ?? null,
      schemeId: schemeRow.id,
      objectives: schemeRow.objectives ?? null,
      keyInquiryQuestion: schemeRow.key_inquiry_question ?? null,
      learningResources: schemeRow.learning_resources ?? null,
      resources: schemeRow.resources ?? null,
      reference: schemeRow.reference ?? null,
      learningExperiences: schemeRow.learning_experiences ?? null,
      assessmentMethods: schemeRow.assessment_methods ?? null,
      lessonNumber: schemeRow.lesson_number ?? null,
      period: schemeRow.period ?? null,
      sequenceNumber: schemeRow.sequence_number ?? null,
    }
  }

  if (existingPlan.curriculum_id) {
    const { data: curriculumRow, error: curriculumError } = await supabase
      .from('curriculum')
      .select(
        'id, sub_strand_id, strand, sub_strand, topic, week, term',
      )
      .eq('id', existingPlan.curriculum_id)
      .single()

    if (curriculumError) throw curriculumError

    return {
      id: curriculumRow.id,
      strand: curriculumRow.strand,
      subStrand: curriculumRow.sub_strand,
      topic: curriculumRow.topic,
      term: curriculumRow.term,
      week: curriculumRow.week,
      strandId:
        curriculumRow.sub_strand_id ?? existingPlan.strand_id ?? null,
      schemeId: null,
      ...emptySourceDetails(),
    }
  }

  return null
}

function buildCanonicalIdentity(
  source: LessonSourceSuggestion | null,
  subjectId: string,
  grade: string | null,
): LessonCanonicalSourceIdentity | null {
  if (!source?.id || !source.strandId || !subjectId || !grade) {
    return null
  }

  return {
    curriculumId: source.id,
    subjectId,
    grade,
    subStrandId: source.strandId,
  }
}

/**
 * Loads all read-only state required to open one exact Lesson Workspace.
 *
 * A resolved Scheme/curriculum source is linked by default. The teacher may
 * explicitly switch to a custom topic in the UI, but the default must never
 * require re-entering curriculum data the system already knows.
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

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const [context, existingPlan] = await Promise.all([
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

  let source: LessonSourceSuggestion | null = null
  let sourceLinked = false

  if (context.schoolId && context.grade) {
    try {
      source = await resolveLessonSource({
        userId: user.id,
        schoolId: context.schoolId,
        classId,
        subjectId,
        subjectName,
        grade: context.grade,
        occurrenceDate,
        requestedSchemeId,
      })
      sourceLinked = source !== null
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

  const canonicalIdentity = buildCanonicalIdentity(
    source,
    subjectId,
    context.grade,
  )

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
    canonicalIdentity,
    occurrence,
    occurrenceError,
  }
}
