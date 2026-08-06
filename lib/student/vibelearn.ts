import { supabase } from '@/lib/supabase'

export interface VibeLearnSubject {
  id: string
  name: string
  resourceCount: number
}

export interface ContinueLearningItem {
  publicationId: string
  chapterId: string | null
  title: string
  chapterTitle: string | null
  progressPercent: number
  lastReadAt: string | null
  actionUrl: string
}

export interface PracticeSubject {
  subject: string
  questionCount: number
  actionUrl: string
}

export interface AssignedAssessment {
  assignmentId: string
  title: string
  assessmentType: string
  subjectId: string | null
  subjectName: string | null
  closesAt: string | null
  actionUrl: string
}

export interface VibeLearnTutorPolicy {
  defaultMode: 'off'
  allowedActions: string[]
  blockedInTimedAssessment: boolean
  answerRevealRequiresEscalation: boolean
  aiShareTargetPercent: number
}

export interface VibeLearnWorkstation {
  studentId: string
  classId: string | null
  className: string | null
  subjects: VibeLearnSubject[]
  continueLearning: ContinueLearningItem[]
  practiceBySubject: PracticeSubject[]
  assignedAssessments: AssignedAssessment[]
  tutorPolicy: VibeLearnTutorPolicy
}

type WorkstationRpcClient = {
  rpc(
    fn: 'student_get_vibelearn_workstation',
    args?: Record<string, never>
  ): Promise<{ data: unknown; error: { message: string } | null }>
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
}

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null
}

function asNumber(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0
}

export async function getVibeLearnWorkstation(): Promise<VibeLearnWorkstation> {
  const rpcClient = supabase as unknown as WorkstationRpcClient
  const { data, error } = await rpcClient.rpc('student_get_vibelearn_workstation')
  if (error) throw new Error(error.message)

  const row = asRecord(data)
  const subjects = Array.isArray(row.subjects) ? row.subjects : []
  const continueLearning = Array.isArray(row.continue_learning) ? row.continue_learning : []
  const practice = Array.isArray(row.practice_by_subject) ? row.practice_by_subject : []
  const assessments = Array.isArray(row.assigned_assessments) ? row.assigned_assessments : []
  const policy = asRecord(row.tutor_policy)

  const studentId = asString(row.student_id)
  if (!studentId) throw new Error('Student profile not found.')

  return {
    studentId,
    classId: asString(row.class_id),
    className: asString(row.class_name),
    subjects: subjects.flatMap(value => {
      const item = asRecord(value)
      const id = asString(item.id)
      const name = asString(item.name)
      return id && name ? [{ id, name, resourceCount: asNumber(item.resource_count) }] : []
    }),
    continueLearning: continueLearning.flatMap(value => {
      const item = asRecord(value)
      const publicationId = asString(item.publication_id)
      const title = asString(item.title)
      const actionUrl = asString(item.action_url)
      return publicationId && title && actionUrl ? [{
        publicationId,
        chapterId: asString(item.chapter_id),
        title,
        chapterTitle: asString(item.chapter_title),
        progressPercent: asNumber(item.progress_percent),
        lastReadAt: asString(item.last_read_at),
        actionUrl,
      }] : []
    }),
    practiceBySubject: practice.flatMap(value => {
      const item = asRecord(value)
      const subject = asString(item.subject)
      const actionUrl = asString(item.action_url)
      return subject && actionUrl ? [{ subject, questionCount: asNumber(item.question_count), actionUrl }] : []
    }),
    assignedAssessments: assessments.flatMap(value => {
      const item = asRecord(value)
      const assignmentId = asString(item.assignment_id)
      const title = asString(item.title)
      const actionUrl = asString(item.action_url)
      return assignmentId && title && actionUrl ? [{
        assignmentId,
        title,
        assessmentType: asString(item.assessment_type) ?? 'assessment',
        subjectId: asString(item.subject_id),
        subjectName: asString(item.subject_name),
        closesAt: asString(item.closes_at),
        actionUrl,
      }] : []
    }),
    tutorPolicy: {
      defaultMode: 'off',
      allowedActions: Array.isArray(policy.allowed_actions)
        ? policy.allowed_actions.filter((value): value is string => typeof value === 'string')
        : [],
      blockedInTimedAssessment: policy.blocked_in_timed_assessment !== false,
      answerRevealRequiresEscalation: policy.answer_reveal_requires_escalation !== false,
      aiShareTargetPercent: asNumber(policy.ai_share_target_percent) || 10,
    },
  }
}
