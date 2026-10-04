import { supabase } from '@/lib/supabase'
import { loadProgressAuthority, readProgressPages } from '@/lib/learner-intelligence/progress-data'
import type { Json } from '@/lib/database.types'


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

/** A list is a read. Queue refresh is an explicit teacher action. */
export async function listInterventionQueue(classId?: string | null, includeClosed = false): Promise<InterventionQueueItem[]> {
  const auth = await supabase.auth.getUser()
  if (auth.error || !auth.data.user) throw new Error('Sign in again to view learner support.')
  const response = await supabase.rpc('teacher_get_operating_context')
  if (response.error) throw new Error(response.error.message)
  const context = record(response.data)
  if (context.teacher_id !== auth.data.user.id || typeof context.school_id !== 'string') throw new Error('Your active teacher school could not be confirmed.')
  const assignments = (Array.isArray(context.classes) ? context.classes : []).map(record)
  const classIds = Array.from(new Set(assignments.map(item => text(item.class_id)).filter((id): id is string => Boolean(id))))
  if (classId && !classIds.includes(classId)) throw new Error('This class is not assigned to you in your active school.')
  const interventions: unknown[] = []
  for (const id of classId ? [classId] : classIds) {
    const scope = await loadProgressAuthority(id)
    if (!scope.subjects.length) continue
    const rows = await readProgressPages((from,to) => {
      let query = supabase.from('assessment_interventions')
        .select('*,students(name,admission_number),curriculum_learning_outcomes(outcome_code,outcome_text)')
        .eq('teacher_id',scope.teacherId).eq('school_id',scope.schoolId).eq('class_id',scope.classId)
        .in('subject_id',scope.subjects.map(subject => subject.id)).order('due_at').order('id').range(from,to)
      if (!includeClosed) query = query.in('status',['open','in_progress','escalated'])
      return query
    })
    for (const value of rows) {
      const row = record(value)
      const learner = record(row.students), outcome = record(row.curriculum_learning_outcomes)
      if (!text(learner.name)) throw new Error('A support record needs learner identity reconciliation. No partial queue is shown.')
      interventions.push({...row,intervention_id:row.id,student_name:learner.name,admission_number:learner.admission_number,
        class_name:scope.className,class_stream:null,subject_name:scope.subjects.find(subject=>subject.id===row.subject_id)?.name,
        outcome_code:outcome.outcome_code,outcome_text:outcome.outcome_text})
    }
  }
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
  const { data, error } = await supabase.rpc('exq_create_intervention_assessment', {
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
  const { data, error } = await supabase.rpc('exq_evaluate_intervention', { p_intervention_id: interventionId })
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
  const { error } = await supabase.rpc('exq_update_intervention', {
    p_intervention_id: input.interventionId,
    p_status: input.status,
    p_completion_note: input.completionNote ?? null,
    p_due_at: input.dueAt ?? null,
  })
  if (error) throw new Error(error.message || 'Intervention could not be updated.')
}
