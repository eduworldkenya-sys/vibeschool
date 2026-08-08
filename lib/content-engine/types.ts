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

export type CurriculumLearningOutcome =
  PublicTables['curriculum_learning_outcomes']['Row']

export type ChapterLearningOutcomeLink =
  PublicTables['chapter_learning_outcome_links']['Row']

export type ContentBlockOutcomeLink =
  PublicTables['content_block_outcome_links']['Row']

export type PublicationStatus = 'draft' | 'published' | 'archived'

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
