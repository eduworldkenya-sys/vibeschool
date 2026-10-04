import { supabase } from '@/lib/supabase'

export type VibeLearnUseIntent =
  | 'teacher_reference'
  | 'learner_reading'
  | 'teach_now'
  | 'practice'
  | 'homework'
  | 'assessment'
  | 'remedial'
  | 'enrichment'

export type VibeLearnAssignmentOption = {
  classId: string
  className: string
  classStream: string | null
  subjectId: string
  subjectName: string
  schoolId: string
}

export type VibeLearnFocus = {
  schemeId: string | null
  lessonPlanId: string | null
  grade: string | null
  strand: string | null
  subStrand: string | null
  topic: string | null
  objective: string | null
  date: string | null
  status: string | null
}

export type VibeLearnOutcome = {
  id: string
  text: string
  code: string | null
  bloomLevel: string | null
  difficulty: string | null
  prerequisites: Array<{ id: string; text: string; minimumMastery: number | null }>
}

export type VibeLearnResource = {
  id: string
  title: string
  description: string | null
  sourceType: string
  assetKind: string | null
  purpose: string | null
  grade: string | null
  subject: string | null
  strand: string | null
  learningOutcomes: string[]
  visibility: string
  certified: boolean
  adopted: boolean
  adoptedRole: string | null
  score: number
  reasons: string[]
  href: string | null
}

export type VibeLearnWorkspace = {
  assignments: VibeLearnAssignmentOption[]
  selected: VibeLearnAssignmentOption | null
  focus: VibeLearnFocus | null
  outcomes: VibeLearnOutcome[]
  resources: VibeLearnResource[]
  attention: {
    openInterventions: number
    highPriority: number
    learnersNeedingSupport: number
  }
}

type WorkspaceInput = {
  classId?: string | null
  subjectId?: string | null
  query?: string
}

type LearningResourceRow = {
  id: string
  source_type: string
  publication_id: string | null
  chapter_id: string | null
  content_id: string | null
  title: string
  description: string | null
  subject_id: string | null
  curriculum_id: string | null
  sub_strand_id: string | null
  grade: string | null
  subject: string | null
  strand: string | null
  learning_outcomes: string[] | null
  status: string
  visibility: string
}

function norm(value: string | null | undefined): string {
  return (value ?? '').toLowerCase().replace(/[^a-z0-9]/g, '')
}

function resourceHref(row: LearningResourceRow): string | null {
  if (row.source_type === 'chapter' && row.publication_id && row.chapter_id) {
    return `/read/textbook/${row.publication_id}/${row.chapter_id}`
  }
  if (row.source_type === 'publication' && row.publication_id) {
    return `/read/textbook/${row.publication_id}`
  }
  if (row.source_type === 'content_block' && row.publication_id && row.chapter_id) {
    return `/read/textbook/${row.publication_id}/${row.chapter_id}`
  }
  if (row.source_type === 'vibelearn_content' && row.content_id) {
    return `/global/read/${row.content_id}`
  }
  return null
}

function chooseAssignment(
  assignments: VibeLearnAssignmentOption[],
  classId?: string | null,
  subjectId?: string | null,
): VibeLearnAssignmentOption | null {
  if (!assignments.length) return null
  const exact = assignments.find(row =>
    (!classId || row.classId === classId) &&
    (!subjectId || row.subjectId === subjectId)
  )
  if (exact) return exact
  if (classId) {
    const byClass = assignments.find(row => row.classId === classId)
    if (byClass) return byClass
  }
  if (subjectId) {
    const bySubject = assignments.find(row => row.subjectId === subjectId)
    if (bySubject) return bySubject
  }
  return assignments[0]
}

function chooseFocus(rows: any[]): any | null {
  if (!rows.length) return null
  const today = new Date().toISOString().slice(0, 10)
  const unfinished = rows.filter(row => !['taught', 'completed', 'done'].includes(String(row.status ?? '').toLowerCase()))
  return unfinished.find(row => row.date && row.date >= today)
    ?? unfinished[0]
    ?? rows[rows.length - 1]
}

function dedupeResources(rows: LearningResourceRow[]): LearningResourceRow[] {
  const map = new Map<string, LearningResourceRow>()
  for (const row of rows) map.set(row.id, row)
  return [...map.values()]
}

