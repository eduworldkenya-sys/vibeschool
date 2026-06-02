#!/bin/bash
set -euo pipefail
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
RESET='\033[0m'
log()     { echo -e "${GREEN}  ✓${RESET} $1"; }
section() { echo -e "\n${CYAN}${BOLD}── $1${RESET}"; }
abort()   { echo -e "${RED}  ✗ ABORT: $1${RESET}"; exit 1; }
[[ ! -f "package.json" ]] && abort "Run from ~/vibeschool"
echo -e "${BOLD}${CYAN}"
echo "  ╔══════════════════════════════════════════╗"
echo "  ║   VibeSchool CBC Curriculum Scaffold     ║"
echo "  ║   Setting the standard. No shortcuts.    ║"
echo "  ╚══════════════════════════════════════════╝"
echo -e "${RESET}"
section "Creating directory structure"
mkdir -p lib/curriculum/grade6/mathematics/term1
mkdir -p scripts
log "lib/curriculum/grade6/mathematics/term1/"
section "Writing types.ts"
cat > lib/curriculum/types.ts << 'EOF'
// lib/curriculum/types.ts
export type Grade = "grade6" | "grade7" | "grade8"
export type Subject = "mathematics" | "english" | "kiswahili" | "science" | "socialStudies" | "homeScience" | "agriculture" | "cre"
export type Term = 1 | 2 | 3
export type ContentStatus = "complete" | "pending" | "review_needed"
export interface Mistake { mistake: string; why_it_happens: string; how_to_correct: string }
export interface WorkedExample { problem: string; solution_steps: string[]; answer: string; kenyan_context: string }
export interface PracticeQuestion { question: string; answer: string; parent_note?: string }
export interface PracticeQuestions { easy: PracticeQuestion[]; medium: PracticeQuestion[]; hard: PracticeQuestion[] }
export interface WarningSign { classroom: string[]; home: string[] }
export interface Substrand { name: string; term: Term; week: number; status: ContentStatus; learning_outcomes: string[]; teacher_mastery_notes: string; teaching_tips: string[]; common_mistakes: Mistake[]; worked_examples: WorkedExample[]; practice_questions: PracticeQuestions; parent_summary: string; parent_questions: string[]; home_activity: string; warning_signs: WarningSign }
export interface WeekContent { week: number; strand: string; substrand: Substrand }
export interface TermContent { term: Term; weeks: WeekContent[] }
export interface SubjectContent { subject: Subject; grade: Grade; terms: TermContent[] }
export interface GradeContent { grade: Grade; subjects: Partial<Record<Subject, SubjectContent>> }
export interface SubstrandQuery { grade: Grade; subject: Subject; term: Term; week: number }
export interface WeekSummary { week: number; strand: string; name: string; status: ContentStatus }
export interface CoverageReport { grade: Grade; subject: Subject; term: Term; total_weeks: number; complete: number; pending: number; review_needed: number; coverage_percent: number }
export interface LessonContext { topic: string; term: Term; week: number; outcomes: string[]; mastery_notes: string; tips: string[]; mistakes: Mistake[]; examples: WorkedExample[]; practice: PracticeQuestions; classroom_warnings: string[] }
export interface ParentBrief { topic: string; summary: string; questions: string[]; home_activity: string; warning_signs: string[] }
EOF
log "lib/curriculum/types.ts"
section "Writing constants.ts"
cat > lib/curriculum/constants.ts << 'EOF'
// lib/curriculum/constants.ts
import type { Grade, Subject, Term, Substrand } from "./types"
export const GRADES: Grade[] = ["grade6", "grade7", "grade8"]
export const SUBJECTS: Subject[] = ["mathematics","english","kiswahili","science","socialStudies","homeScience","agriculture","cre"]
export const TERMS: Term[] = [1, 2, 3]
export const WEEKS_PER_TERM: Record<Term, number[]> = { 1: [1,2,3,4], 2: [5,6,7,8,9], 3: [10,11,12,13] }
export const SUBJECT_DISPLAY_NAMES: Record<Subject, string> = { mathematics:"Mathematics", english:"English", kiswahili:"Kiswahili", science:"Science & Technology", socialStudies:"Social Studies", homeScience:"Home Science", agriculture:"Agriculture", cre:"CRE" }
export const GRADE_DISPLAY_NAMES: Record<Grade, string> = { grade6:"Grade 6", grade7:"Grade 7", grade8:"Grade 8" }
export function createEmptySubstrand(term: Term, week: number): Substrand {
  return { name:"PENDING", term, week, status:"pending", learning_outcomes:[], teacher_mastery_notes:"", teaching_tips:[], common_mistakes:[], worked_examples:[], practice_questions:{ easy:[], medium:[], hard:[] }, parent_summary:"", parent_questions:[], home_activity:"", warning_signs:{ classroom:[], home:[] } }
}
EOF
log "lib/curriculum/constants.ts"
section "Writing validators.ts"
cat > lib/curriculum/validators.ts << 'EOF'
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
EOF
log "lib/curriculum/validators.ts"
section "Writing helpers.ts"
cat > lib/curriculum/helpers.ts << 'EOF'
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
EOF
log "lib/curriculum/helpers.ts"
section "Generating week files"
generate_week_file() {
  local week=$1 strand=$2
  cat > "lib/curriculum/grade6/mathematics/term1/week${week}.ts" << EOF
// lib/curriculum/grade6/mathematics/term1/week${week}.ts
import type { WeekContent } from "@/lib/curriculum/types"
import { createEmptySubstrand } from "@/lib/curriculum/constants"
const week${week}: WeekContent = { week:${week}, strand:"${strand}", substrand:createEmptySubstrand(1,${week}) }
export default week${week}
EOF
  log "week${week}.ts"
}
generate_week_file 1 "Numbers"
generate_week_file 2 "Numbers"
generate_week_file 3 "Numbers"
generate_week_file 4 "Numbers"
section "Writing term aggregators"
cat > lib/curriculum/grade6/mathematics/term1.ts << 'EOF'
// lib/curriculum/grade6/mathematics/term1.ts
import type { TermContent } from "@/lib/curriculum/types"
import week1 from "./term1/week1"
import week2 from "./term1/week2"
import week3 from "./term1/week3"
import week4 from "./term1/week4"
export const mathematicsTerm1: TermContent = { term:1, weeks:[week1,week2,week3,week4] }
EOF
log "term1.ts"
cat > lib/curriculum/grade6/mathematics/term2.ts << 'EOF'
// lib/curriculum/grade6/mathematics/term2.ts
import type { TermContent } from "@/lib/curriculum/types"
export const mathematicsTerm2: TermContent = { term:2, weeks:[] }
EOF
log "term2.ts"
cat > lib/curriculum/grade6/mathematics/term3.ts << 'EOF'
// lib/curriculum/grade6/mathematics/term3.ts
import type { TermContent } from "@/lib/curriculum/types"
export const mathematicsTerm3: TermContent = { term:3, weeks:[] }
EOF
log "term3.ts"
section "Writing barrels"
cat > lib/curriculum/grade6/mathematics/index.ts << 'EOF'
// lib/curriculum/grade6/mathematics/index.ts
import type { SubjectContent } from "@/lib/curriculum/types"
import { mathematicsTerm1 } from "./term1"
import { mathematicsTerm2 } from "./term2"
import { mathematicsTerm3 } from "./term3"
export const mathematics: SubjectContent = { subject:"mathematics", grade:"grade6", terms:[mathematicsTerm1,mathematicsTerm2,mathematicsTerm3] }
EOF
log "mathematics/index.ts"
cat > lib/curriculum/grade6/index.ts << 'EOF'
// lib/curriculum/grade6/index.ts
import type { GradeContent } from "@/lib/curriculum/types"
import { mathematics } from "./mathematics"
export const grade6: GradeContent = { grade:"grade6", subjects:{ mathematics } }
EOF
log "grade6/index.ts"
cat > lib/curriculum/index.ts << 'EOF'
// lib/curriculum/index.ts
import { grade6 } from "./grade6"
import type { Grade, GradeContent } from "./types"
export const CBC_CURRICULUM = { grade6 } as Record<Grade,GradeContent>
export type { Grade, Subject, Term, ContentStatus, Substrand, WeekContent, TermContent, SubjectContent, GradeContent, SubstrandQuery, WeekSummary, CoverageReport, LessonContext, ParentBrief, Mistake, WorkedExample, PracticeQuestion, PracticeQuestions, WarningSign } from "./types"
export { getLessonContext, getWeekContext, getParentBrief, getTermSummary, getCoverageReport } from "./helpers"
export { isValidSubstrand, isCompleteSubstrand, auditSubstrand, validateSubjectContent } from "./validators"
export { GRADES, SUBJECTS, TERMS, WEEKS_PER_TERM, SUBJECT_DISPLAY_NAMES, GRADE_DISPLAY_NAMES, createEmptySubstrand } from "./constants"
EOF
log "curriculum/index.ts"
echo ""
echo -e "${BOLD}${GREEN}✅ Done. Files created:${RESET}"
find lib/curriculum -name "*.ts" | sort | while read -r f; do echo -e "  ${CYAN}${f}${RESET}"; done
echo ""
