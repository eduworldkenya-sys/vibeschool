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
