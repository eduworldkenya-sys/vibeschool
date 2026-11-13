'use client'

// Shared public Learn and student integrations reuse the canonical student
// feedback engine. This is an import facade, not another sound implementation.
export { LearningFeedbackProvider, useLearningFeedback, FeedbackSoundToggle } from '@/components/student/LearningFeedback'
export type { LearningFeedbackKind } from '@/components/student/LearningFeedback'
