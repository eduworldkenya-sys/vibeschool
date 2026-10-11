import { twinRecord, twinRpc } from '@/lib/twin/transport'

export interface ExamResultSave {
  examId:string;schoolId:string;classId:string;subjectId:string;studentId:string;
  marks:number;isAbsent:boolean;expectedUpdatedAt:string|null
}
export async function saveCanonicalExamResult(input:ExamResultSave) {
  const row=twinRecord(await twinRpc('teacher','teacher_save_exam_result',{
    p_exam_id:input.examId,p_school_id:input.schoolId,p_class_id:input.classId,p_subject_id:input.subjectId,
    p_student_id:input.studentId,p_marks:input.marks,p_is_absent:input.isAbsent,p_expected_updated_at:input.expectedUpdatedAt,
  }))
  if(typeof row.id!=='string'||row.student_id!==input.studentId||row.exam_id!==input.examId||row.school_id!==input.schoolId||row.class_id!==input.classId||row.subject_id!==input.subjectId||Number(row.marks)!==input.marks||row.is_absent!==input.isAbsent||typeof row.updated_at!=='string')throw new Error('The saved result could not be verified.')
  return{id:row.id,student_id:input.studentId,marks:input.marks,is_absent:input.isAbsent,updated_at:row.updated_at}
}

export async function saveCanonicalExamResults(inputs:ExamResultSave[]):Promise<void> {
  const saved=await twinRpc('teacher','teacher_save_exam_results',{p_changes:inputs.map(input=>({
    exam_id:input.examId,school_id:input.schoolId,class_id:input.classId,subject_id:input.subjectId,student_id:input.studentId,
    marks:input.marks,is_absent:input.isAbsent,expected_updated_at:input.expectedUpdatedAt,
  }))})
  if(!Array.isArray(saved)||saved.length!==inputs.length)throw new Error('The saved marks could not be verified. Reload before retrying.')
  for(const input of inputs){
    if(!saved.some(value=>{const row=twinRecord(value);return row.student_id===input.studentId&&row.exam_id===input.examId&&row.school_id===input.schoolId&&row.class_id===input.classId&&row.subject_id===input.subjectId&&Number(row.marks)===input.marks&&row.is_absent===input.isAbsent}))throw new Error('The saved marks could not be verified. Reload before retrying.')
  }
  window.dispatchEvent(new CustomEvent('vibeschool:record-saved',{detail:{kind:'exam_result'}}))
}

export type ExamSubjectPolicy = {
  exam_id: string
  school_id: string
  subject_id: string
  max_marks: number
  pass_mark: number
  pass_percentage: number
  configured: boolean
  is_locked: boolean
}

function confirmedPolicy(row: Record<string,unknown>, context: {
  examId: string, schoolId: string, subjectId: string
}): ExamSubjectPolicy {
  if (row.exam_id !== context.examId || row.school_id !== context.schoolId ||
    row.subject_id !== context.subjectId) {
    throw new Error('Exam scoring policy identity could not be verified.')
  }
  const max_marks = Number(row.max_marks)
  const pass_mark = Number(row.pass_mark)
  const pass_percentage = Number(row.pass_percentage)
  if (!Number.isFinite(max_marks) || max_marks <= 0 ||
    !Number.isFinite(pass_mark) || pass_mark < 0 || pass_mark > max_marks ||
    !Number.isFinite(pass_percentage)) {
    throw new Error('Invalid exam subject scoring policy.')
  }
  return {
    exam_id: context.examId, school_id: context.schoolId, subject_id: context.subjectId,
    max_marks, pass_mark, pass_percentage,
    configured: row.configured === true, is_locked: row.is_locked === true,
  }
}
export async function getCanonicalExamSubjectPolicy(input: {
  examId: string, schoolId: string, classId: string, subjectId: string
}): Promise<ExamSubjectPolicy> {
  const data=twinRecord(await twinRpc('teacher','teacher_get_exam_subject_policy',{
    p_exam_id:input.examId,p_school_id:input.schoolId,
    p_class_id:input.classId,p_subject_id:input.subjectId,
  }))
  return confirmedPolicy(data,input)
}
export async function setCanonicalExamSubjectPolicy(input: {
  examId: string, schoolId: string, classId: string, subjectId: string,
  maxMarks: number, passMark: number
}): Promise<ExamSubjectPolicy> {
  if (!Number.isFinite(input.maxMarks) || input.maxMarks<=0 ||
    !Number.isFinite(input.passMark) || input.passMark<0 || input.passMark>input.maxMarks) {
    throw new Error('Enter a valid maximum and threshold for this subject.')
  }
  const data=twinRecord(await twinRpc('teacher','teacher_set_exam_subject_policy',{
    p_exam_id:input.examId,p_school_id:input.schoolId,
    p_class_id:input.classId,p_subject_id:input.subjectId,
    p_max_marks:input.maxMarks,p_pass_mark:input.passMark,
  }))
  return confirmedPolicy(data,input)
}
