import type { Database } from '../database.types'

type PublicSchema = Database['public']
type PublicTables = PublicSchema['Tables']
type PublicViews = PublicSchema['Views']

export type ContentEngineDatabase = Database

export type Publication =
  PublicTables['vibe_publications']['Row']

export type Chapter =
  PublicTables['vibe_chapters']['Row']

export type LearningResource =
  PublicTables['learning_resources']['Row']

export type TeacherResourceAdoption =
  PublicTables['teacher_resource_adoptions']['Row']

export type SchoolResourceLibraryEntry =
  PublicTables['school_resource_library']['Row']

export type ClassResourceLibraryEntry =
  PublicTables['class_resource_library']['Row']

export type SchemeLessonResourceLink =
  PublicTables['scheme_lesson_resource_links']['Row']

export type ContentAssignment =
  PublicTables['vibe_chapter_assignments']['Row']

export type ContentAssignmentLearner =
  PublicTables['content_assignment_learners']['Row']

export type ContentSubmissionEvidence =
  PublicTables['content_submission_evidence']['Row']

export type AssessmentRubric =
  PublicTables['assessment_rubrics']['Row']

export type AssessmentRubricCriterion =
  PublicTables['assessment_rubric_criteria']['Row']

export type SubmissionMark =
  PublicTables['submission_marks']['Row']

export type SubmissionCriterionMark =
  PublicTables['submission_criterion_marks']['Row']

export type CompetencyEvidence =
  PublicTables['competency_evidence_ledger']['Row']

export type StudentOutcomeMastery =
  PublicTables['student_outcome_mastery']['Row']

export type ContentAssessmentBlueprint =
  PublicTables['content_assessment_blueprints']['Row']

export type ContentAssessmentSource =
  PublicTables['content_assessment_sources']['Row']

export type GeneratedAssessment =
  PublicTables['generated_assessments']['Row']

export type GeneratedAssessmentItem =
  PublicTables['generated_assessment_items']['Row']

export type ContentEngineDailyMetric =
  PublicTables['content_engine_daily_metrics']['Row']

export type TeacherContentEngineSummary =
  PublicViews['teacher_content_engine_summary']['Row']

export type ParentLearningSummary =
  PublicTables['parent_learning_summaries']['Row']

export type PublicationStatus = 'draft' | 'published' | 'unpublished'

export type ParentLearningSummaryStatus =
  | 'draft'
  | 'approved'
  | 'published'
  | 'archived'

export type ContentAssessmentType =
  | 'quiz'
  | 'exercise'
  | 'homework'
  | 'project'
  | 'cat'
  | 'exam'
  | 'revision'
  | 'remedial'

export type GeneratedAssessmentStatus =
  | 'draft'
  | 'moderation'
  | 'approved'
  | 'published'
  | 'archived'

export type GeneratedQuestionType =
  | 'multiple_choice'
  | 'short_answer'
  | 'structured'
  | 'numerical'
  | 'essay'
  | 'practical'
  | 'project'
  | 'oral'
  | 'observation'

export type AssessmentDifficulty =
  | 'foundation'
  | 'developing'
  | 'proficient'
  | 'advanced'

export type AssessmentBloomLevel =
  | 'remember'
  | 'understand'
  | 'apply'
  | 'analyze'
  | 'evaluate'
  | 'create'

export type SchemeResourceRole =
  | 'primary'
  | 'supplementary'
  | 'teacher_reference'
  | 'learner_reading'
  | 'exercise'
  | 'remedial'
  | 'enrichment'
  | 'project'
  | 'assessment_source'
  | 'before_class'
  | 'in_class'
  | 'after_class'
  | 'homework'

export type ContentAssignmentType =
  | 'reading'
  | 'exercise'
  | 'homework'
  | 'project'
  | 'assessment'
  | 'remedial'
  | 'enrichment'
  | 'revision'

export type SubmissionEvidenceType =
  | 'text'
  | 'image'
  | 'audio'
  | 'video'
  | 'document'
  | 'link'
  | 'reading_progress'

export interface PublicationFilters {
  grade?: string
  subject?: string
  authorId?: string
  limit?: number
}

export interface ResourceFilters {
  publicationId?: string
  chapterId?: string
  subjectId?: string
  grade?: string
  sourceType?: string
  visibility?: string
  limit?: number
}