export async function loadTeacherVibeLearnWorkspace(input: WorkspaceInput = {}): Promise<VibeLearnWorkspace> {
  const { data: auth, error: authError } = await supabase.auth.getUser()
  if (authError) throw authError
  const user = auth.user
  if (!user) throw new Error('AUTH_REQUIRED')

  const assignmentResult = await supabase
    .from('teacher_classes')
    .select('class_id,subject_id,school_id')
    .eq('teacher_id', user.id)

  if (assignmentResult.error) throw assignmentResult.error
  const rawAssignments = assignmentResult.data ?? []
  const classIds = Array.from(new Set(
    rawAssignments
      .map(row => row.class_id)
      .filter((id): id is string => typeof id === 'string' && id.length > 0),
  ))
  const subjectIds = Array.from(new Set(
    rawAssignments
      .map(row => row.subject_id)
      .filter((id): id is string => typeof id === 'string' && id.length > 0),
  ))

  const classRows: Array<{ id: string; name: string; stream: string | null }> = []
  if (classIds.length > 0) {
    const result = await supabase.from('classes').select('id,name,stream').in('id', classIds)
    if (result.error) throw result.error
    for (const row of result.data ?? []) {
      classRows.push({ id: row.id, name: row.name, stream: row.stream ?? null })
    }
  }

  const subjectRows: Array<{ id: string; name: string }> = []
  if (subjectIds.length > 0) {
    const result = await supabase.from('subjects').select('id,name').in('id', subjectIds)
    if (result.error) throw result.error
    for (const row of result.data ?? []) {
      subjectRows.push({ id: row.id, name: row.name })
    }
  }

  const classes = new Map<string, { name: string; stream: string | null }>()
  for (const row of classRows) classes.set(row.id, { name: row.name, stream: row.stream })
  const subjects = new Map<string, { name: string }>()
  for (const row of subjectRows) subjects.set(row.id, { name: row.name })

  const assignments: VibeLearnAssignmentOption[] = rawAssignments.flatMap(row => {
    if (!row.class_id || !row.subject_id || !row.school_id) return []
    const cls = classes.get(row.class_id)
    const subject = subjects.get(row.subject_id)
    if (!cls || !subject) return []
    return [{
      classId: row.class_id,
      className: cls.name,
      classStream: cls.stream,
      subjectId: row.subject_id,
      subjectName: subject.name,
      schoolId: row.school_id,
    }]
  })

  const selected = chooseAssignment(assignments, input.classId, input.subjectId)
  if (!selected) {
    return {
      assignments,
      selected: null,
      focus: null,
      outcomes: [],
      resources: [],
      attention: { openInterventions: 0, highPriority: 0, learnersNeedingSupport: 0 },
    }
  }

  const [schemeResult, lessonPlanResult, libraryResult, interventionsResult] = await Promise.all([
    supabase
      .from('scheme_of_work')
      .select('id,curriculum_id,sub_strand_id,grade,strand,sub_strand,topic,objectives,date,status,sequence_number')
      .eq('teacher_id', user.id)
      .eq('class_id', selected.classId)
      .eq('subject_id', selected.subjectId)
      .order('sequence_number', { ascending: true })
      .limit(80),
    supabase
      .from('lesson_plans')
      .select('id,topic,objectives,status,taught_date,week_start,created_at')
      .eq('teacher_id', user.id)
      .eq('class_id', selected.classId)
      .eq('subject_id', selected.subjectId)
      .order('created_at', { ascending: false })
      .limit(12),
    supabase
      .from('class_resource_library')
      .select('resource_id,usage_role,status')
      .eq('class_id', selected.classId)
      .eq('subject_id', selected.subjectId)
      .eq('status', 'active'),
    supabase
      .from('assessment_interventions')
      .select('student_id,priority,status,outcome_id')
      .eq('teacher_id', user.id)
      .eq('class_id', selected.classId)
      .eq('subject_id', selected.subjectId)
      .limit(100),
  ])

  if (schemeResult.error) throw schemeResult.error
  if (lessonPlanResult.error) throw lessonPlanResult.error
  if (libraryResult.error) throw libraryResult.error
  if (interventionsResult.error) throw interventionsResult.error

  const focusRow = chooseFocus(schemeResult.data ?? [])
  const lessonPlan = (lessonPlanResult.data ?? []).find(row => !row.taught_date)
    ?? lessonPlanResult.data?.[0]
    ?? null

  const focus: VibeLearnFocus | null = focusRow || lessonPlan ? {
    schemeId: focusRow?.id ?? null,
    lessonPlanId: lessonPlan?.id ?? null,
    grade: focusRow?.grade ?? selected.className ?? null,
    strand: focusRow?.strand ?? null,
    subStrand: focusRow?.sub_strand ?? null,
    topic: focusRow?.topic ?? lessonPlan?.topic ?? null,
    objective: focusRow?.objectives ?? lessonPlan?.objectives ?? null,
    date: focusRow?.date ?? lessonPlan?.week_start ?? null,
    status: focusRow?.status ?? lessonPlan?.status ?? null,
  } : null

  const outcomeQuery = focusRow?.sub_strand_id
    ? supabase
        .from('curriculum_learning_outcomes')
        .select('id,outcome_text,outcome_code,bloom_level,difficulty,status')
        .eq('sub_strand_id', focusRow.sub_strand_id)
        .eq('status', 'verified')
        .limit(20)
    : focusRow?.curriculum_id
      ? supabase
          .from('curriculum_learning_outcomes')
          .select('id,outcome_text,outcome_code,bloom_level,difficulty,status')
          .eq('curriculum_id', focusRow.curriculum_id)
          .eq('status', 'verified')
          .limit(20)
      : null

  const outcomeResult = outcomeQuery ? await outcomeQuery : { data: [], error: null }
  if (outcomeResult.error) throw outcomeResult.error
  const outcomeRows = outcomeResult.data ?? []
  const outcomeIds = outcomeRows.map(row => row.id)

  const prerequisiteResult = outcomeIds.length
    ? await supabase
        .from('curriculum_outcome_prerequisites')
        .select('outcome_id,prerequisite_outcome_id,minimum_mastery')
        .in('outcome_id', outcomeIds)
    : { data: [], error: null }
  if (prerequisiteResult.error) throw prerequisiteResult.error

  const prerequisiteIds: string[] = []
  for (const row of prerequisiteResult.data ?? []) {
    if (
      typeof row.prerequisite_outcome_id === 'string' &&
      !prerequisiteIds.includes(row.prerequisite_outcome_id)
    ) {
      prerequisiteIds.push(row.prerequisite_outcome_id)
    }
  }

  const prerequisiteText = new Map<string, string>()
  if (prerequisiteIds.length > 0) {
    const prerequisiteTextResult = await supabase
      .from('curriculum_learning_outcomes')
      .select('id,outcome_text')
      .in('id', prerequisiteIds)
    if (prerequisiteTextResult.error) throw prerequisiteTextResult.error
    for (const row of prerequisiteTextResult.data ?? []) {
      prerequisiteText.set(row.id, row.outcome_text)
    }
  }

  const outcomes: VibeLearnOutcome[] = outcomeRows.map(row => ({
    id: row.id,
    text: row.outcome_text,
    code: row.outcome_code ?? null,
    bloomLevel: row.bloom_level ?? null,
    difficulty: row.difficulty ?? null,
    prerequisites: (prerequisiteResult.data ?? [])
      .filter(link => link.outcome_id === row.id)
      .map(link => ({
        id: link.prerequisite_outcome_id,
        text: prerequisiteText.get(link.prerequisite_outcome_id) ?? 'Required prior outcome',
        minimumMastery: link.minimum_mastery == null ? null : Number(link.minimum_mastery),
      })),
  }))

  const [subjectResourceResult, textSubjectResourceResult] = await Promise.all([
    supabase
      .from('learning_resources')
      .select('id,source_type,publication_id,chapter_id,content_id,title,description,subject_id,curriculum_id,sub_strand_id,grade,subject,strand,learning_outcomes,status,visibility')
      .eq('status', 'active')
      .eq('subject_id', selected.subjectId)
      .limit(120),
    supabase
      .from('learning_resources')
      .select('id,source_type,publication_id,chapter_id,content_id,title,description,subject_id,curriculum_id,sub_strand_id,grade,subject,strand,learning_outcomes,status,visibility')
      .eq('status', 'active')
      .ilike('subject', selected.subjectName)
      .limit(120),
  ])
  if (subjectResourceResult.error) throw subjectResourceResult.error
  if (textSubjectResourceResult.error) throw textSubjectResourceResult.error

  let resourceRows = dedupeResources([
    ...((subjectResourceResult.data ?? []) as LearningResourceRow[]),
    ...((textSubjectResourceResult.data ?? []) as LearningResourceRow[]),
  ])

  const query = (input.query ?? '').trim().toLowerCase()
  if (query) {
    resourceRows = resourceRows.filter(row => [
      row.title,
      row.description,
      row.subject,
      row.grade,
      row.strand,
      ...(row.learning_outcomes ?? []),
    ].some(value => String(value ?? '').toLowerCase().includes(query)))
  }

  const resourceIds = resourceRows.map(row => row.id)
  const certificationResult = resourceIds.length
    ? await supabase
        .from('learning_resource_versions')
        .select('resource_id')
        .in('resource_id', resourceIds)
        .eq('lifecycle_status', 'certified')
    : { data: [], error: null }
  if (certificationResult.error) throw certificationResult.error

  const certifiedIds = new Set<string>()
  for (const row of certificationResult.data ?? []) {
    if (typeof row.resource_id === 'string') certifiedIds.add(row.resource_id)
  }

  const adoptedById = new Map<string, string>()
  for (const row of libraryResult.data ?? []) {
    if (typeof row.resource_id === 'string' && typeof row.usage_role === 'string') {
      adoptedById.set(row.resource_id, row.usage_role)
    }
  }
  const gradeKey = norm(focus?.grade ?? selected.className)
  const subjectKey = norm(selected.subjectName)

  const resources: VibeLearnResource[] = resourceRows.map(row => {
    const reasons: string[] = []
    let score = 0
    if (focusRow?.sub_strand_id && row.sub_strand_id === focusRow.sub_strand_id) {
      score += 60
      reasons.push('Matches the current sub-strand')
    }
    if (focusRow?.curriculum_id && row.curriculum_id === focusRow.curriculum_id) {
      score += 40
      reasons.push('Matches the current curriculum item')
    }
    if (row.subject_id === selected.subjectId) {
      score += 35
      reasons.push('Exact subject match')
    } else if (norm(row.subject) === subjectKey) {
      score += 30
      reasons.push('Subject match')
    }
    if (gradeKey && norm(row.grade) === gradeKey) {
      score += 20
      reasons.push('Grade match')
    }
    if (certifiedIds.has(row.id)) {
      score += 12
      reasons.push('Certified VibeSchool resource')
    }
    if (adoptedById.has(row.id)) {
      score += 5
      reasons.push('Already in this class library')
    }
    if (query) {
      score += 25
      reasons.push('Matches your search')
    }
    return {
      id: row.id,
      title: row.title,
      description: row.description,
      sourceType: row.source_type,
      assetKind: null,
      purpose: null,
      grade: row.grade,
      subject: row.subject,
      strand: row.strand,
      learningOutcomes: row.learning_outcomes ?? [],
      visibility: row.visibility,
      certified: certifiedIds.has(row.id),
      adopted: adoptedById.has(row.id),
      adoptedRole: adoptedById.get(row.id) ?? null,
      score,
      reasons,
      href: resourceHref(row),
    }
  }).sort((a, b) => b.score - a.score || a.title.localeCompare(b.title)).slice(0, 60)

  const activeInterventions = (interventionsResult.data ?? []).filter(row =>
    !['completed', 'resolved', 'dismissed', 'closed'].includes(String(row.status ?? '').toLowerCase())
  )
  const learnerIds = new Set(activeInterventions.map(row => row.student_id).filter(Boolean))

  return {
    assignments,
    selected,
    focus,
    outcomes,
    resources,
    attention: {
      openInterventions: activeInterventions.length,
      highPriority: activeInterventions.filter(row => ['high', 'urgent', 'critical'].includes(String(row.priority ?? '').toLowerCase())).length,
      learnersNeedingSupport: learnerIds.size,
    },
  }
}

