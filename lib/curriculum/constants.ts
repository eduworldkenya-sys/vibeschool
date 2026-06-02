// lib/curriculum/constants.ts
import type { Grade, Subject, Term, Substrand } from "./types"
export const GRADES: Grade[] = ["grade6", "grade7", "grade8"]
export const SUBJECTS: Subject[] = ["mathematics","english","kiswahili","science","socialstudies","homescience","agriculture","cre"]
export const TERMS: Term[] = [1, 2, 3]
export const WEEKS_PER_TERM: Record<Term, number[]> = { 1: [1,2,3,4], 2: [5,6,7,8,9], 3: [10,11,12,13] }

export const SUBJECT_DISPLAY_NAMES: Record<Subject, string> = { 
  mathematics: "Mathematics", 
  english: "English", 
  kiswahili: "Kiswahili", 
  science: "Science & Technology", 
  socialstudies: "Social Studies", 
  homescience: "Home Science", 
  agriculture: "Agriculture", 
  cre: "CRE" 
}
export const GRADE_DISPLAY_NAMES: Record<Grade, string> = { grade6:"Grade 6", grade7:"Grade 7", grade8:"Grade 8" }

export function createEmptySubstrand(term: Term, week: number): Substrand {
  return { name:"PENDING", term, week, status:"pending", learning_outcomes:[], teacher_mastery_notes:"", teaching_tips:[], common_mistakes:[], worked_examples:[], practice_questions:{ easy:[], medium:[], hard:[] }, parent_summary:"", parent_questions:[], home_activity:"", warning_signs:{ classroom:[], home:[] } }
}