export interface AdoptLearningResourceInput {
  resourceId: string
  preferredRole?: string
  notes?: string
}

export interface AddResourceToClassLibraryInput {
  resourceId: string
  classId: string
  subjectId?: string
  usageRole?: string
  availableFrom?: string
  availableUntil?: string
  notes?: string
}

export interface SaveSchemeResourceLinkInput {
  schemeLessonId: string
  publicationId: string
  chapterId: string
  resourceId: string
  resourceRole: SchemeResourceRole
  sequence?: number
  pageStart?: number
  pageEnd?: number
  exerciseRefs?: Database['public']['Tables']['scheme_lesson_resource_links']['Insert']['exercise_refs']
}

export interface UpdateSchemeResourceLinkInput {
  resourceRole?: SchemeResourceRole
  sequence?: number
  pageStart?: number | null
  pageEnd?: number | null
  exerciseRefs?: Database['public']['Tables']['scheme_lesson_resource_links']['Update']['exercise_refs']
}

export interface AssignResourceToClassInput {
  resourceId: string
  classId: string
  assignmentType: ContentAssignmentType
  subjectId?: string
  schemeResourceLinkId?: string
  opensAt?: string
  dueAt?: string
  instructions?: string
}

export interface SubmitAssignmentEvidenceInput {
  assignmentId: string
  evidenceType: SubmissionEvidenceType
  textResponse?: string
  fileUrl?: string
  metadata?: Database['public']['Functions']['ce_submit_assignment_evidence']['Args']['p_metadata']
}

export interface RubricWithCriteria {
  rubric: AssessmentRubric
  criteria: AssessmentRubricCriterion[]
}

export interface SaveSubmissionMarkDraftInput {
  evidenceId: string
  rubricId?: string
  score: number
  maxScore: number
  feedback?: string
}

export interface SaveCriterionMarkInput {
  submissionMarkId: string
  criterionId: string
  score: number
  feedback?: string
}

export interface SubmissionMarkWithCriteria {
  mark: SubmissionMark
  criteria: SubmissionCriterionMark[]
}

export interface CreateAssessmentBlueprintInput {
  title: string
  assessmentType: ContentAssessmentType
  totalMarks: number
  classId?: string
  subjectId?: string
  schoolId?: string
  durationMinutes?: number
  difficultyDistribution?: Database['public']['Tables']['content_assessment_blueprints']['Insert']['difficulty_distribution']
  bloomDistribution?: Database['public']['Tables']['content_assessment_blueprints']['Insert']['bloom_distribution']
}

export interface SaveAssessmentSourceInput {
  blueprintId: string
  resourceId: string
  schemeResourceLinkId?: string
  outcomeId?: string
  weight?: number
}

export interface CreateGeneratedAssessmentInput {
  blueprintId: string
  version: number
  totalMarks: number
}

export interface SaveGeneratedAssessmentItemInput {
  assessmentId: string
  sequence: number
  questionType: GeneratedQuestionType
  prompt: string
  marks: number
  sourceResourceId: string
  sourceBlockId?: string
  outcomeId?: string
  options?: Database['public']['Tables']['generated_assessment_items']['Insert']['options']
  answerKey?: Database['public']['Tables']['generated_assessment_items']['Insert']['answer_key']
  difficulty?: AssessmentDifficulty
  bloomLevel?: AssessmentBloomLevel
}

export interface AssessmentBlueprintBundle {
  blueprint: ContentAssessmentBlueprint
  sources: ContentAssessmentSource[]
  assessments: GeneratedAssessment[]
}

export interface GeneratedAssessmentBundle {
  assessment: GeneratedAssessment
  items: GeneratedAssessmentItem[]
}

export interface ContentMetricFilters {
  dateFrom?: string
  dateTo?: string
  teacherId?: string
  classId?: string
  subjectId?: string
  metricKey?: string
  limit?: number
}

export interface BuildParentLearningSummaryInput {
  studentId: string
  periodStart: string
  periodEnd: string
  classId?: string
}

export interface UpdateParentLearningSummaryInput {
  strengths?: string[]
  focusAreas?: string[]
  teacherComment?: string | null
}

export interface ParentSummaryFilters {
  studentId?: string
  classId?: string
  status?: ParentLearningSummaryStatus
  limit?: number
}
