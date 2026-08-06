import { supabase } from '@/lib/supabase'
import type { Json } from '@/lib/database.types'

type RpcResult<T> = { data: T | null; error: { message?: string } | null }
type Rpc = <T>(name: string, args?: Record<string, unknown>) => PromiseLike<RpcResult<T>>
const rpc = supabase.rpc.bind(supabase) as unknown as Rpc

type LooseQueryResult = RpcResult<unknown[]>
interface LooseQuery extends PromiseLike<LooseQueryResult> {
  select(columns: string): LooseQuery
  order(column: string, options?: { ascending?: boolean }): LooseQuery
  eq(column: string, value: unknown): LooseQuery
}
const fromUntyped = (table: string): LooseQuery =>
  (supabase as unknown as { from(name: string): LooseQuery }).from(table)

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
export type ReportValidationStatus = 'not_validated' | 'warnings' | 'blocked' | 'passed' | 'frozen'
export interface ReportCompletenessIssue { code: string; message: string; count?: number; severity?: 'blocking' | 'warning' | 'information' }
export interface ReportCardSummary {
  id: string; studentId: string; studentName: string; classId: string; className: string
  termId: string; termName: string; academicYear: number; status: ReportCardStatus; revision: number
  completenessStatus: ReportCompletenessStatus; completenessIssues: ReportCompletenessIssue[]
  validationStatus: ReportValidationStatus; validationIssues: ReportCompletenessIssue[]
  evidenceVersion: number; evidenceGeneratedAt: string | null; updatedAt: string
}
export interface ReportSubjectEvidence {
  reportCardSubjectId: string; subjectId: string; subjectName: string
  assessmentAverage: number | null; masteryAverage: number | null; growthPercentage: number | null
  strongestOutcomes: Json; supportOutcomes: Json; interventionSummary: Json
  achievementSummary: string | null; strengthsSummary: string | null; supportSummary: string | null
  recommendedNextSteps: string | null; parentGuidance: string | null; generatedComment: string | null
  generatedCommentEvidence: Json; generatedAt: string | null; teacherComment: string | null; evidenceSnapshot: Json
}
export interface ReportEvidenceDetail {
  reportCardId: string; status: ReportCardStatus; completenessStatus: ReportCompletenessStatus
  completenessIssues: ReportCompletenessIssue[]; evidenceVersion: number; evidenceGeneratedAt: string | null; snapshot: Json
}
export interface ReportValidationResult {
  validationStatus: ReportValidationStatus; blockingCount: number; warningCount: number; issues: ReportCompletenessIssue[]
}
export interface PublishedReportSummary {
  reportCardId: string; studentId: string; studentName: string; classId: string; className: string
  termId: string; termName: string; academicYear: number; status: 'published' | 'locked'; revision: number
  publishedAt: string | null; lockedAt: string | null; summary: Json
}
export interface PublishedReportDetail {
  reportCardId: string; studentId: string; classId: string; termId: string; academicYear: number
  status: 'published' | 'locked'; revision: number; publishedAt: string | null; lockedAt: string | null; snapshot: Json
}
export interface LongitudinalReportRecord { studentId: string; reports: Json[]; trends: Json }

