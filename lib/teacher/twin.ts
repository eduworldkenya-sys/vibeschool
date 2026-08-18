import { supabase } from '@/lib/supabase'
import type { Json } from '@/lib/database.types'
import { getTwinAuthorityContext, selectTwinRoleBinding } from '@/lib/twin/core'

type RpcResult<T> = { data: T | null; error: { message?: string } | null }
type Rpc = <T>(name: string, args?: Record<string, unknown>) => PromiseLike<RpcResult<T>>
const rpc = supabase.rpc.bind(supabase) as unknown as Rpc

function record(value: unknown): Record<string, unknown> { return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {} }
function text(value: unknown): string | null { return typeof value === 'string' ? value : null }
function numberOrNull(value: unknown): number | null {
  if (value === null || value === undefined) return null
  const result = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(result) ? result : null
}
function strings(value: unknown): string[] { return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [] }
function jsonArray(value: unknown): Json[] { return Array.isArray(value) ? value as Json[] : [] }

export interface TeacherTwinDecision {
  decisionType: string
  title: string
  reason: string | null
  reasonChain: string[]
  actionUrl: string | null
  actionLabel: string | null
  priority: string
  count: number | null
  value: number | null
  raw: Json
}

export interface TeacherTwinMemoryClaim {
  type: string
  claimKey: string
  claim: string
  confidence: number
  evidenceCount: number
  importance: number
  lastConfirmedAt: string | null
  provenance: Json
}

export interface TeacherTwinState {
  teacherId: string
  schoolId: string
  fullName: string
  generatedAt: string
  confidence: number
  evidence: {
    assignedClasses: number
    completedToday: number
    inProgressToday: number
    attendancePending: number
    pendingMarking: number
    openInterventions: number
    studentTwinAttention: number
    overdueSchemeItems: number
    reflectionGaps7d: number
    evaluatedInterventions: number
    meanInterventionMasteryChange: number | null
  }
  context: {
    todaySchedule: Json[]
    atRiskStudents: Json[]
    homeworkDue: Json[]
    unreadThreads: number
    attendanceStreak: number
    tpadDue: string | null
    tpadDays: number | null
    creditBalance: number | null
  }
  decision: {
    now: TeacherTwinDecision | null
    next: TeacherTwinDecision[]
    later: TeacherTwinDecision[]
    rule: string | null
  }
  memory: { claims: TeacherTwinMemoryClaim[]; rule: string | null }
  guardrails: {
    aiIsNotAuthority: boolean
    mustNotInventEvidence: boolean
    mustNotOverrideTeacherRecords: boolean
    mustUseAuthenticatedContext: boolean
  }
}

export interface TeacherTwinReply {
  text: string
  actionUrl?: string | null
  actionLabel?: string | null
}

function parseDecision(value: unknown): TeacherTwinDecision | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const row = record(value)
  return {
    decisionType: text(row.decision_type) ?? 'workflow',
    title: text(row.title) ?? 'Teacher priority',
    reason: text(row.reason),
    reasonChain: strings(row.reason_chain),
    actionUrl: text(row.action_url),
    actionLabel: text(row.action_label),
    priority: text(row.priority) ?? 'calm',
    count: numberOrNull(row.count),
    value: numberOrNull(row.value),
    raw: row as Json,
  }
}

function parseMemory(value: unknown): TeacherTwinMemoryClaim[] {
  return (Array.isArray(value) ? value : []).map(item => {
    const row = record(item)
    return {
      type: text(row.type) ?? 'teaching_pattern',
      claimKey: text(row.claim_key) ?? '',
      claim: text(row.claim) ?? 'Teacher workflow memory',
      confidence: numberOrNull(row.confidence) ?? 0,
      evidenceCount: numberOrNull(row.evidence_count) ?? 0,
      importance: numberOrNull(row.importance) ?? 0.5,
      lastConfirmedAt: text(row.last_confirmed_at),
      provenance: (row.provenance ?? {}) as Json,
    }
  })
}

