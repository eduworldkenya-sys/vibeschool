import { supabase } from '@/lib/supabase'
import type { Json } from '@/lib/database.types'

type RpcResult<T> = { data: T | null; error: { message?: string } | null }
type Rpc = <T>(name: string, args?: Record<string, unknown>) => PromiseLike<RpcResult<T>>
const rpc = supabase.rpc.bind(supabase) as unknown as Rpc

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Intervention Engine returned an invalid payload.')
  return value as Record<string, unknown>
}
function text(value: unknown): string | null { return typeof value === 'string' ? value : null }
function numberValue(value: unknown): number {
  const resolved = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(resolved)) throw new Error('Intervention Engine returned an invalid number.')
  return resolved
}
function nullableNumber(value: unknown): number | null {
  return value === null || value === undefined ? null : numberValue(value)
}

export type InterventionStatus = 'open' | 'in_progress' | 'completed' | 'dismissed' | 'escalated'

export interface InterventionQueueItem {
  interventionId: string
  studentId: string
  studentName: string
  admissionNumber: string | null
  classId: string
  className: string
  classStream: string | null
  subjectId: string
  subjectName: string
  outcomeId: string
  outcomeCode: string | null
  outcomeText: string
  priority: 'urgent' | 'high' | 'medium' | 'extension'
  recommendationType: string
  recommendation: string
  masteryScore: number
  evidenceCount: number
  confidenceScore: number
  repeatedWeaknessCount: number
  evidenceSnapshot: Json
  status: InterventionStatus
  dueAt: string | null
  updatedAt: string
  remedialAssessmentId: string | null
  remedialAssignmentId: string | null
  baselineMasteryScore: number | null
  followupMasteryScore: number | null
  masteryChange: number | null
  evaluatedAt: string | null
}

export interface InterventionEvaluation {
  status: InterventionStatus
  baselineMasteryScore: number
  followupMasteryScore: number
  masteryChange: number
  recommendation: string
}

export async function listInterventionQueue(classId?: string | null): Promise<InterventionQueueItem[]> {
  const { data, error } = await rpc<Json>('exq_list_intervention_queue', { p_class_id: classId ?? null })
  if (error) throw new Error(error.message || 'Could not load intervention queue.')
  const payload = record(data)
  const interventions = Array.isArray(payload.interventions) ? payload.interventions : []
  return interventions.map(value => {
    const item = record(value)
    return {
      interventionId: text(item.intervention_id) ?? '',
      studentId: text(item.student_id) ?? '',
      studentName: text(item.student_name) ?? 'Learner',
      admissionNumber: text(item.admission_number),
      classId: text(item.class_id) ?? '',
      className: text(item.class_name) ?? 'Class',
      classStream: text(item.class_stream),
      subjectId: text(item.subject_id) ?? '',
      subjectName: text(item.subject_name) ?? 'Subject',
      outcomeId: text(item.outcome_id) ?? '',
      outcomeCode: text(item.outcome_code),
      outcomeText: text(item.outcome_text) ?? '',
      priority: (text(item.priority) ?? 'medium') as InterventionQueueItem['priority'],
      recommendationType: text(item.recommendation_type) ?? 'guided_practice',
      recommendation: text(item.recommendation) ?? '',
      masteryScore: numberValue(item.mastery_score),
      evidenceCount: numberValue(item.evidence_count),
      confidenceScore: numberValue(item.confidence_score),
      repeatedWeaknessCount: numberValue(item.repeated_weakness_count),
      evidenceSnapshot: (item.evidence_snapshot ?? {}) as Json,
      status: (text(item.status) ?? 'open') as InterventionStatus,
      dueAt: text(item.due_at),
      updatedAt: text(item.updated_at) ?? '',
      remedialAssessmentId: text(item.remedial_assessment_id),
      remedialAssignmentId: text(item.remedial_assignment_id),
      baselineMasteryScore: nullableNumber(item.baseline_mastery_score),
      followupMasteryScore: nullableNumber(item.followup_mastery_score),
      masteryChange: nullableNumber(item.mastery_change),
      evaluatedAt: text(item.evaluated_at),
    }
  })
}

export async function createInterventionAssessment(interventionId: string): Promise<string> {
  const { data, error } = await rpc<Json>('exq_create_intervention_assessment', {
    p_intervention_id: interventionId,
    p_title: null,
  })
  if (error) throw new Error(error.message || 'Remedial assessment could not be created.')
  const payload = record(data)
  const assessmentId = text(payload.assessment_id)
  if (!assessmentId) throw new Error('Assessment ID was not returned.')
  return assessmentId
}

export async function evaluateIntervention(interventionId: string): Promise<InterventionEvaluation> {
  const { data, error } = await rpc<Json>('exq_evaluate_intervention', { p_intervention_id: interventionId })
  if (error) throw new Error(error.message || 'Intervention could not be evaluated.')
  const payload = record(data)
  return {
    status: (text(payload.status) ?? 'in_progress') as InterventionStatus,
    baselineMasteryScore: numberValue(payload.baseline_mastery_score),
    followupMasteryScore: numberValue(payload.followup_mastery_score),
    masteryChange: numberValue(payload.mastery_change),
    recommendation: text(payload.recommendation) ?? '',
  }
}

export async function updateIntervention(input: {
  interventionId: string
  status: InterventionStatus
  completionNote?: string | null
  dueAt?: string | null
}): Promise<void> {
  const { error } = await rpc<Json>('exq_update_intervention', {
    p_intervention_id: input.interventionId,
    p_status: input.status,
    p_completion_note: input.completionNote ?? null,
    p_due_at: input.dueAt ?? null,
  })
  if (error) throw new Error(error.message || 'Intervention could not be updated.')
}
