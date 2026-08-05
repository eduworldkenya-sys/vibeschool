import type { Json } from '@/lib/database.types'

export type AssessmentType =
  | 'exercise'
  | 'homework'
  | 'quiz'
  | 'test'
  | 'exam'
  | 'practice'
  | 'diagnostic'

export type QuestionType =
  | 'multiple_choice'
  | 'multiple_response'
  | 'true_false'
  | 'fill_blank'
  | 'matching'
  | 'ordering'
  | 'numeric'
  | 'short_answer'
  | 'structured'
  | 'essay'
  | 'drawing'
  | 'practical'
  | 'oral'
  | 'file_upload'
  | 'audio'
  | 'video'

export type AutoMarkingMode =
  | 'none'
  | 'exact'
  | 'case_insensitive'
  | 'numeric_tolerance'
  | 'option_match'
  | 'set_match'
  | 'ordered_match'

export type ScorePolicy =
  | 'immediate'
  | 'after_close'
  | 'after_review'
  | 'never'

export interface CreateDraftAssessmentInput {
  classId: string
  subjectId: string
  assessmentType: AssessmentType
  title: string
  description?: string | null
  instructions?: string | null
  lessonPlanId?: string | null
  teachingOccurrenceId?: string | null
  sourceResourceId?: string | null
  generationSource?: string
  generationMetadata?: Json
}

export interface AddDraftItemInput {
  assessmentId: string
  questionType: QuestionType
  prompt: string
  marks?: number
  orderNum?: number | null
  options?: Json
  acceptedAnswers?: Json
  correctAnswer?: Json
  markingGuide?: Json
  autoMarkingMode?: AutoMarkingMode
  difficulty?: string | null
  bloomLevel?: string | null
  explanation?: string | null
  hint?: string | null
  workedSolution?: string | null
  sourceResourceId?: string | null
  sourceExerciseRef?: Json
  generatedBy?: string
}

export interface ApproveAssessmentResult {
  ok: true
  assessmentId: string
  itemCount: number
  totalMarks: number
}

export interface AssignAssessmentInput {
  assessmentId: string
  classId: string
  targetGroupId?: string | null
  opensAt?: string | null
  closesAt?: string | null
  timeLimitMinutes?: number | null
  maxAttempts?: number
  randomizeItems?: boolean
  randomizeOptions?: boolean
  showScorePolicy?: ScorePolicy
}

export interface LearnerAssessmentItem {
  id: string
  questionType: QuestionType
  prompt: string
  options: Json
  marks: number
  orderNum: number
  media: Json
  hint: string | null
}

export interface SavedAssessmentResponse {
  assessmentItemId: string
  responseValue: Json
  responseText: string | null
  status: string
  lastSavedAt: string
}

export interface AttemptWorkspace {
  ok: true
  attemptId: string
  assessmentId: string
  title: string
  instructions: string | null
  timeLimitMinutes: number | null
  closesAt: string | null
  items: LearnerAssessmentItem[]
  responses: SavedAssessmentResponse[]
}

export interface SaveResponseInput {
  attemptId: string
  assessmentItemId: string
  responseValue?: Json
  responseText?: string | null
}

export interface SaveResponseResult {
  ok: true
  attemptId: string
  assessmentItemId: string
  savedAt: string
}

export interface SubmitAttemptResult {
  ok: true
  attemptId: string
  status: 'auto_marked' | 'teacher_review'
  resultStatus: 'marked' | 'partially_marked'
  score: number
  maxScore: number
  percentage: number
  manualItems: number
}