export async function getTeacherTwinState(): Promise<TeacherTwinState> {
  const authority = await getTwinAuthorityContext()
  const binding = selectTwinRoleBinding(authority, 'teacher')

  const { data, error } = await rpc<Json>('teacher_get_twin_brain')
  if (error) throw new Error(error.message || 'Your Teacher Twin state could not be loaded.')

  const state = record(data)
  const schoolId = text(state.school_id) ?? ''
  if (!schoolId || schoolId !== binding.schoolId) {
    throw new Error('Teacher Twin brain returned a school outside the selected authority binding.')
  }

  const evidence = record(state.evidence)
  const context = record(state.context)
  const decision = record(state.decision)
  const memory = record(state.memory)
  const guardrails = record(state.guardrails)
  const next = Array.isArray(decision.next) ? decision.next : []
  const later = Array.isArray(decision.later) ? decision.later : []

  return {
    teacherId: text(state.teacher_id) ?? '', schoolId,
    fullName: text(state.full_name) ?? 'Teacher',
    generatedAt: text(state.generated_at) ?? new Date().toISOString(),
    confidence: numberOrNull(state.confidence) ?? 0,
    evidence: {
      assignedClasses: numberOrNull(evidence.assigned_classes) ?? 0,
      completedToday: numberOrNull(evidence.completed_today) ?? 0,
      inProgressToday: numberOrNull(evidence.in_progress_today) ?? 0,
      attendancePending: numberOrNull(evidence.attendance_pending) ?? 0,
      pendingMarking: numberOrNull(evidence.pending_marking) ?? 0,
      openInterventions: numberOrNull(evidence.open_interventions) ?? 0,
      studentTwinAttention: numberOrNull(evidence.student_twin_attention) ?? 0,
      overdueSchemeItems: numberOrNull(evidence.overdue_scheme_items) ?? 0,
      reflectionGaps7d: numberOrNull(evidence.reflection_gaps_7d) ?? 0,
      evaluatedInterventions: numberOrNull(evidence.evaluated_interventions) ?? 0,
      meanInterventionMasteryChange: numberOrNull(evidence.mean_intervention_mastery_change),
    },
    context: {
      todaySchedule: jsonArray(context.today_schedule), atRiskStudents: jsonArray(context.at_risk_students), homeworkDue: jsonArray(context.homework_due),
      unreadThreads: numberOrNull(context.unread_threads) ?? 0, attendanceStreak: numberOrNull(context.attendance_streak) ?? 0,
      tpadDue: text(context.tpad_due), tpadDays: numberOrNull(context.tpad_days), creditBalance: numberOrNull(context.credit_balance),
    },
    decision: {
      now: parseDecision(decision.now),
      next: next.map(parseDecision).filter((item): item is TeacherTwinDecision => item !== null),
      later: later.map(parseDecision).filter((item): item is TeacherTwinDecision => item !== null),
      rule: text(decision.rule),
    },
    memory: { claims: parseMemory(memory.claims), rule: text(memory.rule) },
    guardrails: {
      aiIsNotAuthority: guardrails.ai_is_not_authority === true,
      mustNotInventEvidence: guardrails.must_not_invent_evidence === true,
      mustNotOverrideTeacherRecords: guardrails.must_not_override_teacher_records === true,
      mustUseAuthenticatedContext: guardrails.must_use_authenticated_context === true,
    },
  }
}

function eatMinutesNow(): number {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Africa/Nairobi', hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(new Date())
  const hour = Number(parts.find(part => part.type === 'hour')?.value ?? 0)
  const minute = Number(parts.find(part => part.type === 'minute')?.value ?? 0)
  return hour * 60 + minute
}
function timeMinutes(value: unknown): number | null {
  const raw = text(value)
  if (!raw) return null
  const [hour, minute] = raw.split(':').map(Number)
  return Number.isFinite(hour) && Number.isFinite(minute) ? hour * 60 + minute : null
}
function scheduleRows(state: TeacherTwinState): Record<string, unknown>[] { return state.context.todaySchedule.map(record) }
function formatSlot(row: Record<string, unknown>): string {
  const subject = text(row.subject) ?? 'Subject'
  const className = text(row.class_name) ?? 'Class'
  const start = text(row.start_time)?.slice(0, 5) ?? 'time not recorded'
  const end = text(row.end_time)?.slice(0, 5) ?? ''
  return `${className} — ${subject}, ${start}${end ? `–${end}` : ''}`
}

