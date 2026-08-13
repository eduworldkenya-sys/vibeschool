import { supabase } from '@/lib/supabase'

export interface KcseCandidateOS {
  eligible: boolean
  onboarding: { kcse_candidate_opt_in: boolean; target_grade: string | null; exam_date: string | null; daily_revision_minutes: number; confidence_check: number | null; complete: boolean }
  countdown: { days_remaining: number | null; mode: string; message: string }
  projection: { evidence_attempts: number; average_percentage: number | null; readiness_band: string; target_grade: string | null; trend_disclaimer: string }
  coverage: Array<{ subject: string; syllabus_topics: number; verified_outcomes: number; published_form4_questions: number; evidence_state: string }>
  due_retests: Array<{ id: string; subject: string; topic: string; due_date: string; mastery_state: string }>
  recent_mocks: Array<{ id: string; subject: string; paper_code: string; title: string; status: string; percentage: number | null; action_url: string }>
  paper_blueprints: Array<{ id: string; subject: string; paper_code: string; title: string; duration_minutes: number; total_marks: number; source_type: string; source_ref: string | null }>
  capabilities: Record<string, boolean>
  guardrails: Record<string, boolean>
}

export interface KcseQuestion {
  id: string
  subject: string
  topic: string
  difficulty: string
  question: string
  options: string[]
  hint: string | null
  provenance_status: string
  source_year: number | null
  source_paper: string | null
  selection_reason: string
}

export interface KcseMockQuestion extends KcseQuestion {
  selected_index: number | null
  correct_index: number | null
  explanation: string | null
  is_correct: boolean | null
}

export interface KcseMock {
  session_id: string
  subject: string
  paper_code: string
  title: string
  duration_minutes: number
  total_marks: number
  status: 'in_progress' | 'submitted' | 'expired'
  started_at: string
  last_saved_at: string
  expires_at: string
  score: number | null
  max_score: number | null
  percentage: number | null
  questions: KcseMockQuestion[]
}

type RpcResult = { data: unknown; error: { message: string } | null }
type KcseRpcClient = { rpc(fn: string, args?: Record<string, unknown>): Promise<RpcResult> }
const rpcClient = supabase as unknown as KcseRpcClient

async function call<T>(fn: string, args?: Record<string, unknown>): Promise<T> {
  const { data, error } = await rpcClient.rpc(fn, args)
  if (error) throw new Error(error.message)
  return data as T
}

export const getKcseCandidateOS = () => call<KcseCandidateOS>('student_get_kcse_candidate_os')
export const updateKcseProfile = (input: { examDate: string | null; dailyMinutes: number; confidence: number | null; optIn: boolean }) => call('student_update_kcse_profile', { p_exam_date: input.examDate, p_daily_revision_minutes: input.dailyMinutes, p_confidence_check: input.confidence, p_subject_confidence: {}, p_kcse_candidate_opt_in: input.optIn })
export const getKcseMasteryMap = () => call<{ topics: unknown[]; prerequisite_risks: unknown[] }>('student_get_kcse_mastery_map')
export const getKcseGradeProjection = () => call<{ state: string; average_percentage: number | null; projected_grade: string | null; disclaimer?: string }>('student_get_kcse_verified_grade_projection')
export const generateKcseRevisionPlan = (days: number) => call('student_generate_kcse_revision_plan', { p_start_date: new Date().toISOString().slice(0, 10), p_days: days })
export const getKcseAdaptivePractice = (subject: string | null, topic: string | null, limit = 10) => call<{ questions: KcseQuestion[] }>('student_get_kcse_adaptive_practice', { p_subject: subject, p_topic: topic, p_limit: limit })
export const recordKcsePracticeAnswer = (questionId: string, selectedIndex: number, responseMs: number | null, sessionId: string | null = null) => call<{ correct: boolean; explanation: string | null; hint: string | null; mistake_id: string | null; next_retest_days: number }>('student_record_vibelearn_practice_answer', { p_exam_question_id: questionId, p_selected_index: selectedIndex, p_response_ms: responseMs, p_session_id: sessionId })
export const createKcseMock = (subject: string, paperCode: string, clientId: string) => call<{ ok: boolean; reason?: string; session_id?: string }>('student_create_kcse_mock', { p_subject: subject, p_paper_code: paperCode, p_client_id: clientId })
export const getKcseMock = (sessionId: string) => call<KcseMock>('student_get_kcse_mock', { p_session_id: sessionId })
export const saveKcseMockAnswer = (sessionId: string, questionId: string, selectedIndex: number, responseMs: number | null, clientId: string) => call('student_save_kcse_mock_answer', { p_session_id: sessionId, p_question_id: questionId, p_selected_index: selectedIndex, p_response_text: null, p_response_ms: responseMs, p_client_id: clientId })
export const submitKcseMock = (sessionId: string, clientId: string) => call<KcseMock>('student_submit_kcse_mock', { p_session_id: sessionId, p_client_id: clientId })
export const verifyMistakeMastery = (mistakeId: string) => call<{ resolved: boolean; correct_since_miss: number; attempts_since_miss: number; distinct_practice_days: number; required: string }>('student_resolve_mistake', { p_mistake_id: mistakeId })