const CLASS_ROLE_BY_INTENT: Record<VibeLearnUseIntent, string> = {
  teacher_reference: 'teacher_reference',
  learner_reading: 'learner_reading',
  teach_now: 'primary',
  practice: 'exercise',
  homework: 'supplementary',
  assessment: 'assessment_source',
  remedial: 'remedial',
  enrichment: 'enrichment',
}

const LESSON_ROLE_BY_INTENT: Partial<Record<VibeLearnUseIntent, string>> = {
  teacher_reference: 'teacher_notes',
  learner_reading: 'learner_reading',
  teach_now: 'in_class',
  practice: 'after_class',
  homework: 'homework_source',
  assessment: 'assessment_source',
  remedial: 'after_class',
  enrichment: 'after_class',
}

export async function useVibeLearnResource(input: {
  resourceId: string
  classId: string
  subjectId: string
  intent: VibeLearnUseIntent
  lessonPlanId?: string | null
}): Promise<{ libraryId: string; lessonLinked: boolean; warning: string | null }> {
  const { data, error } = await supabase.rpc('ce_add_resource_to_class_library', {
    p_resource_id: input.resourceId,
    p_class_id: input.classId,
    p_subject_id: input.subjectId,
    p_usage_role: CLASS_ROLE_BY_INTENT[input.intent],
  })
  if (error) throw error
  if (typeof data !== 'string') throw new Error('CLASS_LIBRARY_ADOPTION_FAILED')

  const lessonRole = LESSON_ROLE_BY_INTENT[input.intent]
  if (!input.lessonPlanId || !lessonRole) {
    return { libraryId: data, lessonLinked: false, warning: null }
  }

  const link = await supabase.rpc('link_learning_resource', {
    p_resource_id: input.resourceId,
    p_target_type: 'lesson_plan',
    p_target_id: input.lessonPlanId,
    p_usage_role: lessonRole,
    p_sequence: 1,
    p_page_start: null,
    p_page_end: null,
    p_section_refs: [],
    p_exercise_refs: [],
  })

  const payload = link.data as { ok?: boolean; error?: string } | null
  if (link.error || !payload?.ok) {
    return {
      libraryId: data,
      lessonLinked: false,
      warning: 'Added to the class library, but it could not be linked to the prepared lesson.',
    }
  }

  return { libraryId: data, lessonLinked: true, warning: null }
}
