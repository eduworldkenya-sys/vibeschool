// lib/curriculum/types.ts
export type Grade = "grade6" | "grade7" | "grade8"
// Fixed to absolute lowercase to match query normalizations safely
export type Subject = "mathematics" | "english" | "kiswahili" | "science" | "socialstudies" | "homescience" | "agriculture" | "cre"
export type Term = 1 | 2 | 3
export type ContentStatus = "complete" | "pending" | "review_needed"

export interface Mistake { mistake: string; why_it_happens: string; how_to_correct: string }
export interface WorkedExample { problem: string; solution_steps: string[]; answer: string; kenyan_context: string }
export interface PracticeQuestion { question: string; answer: string; parent_note?: string }
export interface PracticeQuestions { easy: PracticeQuestion[]; medium: PracticeQuestion[]; hard: PracticeQuestion[] }
export interface WarningSign { classroom: string[]; home: string[] }

export interface Substrand { 
  name: string; 
  term: Term; 
  week: number; 
  status: ContentStatus; 
  learning_outcomes: string[]; 
  teacher_mastery_notes: string; 
  teaching_tips: string[]; 
  common_mistakes: Mistake[]; 
  worked_examples: WorkedExample[]; 
  practice_questions: PracticeQuestions; 
  parent_summary: string; 
  parent_questions: string[]; 
  home_activity: string; 
  warning_signs: WarningSign 
}

export interface WeekContent { week: number; strand: string; substrand: Substrand }
export interface TermContent { term: Term; weeks: WeekContent[] }
export interface SubjectContent { subject: Subject; grade: Grade; terms: TermContent[] }
export interface GradeContent { grade: Grade; subjects: Partial<Record<Subject, SubjectContent>> }
export interface SubstrandQuery { grade: Grade; subject: Subject; term: Term; week: number }
export interface WeekSummary { week: number; strand: string; name: string; status: ContentStatus }
export interface CoverageReport { grade: Grade; subject: Subject; term: Term; total_weeks: number; complete: number; pending: number; review_needed: number; coverage_percent: number }
export interface LessonContext { topic: string; term: Term; week: number; outcomes: string[]; mastery_notes: string; tips: string[]; mistakes: Mistake[]; examples: WorkedExample[]; practice: PracticeQuestions; classroom_warnings: string[] }
export interface ParentBrief { topic: string; summary: string; questions: string[]; home_activity: string; warning_signs: string[] }
