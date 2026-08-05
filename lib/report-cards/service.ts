import { supabase } from '@/lib/supabase'
import type { Json } from '@/lib/database.types'

type RpcResult<T> = { data: T | null; error: { message?: string } | null }
type Rpc = <T>(name: string, args?: Record<string, unknown>) => PromiseLike<RpcResult<T>>
const rpc = supabase.rpc.bind(supabase) as unknown as Rpc

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Report Card Engine returned an invalid payload.')
  return value as Record<string, unknown>
}
function text(value: unknown): string | null { return typeof value === 'string' ? value : null }
function numberOrNull(value: unknown): number | null {
  if (value === null || value === undefined) return null
  const result = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(result) ? result : null
}

export type ReportCardStatus = 'draft' | 'review' | 'approved' | 'published' | 'locked' | 'returned'
export type ReportCompletenessStatus = 'not_generated' | 'incomplete' | 'complete' | 'frozen'

export interface ReportCompletenessIssue { code: string; message: string; count?: number }
export interface ReportCardSummary {
  id: string; studentId: string; studentName: string; classId: string; className: string
  termId: string; termName: string; academicYear: number; status: ReportCardStatus; revision: number
  completenessStatus: ReportCompletenessStatus; completenessIssues: ReportCompletenessIssue[]
  evidenceVersion: number; evidenceGeneratedAt: string | null; updatedAt: string
}
export interface ReportSubjectEvidence {
  reportCardSubjectId: string
  subjectId: string
  subjectName: string
  assessmentAverage: number | null
  masteryAverage: number | null
  growthPercentage: number | null
  strongestOutcomes: Json
  supportOutcomes: Json
  interventionSummary: Json
  achievementSummary: string | null
  strengthsSummary: string | null
  supportSummary: string | null
  recommendedNextSteps: string | null
  parentGuidance: string | null
  generatedComment: string | null
  generatedCommentEvidence: Json
  generatedAt: string | null
  teacherComment: string | null
  evidenceSnapshot: Json
}
export interface ReportEvidenceDetail {
  reportCardId: string; status: ReportCardStatus; completenessStatus: ReportCompletenessStatus
  completenessIssues: ReportCompletenessIssue[]; evidenceVersion: number
  evidenceGeneratedAt: string | null; snapshot: Json
}

function parseIssues(value: unknown): ReportCompletenessIssue[] {
  if (!Array.isArray(value)) return []
  return value.map(item => {
    const row = record(item)
    return { code: text(row.code) ?? 'issue', message: text(row.message) ?? 'Evidence issue', count: numberOrNull(row.count) ?? undefined }
  })
}

export async function createReportCard(input: { studentId: string; classId: string; termId: string; academicYear: number }): Promise<string> {
  const { data, error } = await rpc<string>('exq_create_report_card', {
    p_student_id: input.studentId, p_class_id: input.classId, p_term_id: input.termId, p_academic_year: input.academicYear,
  })
  if (error) throw new Error(error.message || 'Report card could not be created.')
  if (typeof data !== 'string' || !data) throw new Error('Report card ID was not returned.')
  return data
}

export async function generateReportCardEvidence(reportCardId: string): Promise<ReportEvidenceDetail> {
  const { error } = await rpc<Json>('exq_generate_report_card_evidence', { p_report_card_id: reportCardId })
  if (error) throw new Error(error.message || 'Report evidence could not be generated.')
  return getReportCardEvidence(reportCardId)
}

export async function generateSubjectReportIntelligence(reportCardId: string): Promise<number> {
  const { data, error } = await rpc<Json>('exq_generate_subject_report_intelligence', { p_report_card_id: reportCardId })
  if (error) throw new Error(error.message || 'Subject report intelligence could not be generated.')
  const payload = record(data)
  return numberOrNull(payload.subjects_generated) ?? 0
}

export async function getReportCardEvidence(reportCardId: string): Promise<ReportEvidenceDetail> {
  const { data, error } = await rpc<Json>('exq_get_report_card_evidence', { p_report_card_id: reportCardId })
  if (error) throw new Error(error.message || 'Report evidence could not be loaded.')
  const payload = record(data)
  return {
    reportCardId: text(payload.report_card_id) ?? reportCardId,
    status: (text(payload.status) ?? 'draft') as ReportCardStatus,
    completenessStatus: (text(payload.completeness_status) ?? 'not_generated') as ReportCompletenessStatus,
    completenessIssues: parseIssues(payload.completeness_issues),
    evidenceVersion: numberOrNull(payload.evidence_version) ?? 1,
    evidenceGeneratedAt: text(payload.evidence_generated_at),
    snapshot: (payload.snapshot ?? {}) as Json,
  }
}