export function resolveTeacherTwinQuery(input: string, state: TeacherTwinState): TeacherTwinReply {
  const q = input.toLowerCase().replace(/\s+/g, ' ').trim()
  const now = eatMinutesNow()
  const schedule = scheduleRows(state)
  const current = schedule.find(row => {
    const start = timeMinutes(row.start_time), end = timeMinutes(row.end_time)
    return start !== null && end !== null && start <= now && now < end
  })
  const next = schedule.filter(row => (timeMinutes(row.start_time) ?? -1) > now).sort((a, b) => (timeMinutes(a.start_time) ?? 0) - (timeMinutes(b.start_time) ?? 0))[0]

  if (/lesson|class|schedule|timetable/.test(q)) {
    if (/now|current|do i have|am i teaching/.test(q)) {
      if (!current) return { text: next ? `You do not have a recorded lesson in progress now. Your next lesson is ${formatSlot(next)}.` : 'You do not have a recorded lesson in progress now, and there is no later timetable slot recorded today.', actionUrl: '/teacher/timetable', actionLabel: 'Open timetable' }
      const plan = current.has_lesson_plan === true ? 'A lesson plan is linked.' : 'No lesson plan is linked for today.'
      const attendance = current.attendance_marked === true ? 'Attendance is recorded.' : 'Attendance is not recorded yet.'
      return { text: `Yes. ${formatSlot(current)}. ${plan} ${attendance}`, actionUrl: '/teacher/timetable', actionLabel: 'Open lesson' }
    }
    if (/next|after|upcoming/.test(q)) return { text: next ? `Your next lesson is ${formatSlot(next)}.` : 'There is no later timetable slot recorded for today.', actionUrl: '/teacher/timetable', actionLabel: 'Open timetable' }
    return { text: schedule.length > 0 ? `Today's timetable:\n${schedule.map(formatSlot).join('\n')}` : 'No timetable slots are recorded for today.', actionUrl: '/teacher/timetable', actionLabel: 'Open timetable' }
  }

  if (/what should|what next|priority|pending|do now/.test(q)) {
    const decision = state.decision.now
    if (!decision) return { text: 'No higher-priority Teacher Twin action is currently recorded.' }
    return { text: `${decision.title}.${decision.reason ? ` ${decision.reason}` : ''}`, actionUrl: decision.actionUrl, actionLabel: decision.actionLabel }
  }
  if (/attendance/.test(q)) return { text: state.evidence.attendancePending > 0 ? `${state.evidence.attendancePending} started timetable slot${state.evidence.attendancePending === 1 ? ' has' : 's have'} no attendance record today.` : 'No started timetable slot is currently missing attendance.', actionUrl: '/teacher/attendance', actionLabel: 'Open attendance' }
  if (/mark|submission|homework/.test(q)) return { text: `${state.evidence.pendingMarking} learner submission${state.evidence.pendingMarking === 1 ? ' is' : 's are'} waiting for marking.`, actionUrl: '/teacher/homework', actionLabel: 'Open marking' }
  if (/student|learner|risk|attention|intervention/.test(q)) return { text: `${state.evidence.studentTwinAttention} learner${state.evidence.studentTwinAttention === 1 ? ' has' : 's have'} a high-priority Student Twin signal in your assigned classes; ${state.evidence.openInterventions} teacher intervention${state.evidence.openInterventions === 1 ? ' is' : 's are'} open or planned.`, actionUrl: '/teacher/students', actionLabel: 'Review learners' }
  if (/curriculum|scheme|coverage|behind/.test(q)) return { text: state.evidence.overdueSchemeItems > 0 ? `${state.evidence.overdueSchemeItems} scheme item${state.evidence.overdueSchemeItems === 1 ? ' is' : 's are'} past the planned date and not marked done.` : 'No overdue scheme item is detected in the Teacher Twin state.', actionUrl: '/teacher/scheme', actionLabel: 'Open scheme' }
  if (/reflection/.test(q)) return { text: `${state.evidence.reflectionGaps7d} completed lesson${state.evidence.reflectionGaps7d === 1 ? ' has' : 's have'} no linked reflection in the last 7 days.`, actionUrl: '/teacher/pulse', actionLabel: 'Open Pulse' }
  if (/tpad/.test(q)) return { text: state.context.tpadDays === null ? 'No active TPAD due date is available in the current Teacher Twin state.' : state.context.tpadDays < 0 ? `TPAD self-appraisal is ${Math.abs(state.context.tpadDays)} day${Math.abs(state.context.tpadDays) === 1 ? '' : 's'} overdue.` : `TPAD self-appraisal is due in ${state.context.tpadDays} day${state.context.tpadDays === 1 ? '' : 's'}.`, actionUrl: '/teacher/tpad', actionLabel: 'Open TPAD' }
  if (/credit/.test(q)) return { text: state.context.creditBalance === null ? 'No credit balance is available in the current Teacher Twin state.' : `Your recorded Vibe credit balance is ${state.context.creditBalance}.` }
  if (/message|unread/.test(q)) return { text: `You have ${state.context.unreadThreads} unread VibeConnect thread${state.context.unreadThreads === 1 ? '' : 's'}.` }
  if (/remember|memory|pattern/.test(q)) return { text: state.memory.claims.length > 0 ? state.memory.claims.slice(0, 5).map(claim => `${claim.claim} (${Math.round(claim.confidence * 100)}% confidence; ${claim.evidenceCount} evidence item${claim.evidenceCount === 1 ? '' : 's'})`).join('\n') : 'No active evidence-derived teacher memory claims are available yet.' }

  return { text: 'I work from your authorized Teacher Twin state without generative AI. Ask about your lesson now, next class, timetable, attendance, marking, learners needing attention, curriculum, reflection, TPAD, credits, messages, or what to do next.' }
}
