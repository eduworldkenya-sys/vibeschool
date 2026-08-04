import type {
  Lifecycle,
  OccurrenceKey,
  TeachingOccurrence,
} from './types'

export type TeachingWorkspaceStage =
  | 'plan'
  | 'attendance'
  | 'teach'
  | 'evidence'
  | 'homework'
  | 'assessment'
  | 'reflection'
  | 'complete'

export type WorkspaceStageState =
  | 'done'
  | 'current'
  | 'available'
  | 'blocked'
  | 'unavailable'

export type WorkspacePrimaryAction =
  | 'prepare_lesson'
  | 'start_lesson'
  | 'continue_lesson'
  | 'review_lesson'
  | 'recover_lesson'
  | 'none'

export interface TeachingWorkspaceStageView {
  stage: TeachingWorkspaceStage
  state: WorkspaceStageState
  reason: string | null
}

export interface TeachingWorkspace {
  key: OccurrenceKey
  occurrenceId: string | null

  lifecycle: Lifecycle

  classId: string
  subjectId: string
  lessonPlanId: string | null

  primaryAction: WorkspacePrimaryAction

  canStart: boolean
  canComplete: boolean
  canRecover: boolean
  canCaptureAttendance: boolean
  canCaptureEvidence: boolean
  canAssignHomework: boolean
  canCaptureAssessment: boolean
  canWriteReflection: boolean

  attendanceComplete: boolean
  evidenceCaptured: boolean
  homeworkIssued: boolean
  assessmentCaptured: boolean
  reflectionCompleted: boolean

  stages: TeachingWorkspaceStageView[]

  completedStages: number
  totalStages: number
  completionPercent: number
}

function stage(
  name: TeachingWorkspaceStage,
  state: WorkspaceStageState,
  reason: string | null = null,
): TeachingWorkspaceStageView {
  return {
    stage: name,
    state,
    reason,
  }
}

function assertNever(value: never): never {
  throw new Error(
    `Unhandled teaching lifecycle: ${String(value)}`,
  )
}

function derivePrimaryAction(
  occurrence: TeachingOccurrence,
): WorkspacePrimaryAction {
  switch (occurrence.lifecycle) {
    case 'planned':
      return 'prepare_lesson'

    case 'ready':
      return 'start_lesson'

    case 'in_progress':
      return 'continue_lesson'

    case 'completed':
      return 'review_lesson'

    case 'missed':
      return occurrence.lessonPlanId
        ? 'start_lesson'
        : 'prepare_lesson'

    case 'cancelled':
    case 'rescheduled':
      return 'none'

    default:
      return assertNever(occurrence.lifecycle)
  }
}

function planStage(
  occurrence: TeachingOccurrence,
): TeachingWorkspaceStageView {
  if (occurrence.lessonPlanId) {
    return stage('plan', 'done')
  }

  if (
    occurrence.lifecycle === 'cancelled' ||
    occurrence.lifecycle === 'rescheduled'
  ) {
    return stage(
      'plan',
      'unavailable',
      'This occurrence is no longer active.',
    )
  }

  return stage(
    'plan',
    'current',
    'A lesson plan is required before teaching starts.',
  )
}

function attendanceStage(
  occurrence: TeachingOccurrence,
): TeachingWorkspaceStageView {
  if (occurrence.attendance.state === 'complete') {
    return stage('attendance', 'done')
  }

  if (!occurrence.lessonPlanId) {
    return stage(
      'attendance',
      'blocked',
      'Prepare the lesson before recording lesson attendance.',
    )
  }

  if (
    occurrence.lifecycle === 'cancelled' ||
    occurrence.lifecycle === 'rescheduled'
  ) {
    return stage(
      'attendance',
      'unavailable',
      'Attendance is unavailable for an inactive occurrence.',
    )
  }

  if (occurrence.lifecycle === 'planned') {
    return stage(
      'attendance',
      'available',
      'Attendance becomes part of the active teaching occurrence.',
    )
  }

  return stage('attendance', 'current')
}

function teachStage(
  occurrence: TeachingOccurrence,
): TeachingWorkspaceStageView {
  if (occurrence.lifecycle === 'completed') {
    return stage('teach', 'done')
  }

  if (occurrence.lifecycle === 'in_progress') {
    return stage('teach', 'current')
  }

  if (
    occurrence.lifecycle === 'cancelled' ||
    occurrence.lifecycle === 'rescheduled'
  ) {
    return stage(
      'teach',
      'unavailable',
      'This occurrence cannot be taught.',
    )
  }

  if (!occurrence.lessonPlanId) {
    return stage(
      'teach',
      'blocked',
      'A lesson plan is required before teaching starts.',
    )
  }

  if (
    occurrence.lifecycle === 'ready' ||
    occurrence.lifecycle === 'missed'
  ) {
    return stage('teach', 'available')
  }

  return stage(
    'teach',
    'blocked',
    'The lesson is not ready to start.',
  )
}

function evidenceStage(
  occurrence: TeachingOccurrence,
): TeachingWorkspaceStageView {
  if (occurrence.evidence.count > 0) {
    return stage('evidence', 'done')
  }

  if (
    occurrence.lifecycle === 'in_progress' ||
    occurrence.lifecycle === 'completed'
  ) {
    return stage('evidence', 'available')
  }

  return stage(
    'evidence',
    'blocked',
    'Start the lesson before capturing teaching evidence.',
  )
}

