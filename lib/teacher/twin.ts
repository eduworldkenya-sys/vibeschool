import { supabase } from '@/lib/supabase'
import type { Json } from '@/lib/database.types'

type RpcResult<T> = { data: T | null; error: { message?: string } | null }
type Rpc = <T>(name: string, args?: Record<string, unknown>) => PromiseLike<RpcResult<T>>
const rpc = supabase.rpc.bind(supabase) as unknown as Rpc

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
}
function text(value: unknown): string | null { return typeof value === 'string' ? value : null }
function numberOrNull(value: unknown): number | null {
  if (value === null || value === undefined) return null
  const result = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(result) ? result : null
}
function strings(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []
}
function jsonArray(value: unknown): Json[] {
  return Array.isArray(value) ? value as Json[] : []
}

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

export interface TeacherTwinContext {
  todaySchedule: Json[]
  atRiskStudents: Json[]
  homeworkDue: Json[]
  unreadThreads: number
  attendanceStreak: number
  tpadDue: string | null
  tpadDays: number | null
  creditBalance: number | null
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
  context: TeacherTwinContext
  decision: {
    now: TeacherTwinDecision | null
    next: TeacherTwinDecision[]
    later: TeacherTwinDecision[]
    rule: string | null
  }
  memory: {
    claims: TeacherTwinMemoryClaim[]
    rule: string | null
  }
  guardrails: {
    aiIsNotAuthority: boolean
    mustNotInventEvidence: boolean
    mustNotOverrideTeacherRecords: boolean
    mustUseAuthenticatedContext: boolean
  }
}

export interface TeacherTwinChatMessage {
  role: 'user' | 'assistant'
  content: string
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
  const { data, error } = await rpc<Json>('teacher_get_twin_brain')
  if (error) throw new Error(error.message || 'Your Teacher Twin state could not be loaded.')

  const state = record(data)
  const evidence = record(state.evidence)
  const context = record(state.context)
  const decision = record(state.decision)
  const memory = record(state.memory)
  const guardrails = record(state.guardrails)
  const next = Array.isArray(decision.next) ? decision.next : []
  const later = Array.isArray(decision.later) ? decision.later : []

  return {
    teacherId: text(state.teacher_id) ?? '',
    schoolId: text(state.school_id) ?? '',
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
      todaySchedule: jsonArray(context.today_schedule),
      atRiskStudents: jsonArray(context.at_risk_students),
      homeworkDue: jsonArray(context.homework_due),
      unreadThreads: numberOrNull(context.unread_threads) ?? 0,
      attendanceStreak: numberOrNull(context.attendance_streak) ?? 0,
      tpadDue: text(context.tpad_due),
      tpadDays: numberOrNull(context.tpad_days),
      creditBalance: numberOrNull(context.credit_balance),
    },
    decision: {
      now: parseDecision(decision.now),
      next: next.map(parseDecision).filter((item): item is TeacherTwinDecision => item !== null),
      later: later.map(parseDecision).filter((item): item is TeacherTwinDecision => item !== null),
      rule: text(decision.rule),
    },
    memory: {
      claims: parseMemory(memory.claims),
      rule: text(memory.rule),
    },
    guardrails: {
      aiIsNotAuthority: guardrails.ai_is_not_authority === true,
      mustNotInventEvidence: guardrails.must_not_invent_evidence === true,
      mustNotOverrideTeacherRecords: guardrails.must_not_override_teacher_records === true,
      mustUseAuthenticatedContext: guardrails.must_use_authenticated_context === true,
    },
  }
}

export async function askTeacherTwin(input: { messages: TeacherTwinChatMessage[]; firstName: string }): Promise<string> {
  const { data, error } = await supabase.functions.invoke('twin-chat', {
    body: { role: 'teacher', firstName: input.firstName, messages: input.messages.slice(-10) },
  })
  if (error) throw new Error(error.message || 'Your Teacher Twin could not respond.')
  const payload = record(data)
  const reply = text(payload.reply)
  if (!reply) throw new Error(text(payload.error) || 'Your Teacher Twin could not respond.')
  return reply
}
