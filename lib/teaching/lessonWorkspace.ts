import { supabase } from '@/lib/supabase'
import { nairobiDateStr } from '@/lib/time'
import {
  loadLessonContext,
} from '@/lib/teaching/lessonContext'
import type {
  LessonContext,
} from '@/lib/teaching/lessonContext'
import {
  enrichLessonSourceFromCurriculum,
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
import {
  buildCanonicalLessonSourceBundle,
} from '@/lib/teaching/lessonSourceBundle'
import type {
  CanonicalLessonSourceBundle,
  CertifiedLessonContentAsset,
} from '@/lib/teaching/lessonSourceBundle'

export interface LoadLessonWorkspaceInput {
  timetableSlotId: string
  occurrenceDate: string
  classId: string
  subjectId: string
  subjectName: string
  requestedSchemeId?: string | null
  expectedLessonPlanId?: string | null
  expectedOccurrenceId?: string | null
}

export interface LessonCanonicalSourceIdentity {
  curriculumId: string | null
  subjectId: string
  grade: string
  subStrandId: string
  schemeId: string | null
  schemeObjectives: string | null
  keyInquiryQuestion: string | null
  learningResources: string | null
  learningExperiences: string | null
  assessmentMethods: string | null
  reference: string | null
  certifiedContent: CertifiedLessonContentAsset[]
}

export interface LessonWorkspaceBootResult {
  teacherId: string
  context: LessonContext
  existingPlan: ExistingLessonPlan | null
  source: LessonSourceSuggestion | null
  sourceLinked: boolean
  sourceError: string | null
  sourceBundle: CanonicalLessonSourceBundle | null
  sourceBundleError: string | null
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

    return enrichLessonSourceFromCurriculum({
      id: schemeRow.curriculum_id ?? existingPlan.curriculum_id ?? null,
      strand: schemeRow.strand ?? '',
      subStrand: schemeRow.sub_strand ?? '',
      topic: schemeRow.topic,
      term: schemeRow.term,
      week: schemeRow.week,
      strandId: schemeRow.sub_strand_id ?? existingPlan.strand_id ?? null,
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
    })
  }

  if (existingPlan.curriculum_id) {
    const { data: curriculumRow, error: curriculumError } = await supabase
      .from('curriculum')
      .select('id, sub_strand_id, strand, sub_strand, topic, week, term, reference')
      .eq('id', existingPlan.curriculum_id)
      .single()

    if (curriculumError) throw curriculumError

    return enrichLessonSourceFromCurriculum({
      id: curriculumRow.id,
      strand: curriculumRow.strand,
      subStrand: curriculumRow.sub_strand,
      topic: curriculumRow.topic,
      term: curriculumRow.term,
      week: curriculumRow.week,
      strandId: curriculumRow.sub_strand_id ?? existingPlan.strand_id ?? null,
      schemeId: null,
      ...emptySourceDetails(),
      reference: curriculumRow.reference ?? null,
    })
  }

  return null
}

function buildCanonicalIdentity(
  sourceBundle: CanonicalLessonSourceBundle | null,
  subjectId: string,
  grade: string | null,
): LessonCanonicalSourceIdentity | null {
  const source = sourceBundle?.scheme

  if (
    !sourceBundle ||
    sourceBundle.certifiedContent.length === 0 ||
    !source?.strandId ||
    (!source.id && !source.schemeId) ||
    !subjectId ||
    !grade
  ) {
    return null
  }

  return {
    curriculumId: source.id,
    subjectId,
    grade,
    subStrandId: source.strandId,
    schemeId: source.schemeId ?? null,
    schemeObjectives: source.objectives ?? null,
    keyInquiryQuestion: source.keyInquiryQuestion ?? null,
    learningResources: source.learningResources ?? null,
    learningExperiences: source.learningExperiences ?? null,
    assessmentMethods: source.assessmentMethods ?? null,
    reference: source.reference ?? null,
    certifiedContent: sourceBundle.certifiedContent,
  }
}

