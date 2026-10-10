import { supabase } from '@/lib/supabase'
import { readProgressPages } from '@/lib/learner-intelligence/progress-data'
import { nairobiDateStr } from '@/lib/time'

export type AssessmentContext = {
  teacherId: string
  schoolId: string
  schools: Array<{ id: string; name: string }>
  classes: Array<{ id: string; name: string }>
  subjects: Array<{ id: string; name: string; classId: string }>
  terms: Array<{ id: string; name: string; start: string; end: string }>
  assignments: Array<{
    id: string
    assessmentId: string
    classId: string
    subjectId: string
    title: string
    type: string
    assignedAt: string | null
    closesAt: string | null
    status: string
  }>
}
export type AssessmentSelection = {
  classId: string
  subjectId: string
  termId: string
  assignmentId: string
}
export const emptySelection: AssessmentSelection = {
  classId: '',
  subjectId: '',
  termId: '',
  assignmentId: '',
}
function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('Assessment context could not be confirmed. Retry or check your school access.')
  return value as Record<string, unknown>
}
function text(value: unknown): string {
  return typeof value === 'string' ? value : ''
}
export async function loadAssessmentContext(): Promise<AssessmentContext> {
  const auth = await supabase.auth.getUser()
  if (auth.error || !auth.data.user) throw new Error('Sign in again to open assessments.')
  const result = await supabase.rpc('teacher_get_operating_context')
  if (result.error) throw new Error(result.error.message)
  const raw = record(result.data),
    teacherId = auth.data.user.id,
    schoolId = text(raw.school_id)
  if (raw.teacher_id !== teacherId || !schoolId)
    throw new Error('Connect a verified teaching school before opening assessments.')
  const authority = (Array.isArray(raw.classes) ? raw.classes : []).map(record)
  const classes = Array.from(
    new Map(
      authority.map((c) => [
        text(c.class_id),
        {
          id: text(c.class_id),
          name: [text(c.class_name), text(c.stream)].filter(Boolean).join(' '),
        },
      ]),
    ).values(),
  )
  const subjects = authority.map((c) => ({
    id: text(c.subject_id),
    name: text(c.subject_name),
    classId: text(c.class_id),
  }))
  const schools = (Array.isArray(raw.schools) ? raw.schools : []).map((s) => {
    const r = record(s)
    return { id: text(r.id), name: text(r.name) }
  })
  if (!schools.some((s) => s.id === schoolId))
    throw new Error('Your active school membership could not be confirmed.')
  const [rows, termResult] = await Promise.all([
    classes.length
      ? readProgressPages((from, to) =>
          supabase
            .from('assessment_assignments')
            .select(
              'id,assessment_id,class_id,school_id,assigned_at,closes_at,status,assessment_definitions(title,assessment_type,subject_id)',
            )
            .eq('teacher_id', teacherId)
            .eq('school_id', schoolId)
            .in(
              'class_id',
              classes.map((c) => c.id),
            )
            .order('created_at', { ascending: false })
            .order('id')
            .range(from, to),
        )
      : Promise.resolve([]),
    supabase
      .from('academic_terms')
      .select('id,name,start_date,end_date')
      .eq('school_id', schoolId)
      .order('start_date', { ascending: false }),
  ])
  if (termResult.error)
    throw new Error('School terms could not be loaded. Retry before filtering results.')
  const assignments = rows
    .map((value) => {
      const row = record(value),
        definition = record(row.assessment_definitions)
      const item = {
        id: text(row.id),
        assessmentId: text(row.assessment_id),
        classId: text(row.class_id),
        subjectId: text(definition.subject_id),
        title: text(definition.title),
        type: text(definition.assessment_type),
        assignedAt: text(row.assigned_at) || null,
        closesAt: text(row.closes_at) || null,
        status: text(row.status),
      }
      if (!item.id || !item.assessmentId || !item.title || row.school_id !== schoolId)
        throw new Error('An assessment needs context reconciliation. No partial list is shown.')
      return item
    })
    .filter((a) => subjects.some((s) => s.classId === a.classId && s.id === a.subjectId))
  return {
    teacherId,
    schoolId,
    schools,
    classes,
    subjects,
    assignments,
    terms: (termResult.data ?? []).map((t) => ({
      id: t.id,
      name: t.name,
      start: t.start_date,
      end: t.end_date,
    })),
  }
}
export function visibleAssignments(ctx: AssessmentContext, s: AssessmentSelection) {
  const term = ctx.terms.find((t) => t.id === s.termId)
  return ctx.assignments.filter(
    (a) =>
      (!s.classId || a.classId === s.classId) &&
      (!s.subjectId || a.subjectId === s.subjectId) &&
      (!term ||
        Boolean(
          a.assignedAt &&
          nairobiDateStr(new Date(a.assignedAt)) >= term.start &&
          nairobiDateStr(new Date(a.assignedAt)) <= term.end,
        )),
  )
}
export function reconcileSelection(
  ctx: AssessmentContext,
  value: Partial<AssessmentSelection>,
): AssessmentSelection {
  const s = { ...emptySelection, ...value }
  if (!ctx.classes.some((c) => c.id === s.classId)) s.classId = ''
  if (
    !ctx.subjects.some(
      (subject) => subject.id === s.subjectId && (!s.classId || subject.classId === s.classId),
    )
  )
    s.subjectId = ''
  if (!ctx.terms.some((t) => t.id === s.termId)) s.termId = ''
  const selected = visibleAssignments(ctx, s).find((a) => a.id === s.assignmentId)
  if (!selected) s.assignmentId = ''
  else {
    s.classId = selected.classId
    s.subjectId = selected.subjectId
  }
  return s
}
export function contextQuery(selection: AssessmentSelection) {
  return new URLSearchParams(
    Object.entries(selection).filter(([, value]) => Boolean(value)),
  ).toString()
}
export function parseMark(value: string, max: number) {
  if (!value.trim()) throw new Error('Enter a mark. An unmarked answer is not zero.')
  const score = Number(value)
  if (!Number.isFinite(score) || !Number.isFinite(max) || max < 0 || score < 0 || score > max)
    throw new Error(`Enter a mark from 0 to ${max}.`)
  return score
}
export function safeCsvCell(value: unknown) {
  const s = String(value ?? '')
  return '"' + (/^[\s]*[=+@-]/.test(s) ? "'" + s : s).replaceAll('"', '""') + '"'
}

