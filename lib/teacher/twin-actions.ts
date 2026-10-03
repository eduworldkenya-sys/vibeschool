import { supabase } from '@/lib/supabase'
import type { Json } from '@/lib/database.types'

type RpcResult<T> = { data: T | null; error: { message?: string } | null }
async function rpc<T>(name: string, args: Record<string, unknown>): Promise<RpcResult<T>> {
  const result = await supabase.rpc(name as never, args as never)
  return { data: result.data as T | null, error: result.error }
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
}
function text(value: unknown): string | null { return typeof value === 'string' ? value : null }
function num(value: unknown): number | null {
  const n = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(n) ? n : null
}

export interface TeacherTwinExamMarkAction {
  actionType: 'exam_mark'
  requestId: string
  schoolId: string
  classId: string
  className: string
  subjectId: string
  subjectName: string
  studentId: string
  studentName: string
  examId: string
  examName: string
  marks: number
  previousMarks: number | null
  previousAbsent: boolean
}

export type TeacherTwinActionResolution =
  | { kind: 'ready'; action: TeacherTwinExamMarkAction; text: string }
  | { kind: 'handled'; text: string }

export function parseTeacherTwinExamMarkCommand(input: string): {
  learnerQuery: string
  subjectQuery: string
  examQuery: string
  marks: number
} | null {
  const normalized = input.replace(/\s+/g, ' ').trim()
  const match = normalized.match(/^(?:add|give|set|record|enter)\s+(\d+(?:\.\d+)?)\s*(?:marks?|points?)?\s+(?:to|for)\s+(.+?)\s+(?:in|for)\s+(.+)$/i)
  if (!match) return null
  const marks = Number(match[1])
  if (!Number.isFinite(marks)) return null
  const learnerQuery = match[2].trim()
  const context = match[3].trim()
  const examMatch = context.match(/^(.*?)\s+((?:cat|exam|test)(?:\s*\d+)?)$/i)
  if (!examMatch) return null
  const subjectQuery = examMatch[1].trim()
  const examQuery = examMatch[2].trim()
  if (!learnerQuery || !subjectQuery || !examQuery) return null
  return { learnerQuery, subjectQuery, examQuery, marks }
}

export async function resolveTeacherTwinAction(input: string): Promise<TeacherTwinActionResolution | null> {
  const parsed = parseTeacherTwinExamMarkCommand(input)
  if (!parsed) return null

  const { data, error } = await rpc<Json>('teacher_twin_resolve_exam_mark_action', {
    p_learner_query: parsed.learnerQuery,
    p_subject_query: parsed.subjectQuery,
    p_exam_query: parsed.examQuery,
    p_marks: parsed.marks,
  })
  if (error) throw new Error(error.message || 'Twin could not resolve that marks action.')
  const row = record(data)
  const status = text(row.status)

  if (status !== 'ready') {
    const candidates = Array.isArray(row.candidates)
      ? row.candidates.map(record).map(item => text(item.label)).filter((x): x is string => Boolean(x))
      : []
    const message = text(row.message) ?? 'Twin could not resolve that action safely.'
    return {
      kind: 'handled',
      text: candidates.length ? `${message}\n${candidates.slice(0, 5).map(x => `• ${x}`).join('\n')}` : message,
    }
  }

  const action: TeacherTwinExamMarkAction = {
    actionType: 'exam_mark',
    requestId: crypto.randomUUID(),
    schoolId: text(row.school_id) ?? '',
    classId: text(row.class_id) ?? '',
    className: text(row.class_name) ?? 'Class',
    subjectId: text(row.subject_id) ?? '',
    subjectName: text(row.subject_name) ?? 'Subject',
    studentId: text(row.student_id) ?? '',
    studentName: text(row.student_name) ?? 'Learner',
    examId: text(row.exam_id) ?? '',
    examName: text(row.exam_name) ?? 'Exam',
    marks: num(row.marks) ?? parsed.marks,
    previousMarks: num(row.previous_marks),
    previousAbsent: row.previous_absent === true,
  }
  if (!action.classId || !action.subjectId || !action.studentId || !action.examId)
    throw new Error('Twin resolved an incomplete academic target and did not continue.')

  const previous = action.previousAbsent
    ? 'Current result: ABS.'
    : action.previousMarks === null
      ? 'No mark is currently recorded.'
      : `Current mark: ${action.previousMarks}.`
  return {
    kind: 'ready',
    action,
    text: `Ready to set ${action.studentName} to ${action.marks} in ${action.subjectName} · ${action.examName} · ${action.className}. ${previous} Confirm this change?`,
  }
}

export async function applyTeacherTwinAction(action: TeacherTwinExamMarkAction): Promise<string> {
  const { data, error } = await rpc<Json>('teacher_twin_apply_exam_mark_action', {
    p_request_id: action.requestId,
    p_class_id: action.classId,
    p_subject_id: action.subjectId,
    p_student_id: action.studentId,
    p_exam_id: action.examId,
    p_marks: action.marks,
  })
  if (error) throw new Error(error.message || 'Twin could not save that mark.')
  const row = record(data)
  if (text(row.status) !== 'saved') throw new Error('Twin did not receive a confirmed save result.')
  const saved = num(row.marks)
  if (saved !== action.marks) throw new Error('Twin read back a different mark and stopped.')
  return `Saved and checked: ${text(row.student_name) ?? action.studentName} now has ${saved} in ${text(row.subject_name) ?? action.subjectName} · ${text(row.exam_name) ?? action.examName}.`
}