export async function loadLessonWorkspace({
  timetableSlotId,
  occurrenceDate,
  classId,
  subjectId,
  subjectName,
  requestedSchemeId = null,
  expectedLessonPlanId = null,
  expectedOccurrenceId = null,
}: LoadLessonWorkspaceInput): Promise<LessonWorkspaceBootResult | null> {
  if (!occurrenceDate) {
    throw new Error('lessonWorkspace: occurrenceDate is required.')
  }

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const [context, existingPlan] = await Promise.all([
    loadLessonContext({
      userId: user.id,
      classId,
      subjectId,
      occurrenceDate,
    }),
    loadLessonPlanForOccurrence({
      teacherId: user.id,
      timetableSlotId,
      taughtDate: occurrenceDate,
    }),
  ])

  if (expectedLessonPlanId && existingPlan?.id !== expectedLessonPlanId) {
    throw new Error('lessonWorkspace: the requested lesson plan does not belong to this scheduled lesson.')
  }

  let source: LessonSourceSuggestion | null = null
  let sourceLinked = false
  let sourceError: string | null = null

  if (context.schoolId && context.grade) {
    try {
      source = await resolveLessonSource({
        userId: user.id,
        schoolId: context.schoolId,
        classId,
        subjectId,
        subjectName,
        grade: context.grade,
        timetableSlotId,
        occurrenceDate,
        requestedSchemeId,
      })
      sourceLinked = Boolean(existingPlan?.scheme_id && source?.schemeId === existingPlan.scheme_id)

      if (!sourceLinked && timetableSlotId && !requestedSchemeId) {
        sourceError =
          'No Scheme item linked to this dated lesson. Any curriculum topic shown is a suggestion, not a confirmed lesson assignment.'
      }
    } catch (sourceResolutionError) {
      console.error('[lessonWorkspace] lesson source resolution failed', sourceResolutionError)
      sourceError =
        "Scheme connection needs attention. VibeSchool couldn't resolve the scheduled Scheme lesson. You can still create a custom lesson."
    }
  }

  // Dated authority must pass the exact occurrence / term / week checks above.
  // Do not restore an old plan's Scheme or curriculum record after validation
  // fails: doing so could make a wrong-week draft look safely curriculum-linked.
  // The teacher-authored draft remains available for editing unchanged.
  if (existingPlan?.scheme_id && !sourceLinked) {
    source = null
    sourceError =
      'Saved Scheme link does not match this dated lesson or could not be verified. Review the term, week and teacher assignment before teaching.'
  }

  let sourceBundle: CanonicalLessonSourceBundle | null = null
  let sourceBundleError: string | null = null

  try {
    sourceBundle = await buildCanonicalLessonSourceBundle({
      timetableSlotId,
      occurrenceDate,
      classId,
      subjectId,
      subjectName,
      context,
      source,
    })
  } catch (bundleError) {
    console.error('[lessonWorkspace] canonical source bundle failed', bundleError)
    sourceBundleError =
      'Using the Scheme of Work baseline because certified VibeSchool teaching content could not be loaded for this lesson.'
    sourceError = sourceError ?? sourceBundleError
  }

  const canonicalIdentity = buildCanonicalIdentity(
    sourceBundle,
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
    if (expectedOccurrenceId && occurrence?.occurrenceId !== expectedOccurrenceId) {
      throw new Error('lessonWorkspace: the requested occurrence does not belong to this scheduled lesson.')
    }
  } catch (workspaceError) {
    console.error('[lessonWorkspace] occurrence load failed', workspaceError)
    occurrenceError = 'Could not load the lesson teaching state.'
  }

  return {
    teacherId: user.id,
    context,
    existingPlan,
    source,
    sourceLinked,
    sourceError,
    sourceBundle,
    sourceBundleError,
    canonicalIdentity,
    occurrence,
    occurrenceError,
  }
}


/**
 * Restore a teacher-selected lesson directly from its persisted Plan or Scheme ID.
 * The URL may omit timetable fields; these are recovered from the saved Plan,
 * never invented from today's timetable. Scheme-only preparation stays available.
 * This is a read-only viewer, not an authorization to deliver candidate assets.
 */
