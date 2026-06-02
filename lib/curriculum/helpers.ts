// lib/curriculum/helpers.ts
import type { Grade, Subject, Term, Substrand, GradeContent, SubstrandQuery, WeekSummary, CoverageReport, LessonContext, ParentBrief } from "./types"
import { isCompleteSubstrand } from "./validators"
function resolve(curriculum: Record<Grade,GradeContent>, query: SubstrandQuery): Substrand|null {
  const { grade, term, week } = query
  const subject = query.subject.toLowerCase().trim() as Subject
  const gradeData = curriculum[grade]; if (!gradeData) return null
  const subjectData = gradeData.subjects[subject]; if (!subjectData) return null
  const termData = subjectData.terms.find(t=>t.term===term); if (!termData) return null
  const weekData = termData.weeks.find(w=>w.week===week); if (!weekData) return null
  return weekData.substrand
}
export function getLessonContext(curriculum: Record<Grade,GradeContent>, query: SubstrandQuery): LessonContext|null {
  const s = resolve(curriculum, query)
  if (!s||!isCompleteSubstrand(s)) return null
  return { topic:s.name, term:s.term, week:s.week, outcomes:s.learning_outcomes, mastery_notes:s.teacher_mastery_notes, tips:s.teaching_tips, mistakes:s.common_mistakes, examples:s.worked_examples, practice:s.practice_questions, classroom_warnings:s.warning_signs.classroom }
}
export function getWeekContext(curriculum: Record<Grade,GradeContent>, query: SubstrandQuery) {
  return { previous:resolve(curriculum,{...query,week:query.week-1}), current:resolve(curriculum,query), next:resolve(curriculum,{...query,week:query.week+1}) }
}
export function getParentBrief(curriculum: Record<Grade,GradeContent>, query: SubstrandQuery): ParentBrief|null {
  const s = resolve(curriculum, query)
  if (!s||s.status==="pending") return null
  return { topic:s.name, summary:s.parent_summary, questions:s.parent_questions, home_activity:s.home_activity, warning_signs:s.warning_signs.home }
}
export function getTermSummary(curriculum: Record<Grade,GradeContent>, grade: Grade, subject: Subject, term: Term): WeekSummary[] {
  const gradeData = curriculum[grade]; if (!gradeData) return []
  const subjectData = gradeData.subjects[subject]; if (!subjectData) return []
  const termData = subjectData.terms.find(t=>t.term===term); if (!termData) return []
  return termData.weeks.map(w=>({ week:w.week, strand:w.strand, name:w.substrand.name, status:w.substrand.status }))
}
export function getCoverageReport(curriculum: Record<Grade,GradeContent>, grade: Grade, subject: Subject, term: Term): CoverageReport {
  const weeks = getTermSummary(curriculum,grade,subject,term)
  const complete=weeks.filter(w=>w.status==="complete").length
  const pending=weeks.filter(w=>w.status==="pending").length
  const review_needed=weeks.filter(w=>w.status==="review_needed").length
  return { grade, subject, term, total_weeks:weeks.length, complete, pending, review_needed, coverage_percent:weeks.length>0?Math.round((complete/weeks.length)*100):0 }
}
