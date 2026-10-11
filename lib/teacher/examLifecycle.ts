import { twinRecord, twinRpc } from '@/lib/twin/transport'
import type { TwinRole } from '@/lib/twin/core'

export interface ExamReview {
  subject_id: string
  state: 'draft' | 'submitted' | 'verified' | 'reopened'
  submitted_at: string | null
  verified_at: string | null
  updated_at: string
}
export interface ExamLifecycle {
  status: 'draft' | 'published'
  subjects: ExamReview[]
  expected_subject_count: number
  is_school_admin: boolean
}
type Context = {examId:string,schoolId:string,classId:string}
function args(c:Context){return {p_exam_id:c.examId,p_school_id:c.schoolId,p_class_id:c.classId}}
function status(record:Record<string,unknown>, allowed:string[]):string{
  if(typeof record.status!=='string'||!allowed.includes(record.status))
    throw new Error('Unexpected examination lifecycle response.')
  return record.status
}
export async function getExamLifecycle(c:Context,role:TwinRole='teacher'):Promise<ExamLifecycle>{
  const p=twinRecord(await twinRpc(role,'teacher_get_class_exam_lifecycle',args(c)))
  const st=status(p,['draft','published']) as ExamLifecycle['status']
  if(!Array.isArray(p.subjects)||!Number.isInteger(p.expected_subject_count))
    throw new Error('Examination lifecycle list was incomplete.')
  const subjects=p.subjects.map((raw:unknown)=>{
    const r=twinRecord(raw)
    return {
      subject_id:String(r.subject_id),
      state:status(r,['draft','submitted','verified','reopened']) as ExamReview['state'],
      submitted_at:typeof r.submitted_at==='string'?r.submitted_at:null,
      verified_at:typeof r.verified_at==='string'?r.verified_at:null,
      updated_at:String(r.updated_at??''),
    }
  })
  return {status:st,subjects,expected_subject_count:Number(p.expected_subject_count),
    is_school_admin:p.is_school_admin===true}
}
export async function submitExamSubject(c:Context & {subjectId:string}):Promise<void>{
  const p=twinRecord(await twinRpc('teacher','teacher_submit_class_exam_subject',{
    ...args(c),p_subject_id:c.subjectId,
  }))
  status(p,['submitted'])
}
export async function reviewExamSubject(c:Context & {
  subjectId:string,action:'verify'|'reopen',reason:string|null,
}):Promise<void>{
  const p=twinRecord(await twinRpc('admin','school_review_class_exam_subject',{
    ...args(c),p_subject_id:c.subjectId,p_action:c.action,p_reason:c.reason,
  }))
  status(p,[c.action==='verify'?'verified':'reopened'])
}
export async function setExamPublication(c:Context & {
  publish:boolean,reason:string|null,
}):Promise<void>{
  const p=twinRecord(await twinRpc('admin','school_set_class_exam_publication',{
    ...args(c),p_publish:c.publish,p_reason:c.reason,
  }))
  status(p,[c.publish?'published':'draft'])
}