export async function loadSavedTeacherGuide({
  lessonPlanId,
  schemeId,
  classId,
  subjectId,
  subjectName = '',
  expectedOccurrenceId = null,
}: {
  lessonPlanId?: string | null
  schemeId?: string | null
  classId?: string | null
  subjectId?: string | null
  subjectName?: string
  expectedOccurrenceId?: string | null
}): Promise<LessonWorkspaceBootResult | null> {
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError) throw authError
  if (!user) return null
  if (!lessonPlanId && !schemeId) throw new Error('Choose an actual lesson plan or Scheme lesson.')

  const { data: plan, error: planError } = lessonPlanId
    ? await supabase.from('lesson_plans')
      .select('id,title,body,topic,status,curriculum_id,strand_id,scheme_id,teacher_id,school_id,class_id,subject_id,timetable_slot_id,taught_date')
      .eq('id', lessonPlanId).eq('teacher_id',user.id).maybeSingle()
    : { data: null, error: null }
  if (planError) throw planError
  if (lessonPlanId && !plan) throw new Error('The saved lesson is not available to this teacher.')
  if (plan && schemeId && plan.scheme_id !== schemeId) {
    throw new Error('The requested Scheme is not linked to this lesson plan.')
  }

  const savedSchemeId = plan?.scheme_id ?? schemeId
  if (!savedSchemeId) throw new Error('The selected lesson has no saved Scheme authority.')
  const { data: scheme, error: schemeError } = await supabase
    .from('scheme_of_work')
    .select('id,teacher_id,school_id,class_id,subject_id,curriculum_id,sub_strand_id')
    .eq('id', savedSchemeId).eq('teacher_id', user.id).maybeSingle()
  if (schemeError) throw schemeError
  if (!scheme) throw new Error('This Scheme lesson is not available to this teacher.')
  if (!scheme.class_id || !scheme.subject_id || !scheme.school_id) {
    throw new Error('The selected Scheme has an incomplete teaching assignment.')
  }
  if ((classId && classId !== scheme.class_id) ||
      (subjectId && subjectId !== scheme.subject_id) ||
      (plan && (plan.teacher_id !== user.id ||
        plan.school_id !== scheme.school_id ||
        plan.class_id !== scheme.class_id ||
        plan.subject_id !== scheme.subject_id))) {
    throw new Error('The requested lesson and Scheme do not belong to the same teacher, school, class and subject.')
  }

  // A saved, dated plan can reuse the existing canonical scheduled resolver.
  if (plan?.timetable_slot_id && plan.taught_date) {
    return loadLessonWorkspace({
      timetableSlotId: plan.timetable_slot_id,
      occurrenceDate: plan.taught_date,
      classId: scheme.class_id,
      subjectId: scheme.subject_id,
      subjectName,
      requestedSchemeId: savedSchemeId,
      expectedLessonPlanId: plan.id,
      expectedOccurrenceId,
    })
  }
  if (expectedOccurrenceId) throw new Error('This Scheme lesson has no matching teaching occurrence.')

  // Date is only used for optional history in the existing class context loader,
  // not as a requirement for lesson planning or as a fabricated occurrence.
  const context = await loadLessonContext({
    userId: user.id,
    classId: scheme.class_id,
    subjectId: scheme.subject_id,
    occurrenceDate: nairobiDateStr(),
  })
  if (context.schoolId !== scheme.school_id) {
    throw new Error('The Scheme belongs to a different teaching assignment.')
  }
  const existingPlan: ExistingLessonPlan | null = plan ? {
    id: plan.id, title: plan.title, body: plan.body, topic: plan.topic,
    status: plan.status as ExistingLessonPlan['status'],
    curriculum_id: plan.curriculum_id, strand_id: plan.strand_id,
    scheme_id: plan.scheme_id,
  } : null

  const source = await restorePersistedLessonSource(existingPlan ?? {
    id: '', title: null, body: null, topic: null, status: null,
    curriculum_id: scheme.curriculum_id,
    strand_id: scheme.sub_strand_id,
    scheme_id: scheme.id,
  })
  let sourceBundle: CanonicalLessonSourceBundle | null = null
  let sourceBundleError: string | null = null
  try {
    sourceBundle = await buildCanonicalLessonSourceBundle({
      timetableSlotId: '', occurrenceDate: '',
      classId: scheme.class_id, subjectId: scheme.subject_id,
      subjectName, context, source,
    })
  } catch (cause) {
    console.error('[teacher-guide] Scheme material lookup failed', cause)
    sourceBundleError = 'Certified resources could not be loaded. Scheme guidance is still available.'
  }
  return {
    teacherId: user.id, context, existingPlan,
    source, sourceLinked: source !== null,
    sourceError: null, sourceBundle, sourceBundleError,
    canonicalIdentity: buildCanonicalIdentity(sourceBundle, scheme.subject_id, context.grade),
    occurrence: null, occurrenceError: null,
  }
}