function homeworkStage(
  occurrence: TeachingOccurrence,
): TeachingWorkspaceStageView {
  if (occurrence.homework.issued) {
    return stage('homework', 'done')
  }

  if (
    occurrence.lifecycle === 'in_progress' ||
    occurrence.lifecycle === 'completed'
  ) {
    return stage('homework', 'available')
  }

  return stage(
    'homework',
    'blocked',
    'Start the lesson before assigning linked homework.',
  )
}

function assessmentStage(
  occurrence: TeachingOccurrence,
): TeachingWorkspaceStageView {
  if (occurrence.assessment.count > 0) {
    return stage('assessment', 'done')
  }

  if (
    occurrence.lifecycle === 'cancelled' ||
    occurrence.lifecycle === 'rescheduled'
  ) {
    return stage(
      'assessment',
      'unavailable',
      'Assessment is unavailable for an inactive occurrence.',
    )
  }

  if (
    occurrence.lifecycle === 'in_progress' ||
    occurrence.lifecycle === 'completed'
  ) {
    return stage(
      'assessment',
      'available',
      occurrence.lifecycle === 'in_progress'
        ? 'Formative assessment can be recorded during teaching.'
        : 'Assessment evidence can still be recorded after teaching.',
    )
  }

  return stage(
    'assessment',
    'blocked',
    'Start the lesson before recording assessment evidence.',
  )
}

function reflectionStage(
  occurrence: TeachingOccurrence,
): TeachingWorkspaceStageView {
  if (occurrence.reflection.completed) {
    return stage('reflection', 'done')
  }

  if (occurrence.lifecycle === 'completed') {
    return stage('reflection', 'current')
  }

  return stage(
    'reflection',
    'blocked',
    'Complete the lesson before writing the final reflection.',
  )
}

function completeStage(
  occurrence: TeachingOccurrence,
): TeachingWorkspaceStageView {
  if (occurrence.lifecycle === 'completed') {
    return stage('complete', 'done')
  }

  if (occurrence.lifecycle === 'in_progress') {
    return stage('complete', 'available')
  }

  if (
    occurrence.lifecycle === 'cancelled' ||
    occurrence.lifecycle === 'rescheduled'
  ) {
    return stage(
      'complete',
      'unavailable',
      'An inactive occurrence cannot be completed.',
    )
  }

  return stage(
    'complete',
    'blocked',
    'Start the lesson before marking it complete.',
  )
}

/**
 * Converts the authoritative TeachingOccurrence domain object into one
 * presentation-safe Teaching Workspace contract.
 *
 * This function is pure:
 * - no Supabase calls;
 * - no routing;
 * - no React state;
 * - no mutations.
 *
 * UI surfaces may render this result, but must not recreate these rules.
 */
export function deriveTeachingWorkspace(
  occurrence: TeachingOccurrence,
  occurrenceId: string | null = null,
): TeachingWorkspace {
  const stages: TeachingWorkspaceStageView[] = [
    planStage(occurrence),
    attendanceStage(occurrence),
    teachStage(occurrence),
    evidenceStage(occurrence),
    homeworkStage(occurrence),
    assessmentStage(occurrence),
    reflectionStage(occurrence),
    completeStage(occurrence),
  ]

  const completedStages = stages.filter(
    item => item.state === 'done',
  ).length

  const totalStages = stages.length

  const lifecycleActive =
    occurrence.lifecycle !== 'cancelled' &&
    occurrence.lifecycle !== 'rescheduled'

  return {
    key: occurrence.key,
    occurrenceId,

    lifecycle: occurrence.lifecycle,

    classId: occurrence.classId,
    subjectId: occurrence.subjectId,
    lessonPlanId: occurrence.lessonPlanId,

    primaryAction: derivePrimaryAction(occurrence),

    canStart:
      lifecycleActive &&
      Boolean(occurrence.lessonPlanId) &&
      (
        occurrence.lifecycle === 'ready' ||
        occurrence.lifecycle === 'missed'
      ),

    canComplete:
      occurrence.lifecycle === 'in_progress',

    canRecover:
      occurrence.lifecycle === 'missed',

    canCaptureAttendance:
      lifecycleActive &&
      Boolean(occurrence.lessonPlanId),

    canCaptureEvidence:
      occurrence.lifecycle === 'in_progress' ||
      occurrence.lifecycle === 'completed',

    canAssignHomework:
      occurrence.lifecycle === 'in_progress' ||
      occurrence.lifecycle === 'completed',

    canCaptureAssessment:
      occurrence.lifecycle === 'in_progress' ||
      occurrence.lifecycle === 'completed',

    canWriteReflection:
      occurrence.lifecycle === 'completed' &&
      Boolean(occurrence.lessonPlanId),

    attendanceComplete:
      occurrence.attendance.state === 'complete',

    evidenceCaptured:
      occurrence.evidence.count > 0,

    homeworkIssued:
      occurrence.homework.issued,

    assessmentCaptured:
      occurrence.assessment.count > 0,

    reflectionCompleted:
      occurrence.reflection.completed,

    stages,

    completedStages,
    totalStages,
    completionPercent:
      totalStages === 0
        ? 0
        : Math.round(
            (completedStages / totalStages) * 100,
          ),
  }
}
