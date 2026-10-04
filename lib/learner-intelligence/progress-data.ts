import { supabase } from '@/lib/supabase'
import type { ProgressEvidence } from './progress-record'
import type { ProgressTerm } from './progress-period'

export type ProgressAuthority = {
  teacherId: string
  schoolId: string
  classId: string
  className: string
  subjects: { id: string; name: string }[]
}

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('The progress response could not be read.')
  return value as Record<string, unknown>
}
function required(value: unknown): string {
  if (typeof value !== 'string' || !value.trim()) throw new Error('The progress response is missing an identity or date.')
  return value
}
function optional(value: unknown): string | null { return typeof value === 'string' ? value : null }
function numeric(value: unknown): number | null {
  if (value == null || value === '') return null
  const number = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN
  return Number.isFinite(number) ? number : null
}

type Response = { data: unknown[] | null; error: { message: string } | null }
export async function readProgressPages(query: (from: number, to: number) => PromiseLike<Response>): Promise<unknown[]> {
  const rows: unknown[] = []
  for (let offset = 0; offset < 20000; offset += 500) {
    const response = await query(offset, offset + 499)
    if (response.error) throw new Error(response.error.message)
    const page = response.data ?? []
    rows.push(...page)
    if (page.length < 500) return rows
  }
  throw new Error('This progress record is too large to load completely. Open a narrower source record; no partial class judgement has been shown.')
}

export async function loadProgressAuthority(classId: string): Promise<ProgressAuthority> {
  const auth = await supabase.auth.getUser()
  if (auth.error || !auth.data.user) throw new Error('Sign in again to view progress.')
  const response = await supabase.rpc('teacher_get_operating_context')
  if (response.error) throw new Error(response.error.message)
  const context = record(response.data)
  if (context.teacher_id !== auth.data.user.id || typeof context.school_id !== 'string') throw new Error('Your active teacher school could not be confirmed.')
  const assignments = (Array.isArray(context.classes) ? context.classes : []).map(record).filter(item => item.class_id === classId)
  if (!assignments.length) throw new Error('This class is not assigned to you in your active school.')
  const subjects = new Map<string, { id: string; name: string }>()
  for (const assignment of assignments) {
    if (typeof assignment.subject_id === 'string') subjects.set(assignment.subject_id, { id: assignment.subject_id, name: optional(assignment.subject_name) ?? 'Subject' })
  }
  return { teacherId: auth.data.user.id, schoolId: context.school_id, classId,
    className: `${optional(assignments[0].class_name) ?? 'Class'} ${optional(assignments[0].stream) ?? ''}`.trim(), subjects: Array.from(subjects.values()) }
}

export function decodeProgressEvidence(value: unknown): ProgressEvidence {
  const row = record(value)
  const observedAt = required(row.observed_at)
  if (!Number.isFinite(Date.parse(observedAt))) throw new Error('An evidence date needs reconciliation. No incomplete progress judgement has been shown.')
  const nested = Array.isArray(row.curriculum_learning_outcomes) ? row.curriculum_learning_outcomes[0] : row.curriculum_learning_outcomes
  const outcome = nested ? record(nested) : null
  return { id: required(row.id), studentId: required(row.student_id), subjectId: optional(row.subject_id), outcomeId: optional(row.outcome_id),
    outcomeText: outcome ? optional(outcome.outcome_text) : null, outcomeCode: outcome ? optional(outcome.outcome_code) : null,
    source: optional(row.evidence_source) ?? 'evidence', sourceId: optional(row.evidence_id), observedAt,
    score: numeric(row.score), maxScore: numeric(row.max_score), proficiency: optional(row.proficiency), notes: optional(row.notes), weight: numeric(row.weight) ?? 1 }
}