function parseIssues(value: unknown): ReportCompletenessIssue[] {
  if (!Array.isArray(value)) return []
  return value.map(item => {
    const row = record(item)
    const severity = text(row.severity)
    return {
      code: text(row.code) ?? 'issue', message: text(row.message) ?? 'Report issue',
      count: numberOrNull(row.count) ?? undefined,
      severity: severity === 'blocking' || severity === 'warning' || severity === 'information' ? severity : undefined,
    }
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
  return numberOrNull(record(data).subjects_generated) ?? 0
}
export async function validateReportCard(reportCardId: string): Promise<ReportValidationResult> {
  const { data, error } = await rpc<Json>('exq_validate_report_card', { p_report_card_id: reportCardId })
  if (error) throw new Error(error.message || 'Report card validation failed.')
  const payload = record(data)
  return {
    validationStatus: (text(payload.validation_status) ?? 'not_validated') as ReportValidationStatus,
    blockingCount: numberOrNull(payload.blocking_count) ?? 0,
    warningCount: numberOrNull(payload.warning_count) ?? 0,
    issues: parseIssues(payload.issues),
  }
}
export async function getReportCardEvidence(reportCardId: string): Promise<ReportEvidenceDetail> {
  const { data, error } = await rpc<Json>('exq_get_report_card_evidence', { p_report_card_id: reportCardId })
  if (error) throw new Error(error.message || 'Report evidence could not be loaded.')
  const payload = record(data)
  return {
    reportCardId: text(payload.report_card_id) ?? reportCardId,
    status: (text(payload.status) ?? 'draft') as ReportCardStatus,
    completenessStatus: (text(payload.completeness_status) ?? 'not_generated') as ReportCompletenessStatus,
    completenessIssues: parseIssues(payload.completeness_issues), evidenceVersion: numberOrNull(payload.evidence_version) ?? 1,
    evidenceGeneratedAt: text(payload.evidence_generated_at), snapshot: (payload.snapshot ?? {}) as Json,
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
  const { data, error } = await fromUntyped('report_cards')
    .select('id,student_id,class_id,term_id,academic_year,status,revision,completeness_status,completeness_issues,validation_status,validation_issues,evidence_version,evidence_generated_at,updated_at,students(name),classes(name),academic_terms(name)')
    .order('updated_at', { ascending: false })
  if (error) throw new Error(error.message || 'Report cards could not be loaded.')
  return (data ?? []).map(row => {
    const value = record(row); const student = record(value.students); const klass = record(value.classes); const term = record(value.academic_terms)
    return {
      id: text(value.id) ?? '', studentId: text(value.student_id) ?? '', studentName: text(student.name) ?? 'Learner',
      classId: text(value.class_id) ?? '', className: text(klass.name) ?? 'Class', termId: text(value.term_id) ?? '', termName: text(term.name) ?? 'Term',
      academicYear: Number(value.academic_year), status: (text(value.status) ?? 'draft') as ReportCardStatus, revision: Number(value.revision),
      completenessStatus: (text(value.completeness_status) ?? 'not_generated') as ReportCompletenessStatus,
      completenessIssues: parseIssues(value.completeness_issues), validationStatus: (text(value.validation_status) ?? 'not_validated') as ReportValidationStatus,
      validationIssues: parseIssues(value.validation_issues), evidenceVersion: numberOrNull(value.evidence_version) ?? 1,
      evidenceGeneratedAt: text(value.evidence_generated_at), updatedAt: text(value.updated_at) ?? '',
    }
  })
}
export async function listReportSubjects(reportCardId: string): Promise<ReportSubjectEvidence[]> {
  const { data, error } = await fromUntyped('report_card_subjects')
    .select('id,subject_id,assessment_average,mastery_average,growth_percentage,strongest_outcomes,support_outcomes,intervention_summary,achievement_summary,strengths_summary,support_summary,recommended_next_steps,parent_guidance,generated_comment,generated_comment_evidence,generated_at,teacher_comment,evidence_snapshot,subjects(name)')
    .eq('report_card_id', reportCardId).order('subject_id')
  if (error) throw new Error(error.message || 'Report subject evidence could not be loaded.')
  return (data ?? []).map(row => {
    const value = record(row); const subject = record(value.subjects)
    return {
      reportCardSubjectId: text(value.id) ?? '', subjectId: text(value.subject_id) ?? '', subjectName: text(subject.name) ?? 'Subject',
      assessmentAverage: numberOrNull(value.assessment_average), masteryAverage: numberOrNull(value.mastery_average), growthPercentage: numberOrNull(value.growth_percentage),
      strongestOutcomes: (value.strongest_outcomes ?? []) as Json, supportOutcomes: (value.support_outcomes ?? []) as Json,
      interventionSummary: (value.intervention_summary ?? []) as Json, achievementSummary: text(value.achievement_summary),
      strengthsSummary: text(value.strengths_summary), supportSummary: text(value.support_summary), recommendedNextSteps: text(value.recommended_next_steps),
      parentGuidance: text(value.parent_guidance), generatedComment: text(value.generated_comment), generatedCommentEvidence: (value.generated_comment_evidence ?? []) as Json,
      generatedAt: text(value.generated_at), teacherComment: text(value.teacher_comment), evidenceSnapshot: (value.evidence_snapshot ?? {}) as Json,
    }
  })
}
export async function updateSubjectReport(input: { reportCardSubjectId: string; teacherComment: string; parentGuidance?: string | null }): Promise<void> {
  const { error } = await rpc<Json>('exq_update_subject_report', {
    p_report_card_subject_id: input.reportCardSubjectId, p_teacher_comment: input.teacherComment, p_parent_guidance: input.parentGuidance ?? null,
  })
  if (error) throw new Error(error.message || 'Subject report could not be saved.')
}
export async function saveSubjectComment(reportCardSubjectId: string, comment: string): Promise<void> {
  return updateSubjectReport({ reportCardSubjectId, teacherComment: comment })
}

export async function listMyPublishedReportCards(): Promise<PublishedReportSummary[]> {
  const { data, error } = await rpc<Json>('exq_list_my_published_report_cards')
  if (error) throw new Error(error.message || 'Published report cards could not be loaded.')
  const rows = record(data).reports
  if (!Array.isArray(rows)) return []
  return rows.map(item => {
    const row = record(item)
    return {
      reportCardId: text(row.report_card_id) ?? '', studentId: text(row.student_id) ?? '', studentName: text(row.student_name) ?? 'Learner',
      classId: text(row.class_id) ?? '', className: text(row.class_name) ?? 'Class', termId: text(row.term_id) ?? '', termName: text(row.term_name) ?? 'Term',
      academicYear: numberOrNull(row.academic_year) ?? 0, status: (text(row.status) ?? 'published') as 'published' | 'locked', revision: numberOrNull(row.revision) ?? 1,
      publishedAt: text(row.published_at), lockedAt: text(row.locked_at), summary: (row.summary ?? {}) as Json,
    }
  })
}
export async function getPublishedReportCard(reportCardId: string): Promise<PublishedReportDetail> {
  const { data, error } = await rpc<Json>('exq_get_published_report_card', { p_report_card_id: reportCardId })
  if (error) throw new Error(error.message || 'Published report card could not be loaded.')
  const row = record(data)
  return {
    reportCardId: text(row.report_card_id) ?? reportCardId, studentId: text(row.student_id) ?? '', classId: text(row.class_id) ?? '', termId: text(row.term_id) ?? '',
    academicYear: numberOrNull(row.academic_year) ?? 0, status: (text(row.status) ?? 'published') as 'published' | 'locked', revision: numberOrNull(row.revision) ?? 1,
    publishedAt: text(row.published_at), lockedAt: text(row.locked_at), snapshot: (row.snapshot ?? {}) as Json,
  }
}
export async function getLongitudinalReportRecord(studentId: string): Promise<LongitudinalReportRecord> {
  const { data, error } = await rpc<Json>('exq_get_longitudinal_report_record', { p_student_id: studentId })
  if (error) throw new Error(error.message || 'Longitudinal report record could not be loaded.')
  const row = record(data)
  return { studentId: text(row.student_id) ?? studentId, reports: Array.isArray(row.reports) ? row.reports as Json[] : [], trends: (row.trends ?? {}) as Json }
}
