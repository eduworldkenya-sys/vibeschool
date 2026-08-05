import { supabase } from '@/lib/supabase'
import type { Json } from '@/lib/database.types'
import type {
  AddDraftItemInput,
  ApproveAssessmentResult,
  AssignAssessmentInput,
  AttemptWorkspace,
  CreateDraftAssessmentInput,
  SaveResponseInput,
  SaveResponseResult,
  SubmitAttemptResult,
} from './types'

type RpcResult<T> = { data: T | null; error: { message?: string } | null }
type AssessmentRpc = <T>(functionName: string, args: Record<string, unknown>) => PromiseLike<RpcResult<T>>
const rpc = supabase.rpc.bind(supabase) as unknown as AssessmentRpc

function assertString(value: unknown, label: string): string {
  if (typeof value !== 'string' || value.length === 0) throw new Error(`${label} was not returned by the Assessment Engine.`)
  return value
}
function assertRecord(value: unknown, label: string): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${label} returned an invalid payload.`)
  return value as Record<string, unknown>
}
function numberValue(value: unknown, label: string): number {
  const resolved = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : Number.NaN
  if (!Number.isFinite(resolved)) throw new Error(`${label} was not numeric.`)
  return resolved
}
function nullableNumber(value: unknown, label: string): number | null {
  return value === null || value === undefined ? null : numberValue(value, label)
}
function nullableString(value: unknown): string | null { return typeof value === 'string' ? value : null }
function rpcError(action: string, error: { message?: string } | null): Error { return new Error(error?.message || `Assessment Engine ${action} failed.`) }

export async function createDraftAssessment(input: CreateDraftAssessmentInput): Promise<string> {
  const { data, error } = await rpc<string>('exq_create_draft_assessment', {
    p_class_id: input.classId, p_subject_id: input.subjectId, p_assessment_type: input.assessmentType,
    p_title: input.title, p_description: input.description ?? null, p_instructions: input.instructions ?? null,
    p_lesson_plan_id: input.lessonPlanId ?? null, p_teaching_occurrence_id: input.teachingOccurrenceId ?? null,
    p_source_resource_id: input.sourceResourceId ?? null, p_generation_source: input.generationSource ?? 'teacher_authored',
    p_generation_metadata: input.generationMetadata ?? {},
  })
  if (error) throw rpcError('draft creation', error)
  return assertString(data, 'Assessment ID')
}

export async function addDraftItem(input: AddDraftItemInput): Promise<string> {
  const { data, error } = await rpc<string>('exq_add_draft_item', {
    p_assessment_id: input.assessmentId, p_question_type: input.questionType, p_prompt: input.prompt,
    p_marks: input.marks ?? 1, p_order_num: input.orderNum ?? null, p_options: input.options ?? [],
    p_accepted_answers: input.acceptedAnswers ?? [], p_correct_answer: input.correctAnswer ?? null,
    p_marking_guide: input.markingGuide ?? {}, p_auto_marking_mode: input.autoMarkingMode ?? 'none',
    p_difficulty: input.difficulty ?? null, p_bloom_level: input.bloomLevel ?? null,
    p_explanation: input.explanation ?? null, p_hint: input.hint ?? null,
    p_worked_solution: input.workedSolution ?? null, p_source_resource_id: input.sourceResourceId ?? null,
    p_source_exercise_ref: input.sourceExerciseRef ?? null, p_generated_by: input.generatedBy ?? 'teacher',
  })
  if (error) throw rpcError('question creation', error)
  return assertString(data, 'Assessment item ID')
}

export async function approveAssessment(assessmentId: string): Promise<ApproveAssessmentResult> {
  const { data, error } = await rpc<Json>('exq_approve_assessment', { p_assessment_id: assessmentId })
  if (error) throw rpcError('approval', error)
  const payload = assertRecord(data, 'Assessment approval')
  return { ok: true, assessmentId: assertString(payload.assessment_id, 'Approved assessment ID'), itemCount: numberValue(payload.item_count, 'Approved item count'), totalMarks: numberValue(payload.total_marks, 'Approved total marks') }
}

export async function assignAssessment(input: AssignAssessmentInput): Promise<string> {
  const { data, error } = await rpc<string>('exq_assign_assessment', {
    p_assessment_id: input.assessmentId, p_class_id: input.classId, p_target_group_id: input.targetGroupId ?? null,
    p_opens_at: input.opensAt ?? null, p_closes_at: input.closesAt ?? null,
    p_time_limit_minutes: input.timeLimitMinutes ?? null, p_max_attempts: input.maxAttempts ?? 1,
    p_randomize_items: input.randomizeItems ?? false, p_randomize_options: input.randomizeOptions ?? false,
    p_show_score_policy: input.showScorePolicy ?? 'after_review',
  })
  if (error) throw rpcError('assignment', error)
  return assertString(data, 'Assessment assignment ID')
}

function mapAttemptWorkspace(value: unknown): AttemptWorkspace {
  const payload = assertRecord(value, 'Attempt workspace')
  const items = Array.isArray(payload.items) ? payload.items : []
  const responses = Array.isArray(payload.responses) ? payload.responses : []
  return {
    ok: true,
    attemptId: assertString(payload.attempt_id, 'Attempt ID'),
    attemptNumber: numberValue(payload.attempt_number, 'Attempt number'),
    assessmentId: assertString(payload.assessment_id, 'Assessment ID'),
    assessmentType: assertString(payload.assessment_type, 'Assessment type') as AttemptWorkspace['assessmentType'],
    title: assertString(payload.title, 'Assessment title'),
    instructions: nullableString(payload.instructions),
    timeLimitMinutes: nullableNumber(payload.time_limit_minutes, 'Time limit'),
    expiresAt: nullableString(payload.expires_at),
    closesAt: nullableString(payload.closes_at),
    showScorePolicy: assertString(payload.show_score_policy, 'Score policy') as AttemptWorkspace['showScorePolicy'],
    items: items.map(item => {
      const record = assertRecord(item, 'Learner assessment item')
      return { id: assertString(record.id, 'Assessment item ID'), questionType: assertString(record.question_type, 'Question type') as AttemptWorkspace['items'][number]['questionType'], prompt: assertString(record.prompt, 'Question prompt'), options: (record.options ?? []) as Json, marks: numberValue(record.marks, 'Question marks'), orderNum: numberValue(record.order_num, 'Question order'), media: (record.media ?? []) as Json, hint: nullableString(record.hint) }
    }),
    responses: responses.map(response => {
      const record = assertRecord(response, 'Saved assessment response')
      return {
        assessmentItemId: assertString(record.assessment_item_id, 'Response item ID'),
        responseValue: (record.response_value ?? null) as Json,
        responseText: nullableString(record.response_text),
        status: assertString(record.status, 'Response status'),
        revision: numberValue(record.revision, 'Response revision'),
        clientUpdatedAt: nullableString(record.client_updated_at),
        lastSavedAt: assertString(record.last_saved_at, 'Response save time'),
      }
    }),
  }
}

export async function startOrResumeAttempt(assignmentId: string): Promise<AttemptWorkspace> {
  const { data, error } = await rpc<Json>('exq_start_or_resume_attempt', { p_assignment_id: assignmentId })
  if (error) throw rpcError('attempt start', error)
  return mapAttemptWorkspace(data)
}

export async function saveResponse(input: SaveResponseInput): Promise<SaveResponseResult> {
  const { data, error } = await rpc<Json>('exq_save_response', {
    p_attempt_id: input.attemptId, p_assessment_item_id: input.assessmentItemId,
    p_response_value: input.responseValue ?? null, p_response_text: input.responseText ?? null,
  })
  if (error) throw rpcError('response save', error)
  const payload = assertRecord(data, 'Saved response')
  return { ok: true, attemptId: assertString(payload.attempt_id, 'Saved attempt ID'), assessmentItemId: assertString(payload.assessment_item_id, 'Saved assessment item ID'), savedAt: assertString(payload.saved_at, 'Response save time'), expiresAt: nullableString(payload.expires_at) }
}

export async function submitAttempt(attemptId: string): Promise<SubmitAttemptResult> {
  const { data, error } = await rpc<Json>('exq_submit_attempt', { p_attempt_id: attemptId })
  if (error) throw rpcError('attempt submission', error)
  const payload = assertRecord(data, 'Submitted attempt')
  const status = assertString(payload.status, 'Attempt status')
  const resultStatus = assertString(payload.result_status, 'Attempt result status')
  if (status !== 'auto_marked' && status !== 'teacher_review') throw new Error('Assessment Engine returned an invalid attempt status.')
  if (resultStatus !== 'marked' && resultStatus !== 'partially_marked') throw new Error('Assessment Engine returned an invalid result status.')
  return {
    ok: true,
    attemptId: assertString(payload.attempt_id, 'Submitted attempt ID'),
    status,
    resultStatus,
    score: nullableNumber(payload.score, 'Attempt score'),
    maxScore: nullableNumber(payload.max_score, 'Attempt maximum score'),
    percentage: nullableNumber(payload.percentage, 'Attempt percentage'),
    scoreReleased: payload.score_released === true,
    manualItems: numberValue(payload.manual_items, 'Manual-marking item count'),
    submittedDueToExpiry: payload.submitted_due_to_expiry === true,
  }
}