export async function submitReportCard(reportCardId: string, overallComment?: string | null): Promise<void> {
  const { error } = await rpc<Json>('exq_submit_report_card', { p_report_card_id: reportCardId, p_overall_comment: overallComment ?? null })
  if (error) throw new Error(error.message || 'Report card could not be submitted.')
}
export async function reviewReportCard(input: { reportCardId: string; decision: 'approved' | 'returned'; reason?: string | null }): Promise<void> {
  const { error } = await rpc<Json>('exq_review_report_card', { p_report_card_id: input.reportCardId, p_decision: input.decision, p_reason: input.reason ?? null })
  if (error) throw new Error(error.message || 'Report card review could not be saved.')
}
export async function publishReportCard(reportCardId: string): Promise<void> {
  const { error } = await rpc<Json>('exq_publish_report_card', { p_report_card_id: reportCardId })
  if (error) throw new Error(error.message || 'Report card could not be published.')
}
export async function lockReportCard(reportCardId: string): Promise<void> {
  const { error } = await rpc<Json>('exq_lock_report_card', { p_report_card_id: reportCardId })
  if (error) throw new Error(error.message || 'Report card could not be locked.')
}

export async function listReportCards(): Promise<ReportCardSummary[]> {
  const { data, error } = await supabase
    .from('report_cards')
    .select('id,student_id,class_id,term_id,academic_year,status,revision,completeness_status,completeness_issues,evidence_version,evidence_generated_at,updated_at,students(name),classes(name),academic_terms(name)')
    .order('updated_at', { ascending: false })
  if (error) throw new Error(error.message || 'Report cards could not be loaded.')
  return (data ?? []).map(row => {
    const value = record(row); const student = record(value.students); const klass = record(value.classes); const term = record(value.academic_terms)
    return {
      id: text(value.id) ?? '', studentId: text(value.student_id) ?? '', studentName: text(student.name) ?? 'Learner',
      classId: text(value.class_id) ?? '', className: text(klass.name) ?? 'Class', termId: text(value.term_id) ?? '',
      termName: text(term.name) ?? 'Term', academicYear: Number(value.academic_year),
      status: (text(value.status) ?? 'draft') as ReportCardStatus, revision: Number(value.revision),
      completenessStatus: (text(value.completeness_status) ?? 'not_generated') as ReportCompletenessStatus,
      completenessIssues: parseIssues(value.completeness_issues), evidenceVersion: numberOrNull(value.evidence_version) ?? 1,
      evidenceGeneratedAt: text(value.evidence_generated_at), updatedAt: text(value.updated_at) ?? '',
    }
  })
}

export async function listReportSubjects(reportCardId: string): Promise<ReportSubjectEvidence[]> {
  const { data, error } = await supabase
    .from('report_card_subjects')
    .select('id,subject_id,assessment_average,mastery_average,growth_percentage,strongest_outcomes,support_outcomes,intervention_summary,achievement_summary,strengths_summary,support_summary,recommended_next_steps,parent_guidance,generated_comment,generated_comment_evidence,generated_at,teacher_comment,evidence_snapshot,subjects(name)')
    .eq('report_card_id', reportCardId)
    .order('subject_id')
  if (error) throw new Error(error.message || 'Report subject evidence could not be loaded.')
  return (data ?? []).map(row => {
    const value = record(row); const subject = record(value.subjects)
    return {
      reportCardSubjectId: text(value.id) ?? '', subjectId: text(value.subject_id) ?? '', subjectName: text(subject.name) ?? 'Subject',
      assessmentAverage: numberOrNull(value.assessment_average), masteryAverage: numberOrNull(value.mastery_average),
      growthPercentage: numberOrNull(value.growth_percentage), strongestOutcomes: (value.strongest_outcomes ?? []) as Json,
      supportOutcomes: (value.support_outcomes ?? []) as Json, interventionSummary: (value.intervention_summary ?? []) as Json,
      achievementSummary: text(value.achievement_summary), strengthsSummary: text(value.strengths_summary),
      supportSummary: text(value.support_summary), recommendedNextSteps: text(value.recommended_next_steps),
      parentGuidance: text(value.parent_guidance), generatedComment: text(value.generated_comment),
      generatedCommentEvidence: (value.generated_comment_evidence ?? []) as Json, generatedAt: text(value.generated_at),
      teacherComment: text(value.teacher_comment), evidenceSnapshot: (value.evidence_snapshot ?? {}) as Json,
    }
  })
}

export async function updateSubjectReport(input: { reportCardSubjectId: string; teacherComment: string; parentGuidance?: string | null }): Promise<void> {
  const { error } = await rpc<Json>('exq_update_subject_report', {
    p_report_card_subject_id: input.reportCardSubjectId,
    p_teacher_comment: input.teacherComment,
    p_parent_guidance: input.parentGuidance ?? null,
  })
  if (error) throw new Error(error.message || 'Subject report could not be saved.')
}

export async function saveSubjectComment(reportCardSubjectId: string, comment: string): Promise<void> {
  return updateSubjectReport({ reportCardSubjectId, teacherComment: comment })
}