/** RLS remains authoritative. Reading never refreshes intervention records. */
export async function loadProgressEvidence(authority: ProgressAuthority, studentId?: string): Promise<ProgressEvidence[]> {
  if (!authority.subjects.length) return []
  const subjectIds = authority.subjects.map(subject => subject.id)
  const ledgerPromise = readProgressPages((from, to) => {
    let query = supabase.from('competency_evidence_ledger')
      .select('id,student_id,subject_id,outcome_id,evidence_source,evidence_id,score,max_score,proficiency,observed_at,notes,weight,curriculum_learning_outcomes(outcome_text,outcome_code)')
      .eq('school_id', authority.schoolId).eq('class_id', authority.classId).eq('observed_by', authority.teacherId)
      .in('subject_id', authority.subjects.map(subject => subject.id))
      .order('observed_at', { ascending: false }).order('id', { ascending: false }).range(from, to)
    if (studentId) query = query.eq('student_id', studentId)
    return query
  })
  const cbcPromise = readProgressPages((from, to) => {
    let query = supabase.from('cbc_assessments').select('id,student_id,subject_id,sub_strand,performance,notes,term,academic_year,created_at,updated_at')
      .eq('school_id', authority.schoolId).eq('class_id', authority.classId).eq('teacher_id', authority.teacherId).in('subject_id', subjectIds)
      .order('created_at', { ascending: false }).order('id').range(from, to)
    if (studentId) query = query.eq('student_id', studentId)
    return query
  })
  const gradebookPromise = readProgressPages((from, to) => {
    let query = supabase.from('assessment_gradebook_entries').select('attempt_id,student_id,subject_id,score,max_score,assessment_title,released_at')
      .eq('school_id', authority.schoolId).eq('class_id', authority.classId).eq('teacher_id', authority.teacherId).in('subject_id', subjectIds)
      .not('released_at', 'is', null).order('released_at', { ascending: false }).order('attempt_id').range(from, to)
    if (studentId) query = query.eq('student_id', studentId)
    return query
  })
  const examsPromise = readProgressPages((from, to) => {
    let query = supabase.from('exam_results').select('id,student_id,subject_id,marks,is_absent,created_at,updated_at,exam_id,exams(name,term,academic_year)')
      .eq('school_id', authority.schoolId).eq('class_id', authority.classId).eq('teacher_id', authority.teacherId).in('subject_id', subjectIds)
      .order('updated_at', { ascending: false }).order('id').range(from, to)
    if (studentId) query = query.eq('student_id', studentId)
    return query
  })
  const homeworkPromise = readProgressPages((from, to) => supabase.from('homework').select('id,title,subject')
    .eq('school_id', authority.schoolId).eq('class_id', authority.classId).eq('teacher_id', authority.teacherId)
    .order('id').range(from, to))
  const [ledger, cbc, gradebook, exams, homework] = await Promise.all([ledgerPromise, cbcPromise, gradebookPromise, examsPromise, homeworkPromise])
  const result = ledger.map(decodeProgressEvidence)
  const add = (value: unknown, source: string, idKey: string, dateKey: string, extra: Partial<ProgressEvidence>) => {
    const row = record(value), sourceId = required(row[idKey]), observedAt = required(row[dateKey])
    if (!Number.isFinite(Date.parse(observedAt))) throw new Error('A source result date needs reconciliation.')
    result.push({ id: `${source}:${sourceId}`, studentId: required(row.student_id), subjectId: optional(row.subject_id), outcomeId: null,
      timestampKind:'recorded',outcomeText: 'Subject result — curriculum outcome not linked', outcomeCode: null, source, sourceId, observedAt,updatedAt:optional(row.updated_at)??observedAt,
      score: null, maxScore: null, proficiency: null, notes: null, weight: 1, ...extra })
  }
  for (const value of cbc) {
    const row = record(value)
    add(row, 'cbc_observation', 'id', 'created_at', { reportingTerm:numeric(row.term),reportingYear:numeric(row.academic_year),proficiency: optional(row.performance), outcomeText: optional(row.sub_strand) || 'CBC observation — outcome not linked', notes: optional(row.notes) })
  }
  for (const value of gradebook) {
    const row = record(value)
    add(row, 'released_assessment', 'attempt_id', 'released_at', { timestampKind:'released',score: numeric(row.score), maxScore: numeric(row.max_score), outcomeText: optional(row.assessment_title) || 'Released assessment result' })
  }
  for (const value of exams) {
    const row = record(value), absent = row.is_absent === true
    const exam = record(row.exams)
    if (numeric(exam.term) == null || numeric(exam.academic_year) == null) throw new Error('An exam needs reporting term reconciliation.')
    add(row, 'exam_result', 'id', 'created_at', { reportingTerm:numeric(exam.term),reportingYear:numeric(exam.academic_year),outcomeText:optional(exam.name)??'Exam result',score: absent ? null : numeric(row.marks), maxScore: absent ? null : 100,
      notes: absent ? 'Absent — no score. Exam result has no outcome mapping.' : 'Marks recorded on this date. The Exam Centre uses marks out of 100. This subject total does not establish a curriculum outcome level or report release.' })
  }
  const homeworkById = new Map(homework.map(value => { const row = record(value); return [required(row.id), row] }))
  const homeworkIds = Array.from(homeworkById.keys())
  for (let index = 0; index < homeworkIds.length; index += 200) {
    const submissions = await readProgressPages((from, to) => {
      let query = supabase.from('homework_submissions').select('id,student_id,homework_id,mark,feedback,reviewed_at,updated_at')
        .in('homework_id', homeworkIds.slice(index, index + 200)).eq('status', 'marked')
        .order('updated_at', { ascending: false }).order('id').range(from, to)
      if (studentId) query = query.eq('student_id', studentId)
      return query
    })
    for (const value of submissions) {
      const row = record(value), assignment = homeworkById.get(required(row.homework_id))
      if (!assignment || !optional(row.student_id)) throw new Error('A marked submission needs learner and homework reconciliation.')
      const matches = authority.subjects.filter(subject => subject.name.toLowerCase().trim() === optional(assignment.subject)?.toLowerCase().trim())
      // An old text subject must resolve uniquely; no fuzzy subject authority.
      add(row, 'marked_homework', 'id', 'updated_at', { subjectId: matches.length===1?matches[0].id:null, score: numeric(row.mark), maxScore: null,
        outcomeText: optional(assignment.title) || 'Marked homework', notes: `${matches.length===1?'':'Subject identity needs reconciliation. '}${numeric(row.mark) == null ? 'No numeric mark recorded.' : `Recorded mark: ${numeric(row.mark)}. Maximum not recorded; no percentage calculated.`}${optional(row.feedback) ? ` ${optional(row.feedback)}` : ''}` })
    }
  }
  return result
}

