export type { ContentEngineClient } from './client'
export { requireContentEngineClient } from './client'

export {
  ContentEngineError,
  assertRequiredId,
  toContentEngineError,
} from './errors'

export type {
  AddResourceToClassLibraryInput,
  AdoptLearningResourceInput,
  Chapter,
  AssignResourceToClassInput,
  ClassResourceLibraryEntry,
  ContentAssignment,
  ContentAssignmentLearner,
  ContentAssignmentType,
  ContentEngineDatabase,
  AssessmentBloomLevel,
  AssessmentBlueprintBundle,
  AssessmentDifficulty,
  AssessmentRubric,
  AssessmentRubricCriterion,
  CompetencyEvidence,
  ContentAssessmentBlueprint,
  ContentAssessmentSource,
  BuildParentLearningSummaryInput,
  ChapterLearningOutcomeLink,
  ContentAssessmentType,
  ContentBlockOutcomeLink,
  ContentEngineDailyMetric,
  ContentMetricFilters,
  CreateAssessmentBlueprintInput,
  CreateGeneratedAssessmentInput,
  ContentSubmissionEvidence,
  CurriculumLearningOutcome,
  CurriculumOutcomeFilters,
  LearningResource,
  OutcomeAlignmentStrength,
  OutcomeBlockRelationship,
  Publication,
  PublicationFilters,
  PublicationStatus,
  ReplaceBlockOutcomeLinksInput,
  ReplaceChapterOutcomeLinksInput,
  ResourceFilters,
  SaveSchemeResourceLinkInput,
  SchemeLessonResourceLink,
  SchemeResourceRole,
  SchoolResourceLibraryEntry,
  RubricWithCriteria,
  GeneratedAssessment,
  GeneratedAssessmentBundle,
  GeneratedAssessmentItem,
  GeneratedAssessmentStatus,
  GeneratedQuestionType,
  ParentLearningSummary,
  ParentLearningSummaryStatus,
  ParentSummaryFilters,
  SaveAssessmentSourceInput,
  SaveCriterionMarkInput,
  SaveGeneratedAssessmentItemInput,
  SaveSubmissionMarkDraftInput,
  StudentOutcomeMastery,
  SubmissionCriterionMark,
  SubmissionEvidenceType,
  SubmissionMark,
  SubmissionMarkWithCriteria,
  SubmitAssignmentEvidenceInput,
  TeacherContentEngineSummary,
  TeacherResourceAdoption,
  UpdateParentLearningSummaryInput,
  UpdateSchemeResourceLinkInput,
} from './types'

export {
  getPublishedChapterById,
  getPublishedPublicationById,
  listPublishedChapters,
  listPublishedPublications,
  publishTextbook,
  unpublishTextbook,
} from './publications'

export {
  getActiveLearningResourceById,
  listActiveLearningResources,
  listChapterResources,
} from './resources'

export {
  listChapterOutcomeLinks,
  listContentBlockOutcomeLinks,
  listVerifiedCurriculumOutcomes,
  replaceBlockOutcomeLinks,
  replaceChapterOutcomeLinks,
  resolveContentBlockId,
} from './outcomes'

export {
  addResourceToClassLibrary,
  adoptLearningResource,
  getCurrentTeacherResourceAdoptions,
  listClassResourceLibrary,
} from './adoption'

export {
  listSchemeResourceLinks,
  removeSchemeResourceLink,
  saveSchemeResourceLink,
  updateSchemeResourceLink,
} from './scheme'

export {
  assignResourceToClass,
  getAssignmentById,
  listAssignmentLearners,
  listClassAssignments,
} from './assignments'

export {
  getSubmissionEvidenceById,
  listAssignmentEvidence,
  submitAssignmentEvidence,
} from './submissions'

export {
  getRubricWithCriteria,
  getSubmissionMark,
  listActiveRubrics,
  releaseSubmissionMark,
  saveCriterionMark,
  saveSubmissionMarkDraft,
  voidSubmissionMark,
} from './marking'

export {
  getStudentOutcomeMastery,
  listStudentCompetencyEvidence,
  listStudentOutcomeMastery,
} from './mastery'

export {
  createAssessmentBlueprint,
  createGeneratedAssessment,
  getAssessmentBlueprintBundle,
  getGeneratedAssessmentBundle,
  removeAssessmentSource,
  removeGeneratedAssessmentItem,
  saveAssessmentSource,
  saveGeneratedAssessmentItem,
  setGeneratedAssessmentStatus,
  updateAssessmentBlueprint,
} from './assessments'

export {
  getCurrentTeacherContentEngineSummary,
  getTeacherContentEngineSummary,
  listContentEngineDailyMetrics,
} from './analytics'

export {
  approveParentLearningSummary,
  buildParentLearningSummary,
  getParentLearningSummaryById,
  listParentLearningSummaries,
  listPublishedParentSummaries,
  publishParentLearningSummary,
  updateParentLearningSummary,
} from './parents'
