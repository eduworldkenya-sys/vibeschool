import { twinRecord, twinRpc } from '@/lib/twin/transport'

export interface ClassExamLearner {
  id: string
  name: string
  admission_number: string | null
}
export interface ClassExamSubject {
  id: string
  name: string
  max_marks: number
  can_enter: boolean
  can_correct: boolean
}
export interface ClassExamResult {
  student_id: string
  subject_id: string
  marks: number | null
  max_marks: number
  percentage: number | null
  result_state: string
  updated_at: string
}
export interface ClassExamSheet {
  exam_id: string
  school_id: string
  class_id: string
  is_locked: boolean
  is_class_teacher: boolean
  learners: ClassExamLearner[]
  subjects: ClassExamSubject[]
  results: ClassExamResult[]
}
function rows(value: unknown): Record<string, unknown>[] {
  if (!Array.isArray(value)) throw new Error('The class examination register returned an invalid list.')
  return value.map(v => {
    if (!v || typeof v !== 'object' || Array.isArray(v)) {
      throw new Error('The class examination register returned an invalid record.')
    }
    return v as Record<string, unknown>
  })
}
function optionalNumber(v: unknown): number | null {
  if (v == null) return null
  const n = Number(v)
  if (!Number.isFinite(n)) throw new Error('An examination score was not valid.')
  return n
}
export async function loadClassExamSheet(input: {
  examId: string
  schoolId: string
  classId: string
}): Promise<ClassExamSheet> {
  const payload = twinRecord(await twinRpc('teacher', 'teacher_get_class_exam_sheet', {
    p_exam_id: input.examId,
    p_school_id: input.schoolId,
    p_class_id: input.classId,
  }))
  if (payload.exam_id !== input.examId || payload.school_id !== input.schoolId || payload.class_id !== input.classId) {
    throw new Error('The examination register context could not be verified.')
  }
  const learners = rows(payload.learners).map(v => {
    if (typeof v.id !== 'string' || typeof v.name !== 'string') throw new Error('Invalid learner in examination roster.')
    return {
      id: v.id, name: v.name,
      admission_number: typeof v.admission_number === 'string' ? v.admission_number : null,
    }
  })
  const subjects = rows(payload.subjects).map(v => {
    const max = Number(v.max_marks)
    if (typeof v.id !== 'string' || typeof v.name !== 'string' || !Number.isFinite(max) || max <= 0) {
      throw new Error('Invalid learning area in examination register.')
    }
    return {
      id: v.id, name: v.name, max_marks: max,
      can_enter: v.can_enter === true, can_correct: v.can_correct === true,
    }
  })
  const learnerIds = new Set(learners.map(l => l.id))
  const subjectIds = new Set(subjects.map(s => s.id))
  if (learnerIds.size !== learners.length || subjectIds.size !== subjects.length) {
    throw new Error('Examination roster contains duplicate identities.')
  }
  const results = rows(payload.results).map(v => {
    if (typeof v.student_id !== 'string' || !learnerIds.has(v.student_id) ||
      typeof v.subject_id !== 'string' || !subjectIds.has(v.subject_id) ||
      typeof v.result_state !== 'string' || typeof v.updated_at !== 'string') {
      throw new Error('The examination results did not match the current roster.')
    }
    const max = Number(v.max_marks)
    if (!Number.isFinite(max) || max <= 0) throw new Error('Invalid recorded examination maximum.')
    return {
      student_id: v.student_id, subject_id: v.subject_id,
      marks: optionalNumber(v.marks), max_marks: max,
      percentage: optionalNumber(v.percentage),
      result_state: v.result_state, updated_at: v.updated_at,
    }
  })
  if (new Set(results.map(r => r.student_id + ':' + r.subject_id)).size !== results.length) {
    throw new Error('Duplicate examination result detected.')
  }
  return {
    exam_id: input.examId, school_id: input.schoolId, class_id: input.classId,
    is_locked: payload.is_locked === true,
    is_class_teacher: payload.is_class_teacher === true,
    learners, subjects, results,
  }
}

export async function correctClassExamResult(input: {
  examId: string
  schoolId: string
  classId: string
  subjectId: string
  studentId: string
  marks: number | null
  resultState: string
  expectedUpdatedAt: string
  reason: string
}): Promise<void> {
  const payload = twinRecord(await twinRpc('teacher', 'teacher_correct_class_exam_result', {
    p_exam_id: input.examId, p_school_id: input.schoolId, p_class_id: input.classId,
    p_subject_id: input.subjectId, p_student_id: input.studentId,
    p_marks: input.resultState === 'entered' ? input.marks : null,
    p_result_state: input.resultState,
    p_expected_updated_at: input.expectedUpdatedAt,
    p_reason: input.reason,
  }))
  if (payload.exam_id !== input.examId || payload.school_id !== input.schoolId ||
    payload.class_id !== input.classId || payload.subject_id !== input.subjectId ||
    payload.student_id !== input.studentId || payload.result_state !== input.resultState ||
    typeof payload.updated_at !== 'string') {
    throw new Error('The corrected result could not be verified.')
  }
  if (input.resultState === 'entered' && Number(payload.marks) !== input.marks) {
    throw new Error('The corrected score did not match the saved value.')
  }
  window.dispatchEvent(new CustomEvent('vibeschool:record-saved',{detail:{kind:'exam_result'}}))
}