export async function loadProgressTerms(schoolId: string): Promise<ProgressTerm[]> {
  const rows = await readProgressPages((from, to) => supabase.from('academic_terms').select('id,name,start_date,end_date,term,academic_year')
    .eq('school_id', schoolId).order('start_date', { ascending: false }).order('id').range(from, to))
  return rows.map(value => { const row = record(value); return { id: required(row.id), name: required(row.name), start_date: required(row.start_date), end_date: required(row.end_date),term:numeric(row.term)??undefined,academic_year:numeric(row.academic_year)??undefined } })
}

export type ProgressLearner = { id: string; name: string; admission_number: string | null; isCurrent: boolean; joinedAt: string | null; leftAt: string | null }

/** Separate identity from enrollment: never silently collapse a nested RLS join. */
export async function loadProgressRoster(authority: ProgressAuthority, historical: boolean): Promise<ProgressLearner[]> {
  const enrollments = await readProgressPages((from, to) => supabase.from('student_classes').select('id,student_id,is_current,joined_at,left_at')
    .eq('school_id', authority.schoolId).eq('class_id', authority.classId).eq('is_current', !historical)
    .order('joined_at',{ascending:false}).order('id').range(from, to))
  const unique = new Map<string, Record<string, unknown>>()
  for (const value of enrollments) { const row = record(value); const id = required(row.student_id); if (!unique.has(id)) unique.set(id, row) }
  const ids = Array.from(unique.keys()), learners: ProgressLearner[] = []
  for (let index = 0; index < ids.length; index += 200) {
    const students = await readProgressPages((from, to) => supabase.from('students').select('id,name,admission_number,deleted_at')
      .in('id', ids.slice(index, index + 200)).order('id').range(from, to))
    for (const value of students) {
      const student = record(value), id = required(student.id), enrollment = unique.get(id)
      if (!enrollment || student.deleted_at) throw new Error('A learner identity needs reconciliation. No incomplete roster has been shown.')
      learners.push({ id, name: required(student.name), admission_number: optional(student.admission_number), isCurrent: !historical,
        joinedAt: optional(enrollment.joined_at), leftAt: optional(enrollment.left_at) })
    }
  }
  if (learners.length !== ids.length) throw new Error(historical
    ? 'Historical learner identity access is not available for this class. Its enrollment records remain saved; the canonical historical roster authority must be reconciled before this view can be shown.'
    : 'Some enrolled learners could not be read. Retry or check class access; do not add them again.')
  return learners
}


export type ProgressAttendance = {id:string;studentId:string;date:string;status:'present'|'absent'|'excused';isLate:boolean;slotId:string|null}
/** Register context is separate from learning evidence and cannot establish ability. */
export async function loadProgressAttendance(authority:ProgressAuthority, studentId:string):Promise<ProgressAttendance[]> {
  const rows=await readProgressPages((from,to)=>supabase.from('attendance').select('id,student_id,date,status,is_late,timetable_slot_id')
    .eq('school_id',authority.schoolId).eq('class_id',authority.classId).eq('teacher_id',authority.teacherId).eq('student_id',studentId)
    .order('date',{ascending:false}).order('id').range(from,to))
  return rows.map(value=>{const row=record(value),status=row.status
    if(!['present','absent','excused'].includes(String(status)))throw new Error('A register status needs reconciliation.')
    return {id:required(row.id),studentId:required(row.student_id),date:required(row.date),status:status as ProgressAttendance['status'],isLate:row.is_late===true,slotId:optional(row.timetable_slot_id)}
  })
}
