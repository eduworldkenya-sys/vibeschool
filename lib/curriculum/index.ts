// lib/curriculum/index.ts
import { grade6 } from "./grade6"
import type { Grade, GradeContent } from "./types"

// Configured safely as a Partial map to block invalid multi-grade lookup reads at build time
export const CBC_CURRICULUM: Partial<Record<Grade, GradeContent>> = { grade6 }

export type { Grade, Subject, Term, ContentStatus, Substrand, WeekContent, TermContent, SubjectContent, GradeContent, SubstrandQuery, WeekSummary, CoverageReport, LessonContext, ParentBrief, Mistake, WorkedExample, PracticeQuestion, PracticeQuestions, WarningSign } from "./types"
export { getLessonContext, getWeekContext, getParentBrief, getTermSummary, getCoverageReport } from "./helpers"
export { isValidSubstrand, isCompleteSubstrand, auditSubstrand, validateSubjectContent } from "./validators"
export { GRADES, SUBJECTS, TERMS, WEEKS_PER_TERM, SUBJECT_DISPLAY_NAMES, GRADE_DISPLAY_NAMES, createEmptySubstrand } from "./constants"
