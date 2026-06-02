// lib/curriculum/validators.ts
import type { Substrand, SubjectContent } from "./types"
export function isValidSubstrand(value: unknown): value is Substrand {
  if (!value || typeof value !== "object") return false
  const s = value as Record<string, unknown>
  return typeof s.name==="string" && typeof s.term==="number" && typeof s.week==="number" && typeof s.status==="string" && Array.isArray(s.learning_outcomes) && typeof s.teacher_mastery_notes==="string" && Array.isArray(s.teaching_tips) && Array.isArray(s.common_mistakes) && Array.isArray(s.worked_examples) && typeof s.practice_questions==="object" && typeof s.parent_summary==="string" && Array.isArray(s.parent_questions) && typeof s.home_activity==="string" && typeof s.warning_signs==="object" && s.warning_signs!==null && Array.isArray((s.warning_signs as Record<string,unknown>).classroom) && Array.isArray((s.warning_signs as Record<string,unknown>).home)
}
export function isCompleteSubstrand(s: Substrand): boolean {
  const pq = s.practice_questions
  return s.status==="complete" && s.name!=="PENDING" && s.name.length>0 && s.learning_outcomes.length>=4 && s.teaching_tips.length>=3 && s.common_mistakes.length>=3 && s.worked_examples.length>=2 && pq.easy.length>=3 && pq.medium.length>=3 && pq.hard.length>=3 && pq.hard.every(q=>typeof q.parent_note==="string" && q.parent_note.length>0) && s.parent_summary.length>0 && s.parent_questions.length>=3 && s.home_activity.length>0 && s.warning_signs.classroom.length>=3 && s.warning_signs.home.length>=3
}
export function auditSubstrand(s: Substrand): string[] {
  const errors: string[] = []
  const pq = s.practice_questions
  if (s.name==="PENDING"||s.name.length===0) errors.push("name: not set")
  if (s.learning_outcomes.length<4) errors.push(`learning_outcomes: need 4, have ${s.learning_outcomes.length}`)
  if (s.teaching_tips.length<3) errors.push(`teaching_tips: need 3, have ${s.teaching_tips.length}`)
  if (s.common_mistakes.length<3) errors.push(`common_mistakes: need 3, have ${s.common_mistakes.length}`)
  if (s.worked_examples.length<2) errors.push(`worked_examples: need 2, have ${s.worked_examples.length}`)
  if (pq.easy.length<3) errors.push(`practice_questions.easy: need 3, have ${pq.easy.length}`)
  if (pq.medium.length<3) errors.push(`practice_questions.medium: need 3, have ${pq.medium.length}`)
  if (pq.hard.length<3) errors.push(`practice_questions.hard: need 3, have ${pq.hard.length}`)
  const missing = pq.hard.filter(q=>!q.parent_note||q.parent_note.length===0)
  if (missing.length>0) errors.push(`practice_questions.hard: ${missing.length} missing parent_note`)
  if (s.parent_summary.length===0) errors.push("parent_summary: empty")
  if (s.parent_questions.length<3) errors.push(`parent_questions: need 3, have ${s.parent_questions.length}`)
  if (s.home_activity.length===0) errors.push("home_activity: empty")
  if (s.warning_signs.classroom.length<3) errors.push(`warning_signs.classroom: need 3, have ${s.warning_signs.classroom.length}`)
  if (s.warning_signs.home.length<3) errors.push(`warning_signs.home: need 3, have ${s.warning_signs.home.length}`)
  return errors
}
export function validateSubjectContent(content: SubjectContent): string[] {
  const errors: string[] = []
  content.terms.forEach(term => {
    term.weeks.forEach(week => {
      if (!isValidSubstrand(week.substrand)) { errors.push(`Term ${term.term} Week ${week.week}: invalid shape`); return }
      auditSubstrand(week.substrand).forEach(e => errors.push(`Term ${term.term} Week ${week.week}: ${e}`))
    })
  })
  return errors
}
