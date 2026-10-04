import { twinRecord, twinRpc } from '@/lib/twin/transport'
import { normalizeExamResultState, type CanonicalExamResult, type ExamResultState, type ExamSubjectPolicy } from '@/lib/assessment/exam-results'

export interface ExamResultSave {
  examId: string
  schoolId: string
  classId: string
  subjectId: string
  studentId: string
  marks: number | null
  resultState?: ExamResultState
  /** @deprecated compatibility for older callers; use resultState. */
  isAbsent?: boolean
  expectedUpdatedAt: string | null
}

function numberField(row: Record<string, unknown>, key: string): number {
  const value = Number(row[key])
  if (!Number.isFinite(value)) throw new Error('The result policy could not be verified.')
  return value
}

export async function getCanonicalExamSubjectPolicy(input: {
  examId: string
  schoolId: string
  classId: string
  subjectId: string
}): Promise<ExamSubjectPolicy> {
  const row = twinRecord(await twinRpc('teacher', 'teacher_get_exam_subject_policy', {
    p_exam_id: input.examId,
    p_school_id: input.schoolId,
    p_class_id: input.classId,
    p_subject_id: input.subjectId,
  }))
  if (row.exam_id !== input.examId || row.school_id !== input.schoolId || row.subject_id !== input.subjectId) {
    throw new Error('The exam scoring setup could not be verified.')
  }
  return {
    exam_id: input.examId,
    school_id: input.schoolId,
    subject_id: input.subjectId,
    pass_mark: numberField(row, 'pass_mark'),
    max_marks: numberField(row, 'max_marks'),
    pass_percentage: numberField(row, 'pass_percentage'),
    configured: row.configured === true,
    is_locked: row.is_locked === true,
  }
}

export async function setCanonicalExamSubjectPolicy(input: {
  examId: string
  schoolId: string
  classId: string
  subjectId: string
  maxMarks: number
  passMark: number
}): Promise<ExamSubjectPolicy> {
  const row = twinRecord(await twinRpc('teacher', 'teacher_set_exam_subject_policy', {
    p_exam_id: input.examId,
    p_school_id: input.schoolId,
    p_class_id: input.classId,
    p_subject_id: input.subjectId,
    p_max_marks: input.maxMarks,
    p_pass_mark: input.passMark,
  }))
  return {
    exam_id: String(row.exam_id ?? ''),
    school_id: String(row.school_id ?? ''),
    subject_id: String(row.subject_id ?? ''),
    pass_mark: numberField(row, 'pass_mark'),
    max_marks: numberField(row, 'max_marks'),
    pass_percentage: numberField(row, 'pass_percentage'),
    configured: row.configured === true,
    is_locked: row.is_locked === true,
  }
}

export async function saveCanonicalExamResult(input: ExamResultSave): Promise<CanonicalExamResult> {
  const resultState = normalizeExamResultState(input.resultState, input.isAbsent === true)
  const row = twinRecord(await twinRpc('teacher', 'teacher_save_exam_result_state', {
    p_exam_id: input.examId,
    p_school_id: input.schoolId,
    p_class_id: input.classId,
    p_subject_id: input.subjectId,
    p_student_id: input.studentId,
    p_marks: resultState === 'entered' ? input.marks : null,
    p_result_state: resultState,
    p_expected_updated_at: input.expectedUpdatedAt,
  }))
  const returnedState = normalizeExamResultState(row.result_state, row.is_absent === true)
  if (
    typeof row.id !== 'string' ||
    row.student_id !== input.studentId ||
    row.exam_id !== input.examId ||
    row.school_id !== input.schoolId ||
    row.class_id !== input.classId ||
    row.subject_id !== input.subjectId ||
    returnedState !== resultState ||
    typeof row.updated_at !== 'string'
  ) throw new Error('The saved result could not be verified.')

  const marks = row.marks == null ? null : Number(row.marks)
  const maxMarks = Number(row.max_marks)
  const percentage = row.percentage == null ? null : Number(row.percentage)
  if (resultState === 'entered' && (marks == null || !Number.isFinite(marks) || marks !== input.marks)) throw new Error('The saved score could not be verified.')
  if (!Number.isFinite(maxMarks) || maxMarks <= 0 || (percentage != null && !Number.isFinite(percentage))) throw new Error('The saved result could not be verified.')

  return {
    id: row.id,
    student_id: input.studentId,
    marks,
    max_marks: maxMarks,
    percentage,
    result_state: returnedState,
    is_absent: returnedState === 'absent',
    updated_at: row.updated_at,
  }
}

export async function saveCanonicalExamResults(inputs: ExamResultSave[]): Promise<CanonicalExamResult[]> {
  if (!inputs.length) return []
  const saved = await twinRpc('teacher', 'teacher_save_exam_result_states', {
    p_changes: inputs.map(input => {
      const resultState = normalizeExamResultState(input.resultState, input.isAbsent === true)
      return {
        exam_id: input.examId,
        school_id: input.schoolId,
        class_id: input.classId,
        subject_id: input.subjectId,
        student_id: input.studentId,
        marks: resultState === 'entered' ? input.marks : null,
        result_state: resultState,
        expected_updated_at: input.expectedUpdatedAt,
      }
    }),
  })
  if (!Array.isArray(saved) || saved.length !== inputs.length) throw new Error('The saved results could not be verified. Reload before retrying.')
  const byStudent = new Map(saved.map(value => {
    const row = twinRecord(value)
    return [String(row.student_id ?? ''), row] as const
  }))
  const result: CanonicalExamResult[] = []
  for (const input of inputs) {
    const row = byStudent.get(input.studentId)
    if (!row) throw new Error('The saved results could not be verified. Reload before retrying.')
    const state = normalizeExamResultState(row.result_state, row.is_absent === true)
    const marks = row.marks == null ? null : Number(row.marks)
    const maxMarks = Number(row.max_marks)
    const percentage = row.percentage == null ? null : Number(row.percentage)
    if (
      row.exam_id !== input.examId ||
      row.school_id !== input.schoolId ||
      row.class_id !== input.classId ||
      row.subject_id !== input.subjectId ||
      state !== normalizeExamResultState(input.resultState, input.isAbsent === true) ||
      !Number.isFinite(maxMarks)
    ) throw new Error('The saved results could not be verified. Reload before retrying.')
    result.push({
      id: String(row.id),
      student_id: input.studentId,
      marks,
      max_marks: maxMarks,
      percentage,
      result_state: state,
      is_absent: state === 'absent',
      updated_at: String(row.updated_at),
    })
  }
  window.dispatchEvent(new CustomEvent('vibeschool:record-saved', { detail: { kind: 'exam_result' } }))
  return result
}

export async function clearCanonicalExamResult(input: {
  examId: string
  schoolId: string
  classId: string
  subjectId: string
  studentId: string
  expectedUpdatedAt: string
}): Promise<void> {
  const row = twinRecord(await twinRpc('teacher', 'teacher_clear_exam_result', {
    p_exam_id: input.examId,
    p_school_id: input.schoolId,
    p_class_id: input.classId,
    p_subject_id: input.subjectId,
    p_student_id: input.studentId,
    p_expected_updated_at: input.expectedUpdatedAt,
  }))
  if (row.deleted !== true || row.student_id !== input.studentId) throw new Error('The result could not be cleared safely.')
  window.dispatchEvent(new CustomEvent('vibeschool:record-saved', { detail: { kind: 'exam_result' } }))
}
