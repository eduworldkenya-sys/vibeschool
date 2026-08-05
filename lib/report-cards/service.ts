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

export type ReportCardStatus = 'draft' | 'review' | 'approved' | 'published' | 'locked' | 'returned'

export interface ReportCardSummary {
  id: string
  studentId: string
  studentName: string
  classId: string
  className: string
  termId: string
  termName: string
  academicYear: number
  status: ReportCardStatus
  revision: number
  updatedAt: string
}

export async function createReportCard(input: {
  studentId: string
  classId: string
  termId: string
  academicYear: number
}): Promise<string> {
  const { data, error } = await rpc<string>('exq_create_report_card', {
    p_student_id: input.studentId,
    p_class_id: input.classId,
    p_term_id: input.termId,
    p_academic_year: input.academicYear,
  })
  if (error) throw new Error(error.message || 'Report card could not be created.')
  if (typeof data !== 'string' || !data) throw new Error('Report card ID was not returned.')
  return data
}

export async function submitReportCard(reportCardId: string, overallComment?: string | null): Promise<void> {
  const { error } = await rpc<Json>('exq_submit_report_card', {
    p_report_card_id: reportCardId,
    p_overall_comment: overallComment ?? null,
  })
  if (error) throw new Error(error.message || 'Report card could not be submitted.')
}

export async function reviewReportCard(input: {
  reportCardId: string
  decision: 'approved' | 'returned'
  reason?: string | null
}): Promise<void> {
  const { error } = await rpc<Json>('exq_review_report_card', {
    p_report_card_id: input.reportCardId,
    p_decision: input.decision,
    p_reason: input.reason ?? null,
  })
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
    .select('id,student_id,class_id,term_id,academic_year,status,revision,updated_at,students(name),classes(name),academic_terms(name)')
    .order('updated_at', { ascending: false })

  if (error) throw new Error(error.message || 'Report cards could not be loaded.')

  return (data ?? []).map(row => {
    const value = record(row)
    const student = record(value.students)
    const klass = record(value.classes)
    const term = record(value.academic_terms)
    return {
      id: text(value.id) ?? '',
      studentId: text(value.student_id) ?? '',
      studentName: text(student.name) ?? 'Learner',
      classId: text(value.class_id) ?? '',
      className: text(klass.name) ?? 'Class',
      termId: text(value.term_id) ?? '',
      termName: text(term.name) ?? 'Term',
      academicYear: Number(value.academic_year),
      status: (text(value.status) ?? 'draft') as ReportCardStatus,
      revision: Number(value.revision),
      updatedAt: text(value.updated_at) ?? '',
    }
  })
}