export type OutcomeQuestion = {
  id: string
  order: number
  prompt: string
  outcomeIds: string[]
}
export async function loadAssessmentOutcomeQuestions(
  assessmentId: string,
): Promise<OutcomeQuestion[]> {
  const rows = await readProgressPages((from, to) =>
    supabase
      .from('assessment_items')
      .select('id,order_num,prompt,assessment_item_outcomes(outcome_id)')
      .eq('assessment_id', assessmentId)
      .order('order_num')
      .order('id')
      .range(from, to),
  )
  return rows.map((value) => {
    const row = record(value)
    if (!text(row.id) || !Array.isArray(row.assessment_item_outcomes))
      throw new Error('Question outcome links could not be confirmed.')
    return {
      id: text(row.id),
      order: Number(row.order_num),
      prompt: text(row.prompt),
      outcomeIds: row.assessment_item_outcomes.map((value) => text(record(value).outcome_id)),
    }
  })
}

/** Same paper/context and matched released learner denominators; no inferred cohort trend. */
export function compareReleasedResults(
  before: Array<{
    studentId: string
    attemptStatus: string | null
    resultStatus: string | null
    score: number | null
    maxScore: number | null
  }>,
  after: Array<{
    studentId: string
    attemptStatus: string | null
    resultStatus: string | null
    score: number | null
    maxScore: number | null
  }>,
) {
  const eligible = (row: (typeof before)[number]) =>
    row.attemptStatus === 'released' &&
    row.resultStatus === 'released' &&
    row.score !== null &&
    row.maxScore !== null &&
    row.maxScore > 0
  const earlier = new Map(before.filter(eligible).map((row) => [row.studentId, row]))
  const pairs = after.filter(eligible).flatMap((row) => {
    const previous = earlier.get(row.studentId)
    return previous && previous.maxScore === row.maxScore
      ? [
          {
            before: (100 * previous.score!) / previous.maxScore!,
            after: (100 * row.score!) / row.maxScore!,
          },
        ]
      : []
  })
  if (!pairs.length) return null
  const averageBefore = pairs.reduce((sum, pair) => sum + pair.before, 0) / pairs.length,
    averageAfter = pairs.reduce((sum, pair) => sum + pair.after, 0) / pairs.length
  return {
    learnerCount: pairs.length,
    averageBefore,
    averageAfter,
    change: averageAfter - averageBefore,
  }
}
