import { supabase } from '@/lib/supabase'
import type { Json } from '@/lib/database.types'

type RpcResult<T> = { data: T | null; error: { message?: string } | null }
type Rpc = <T>(name: string, args?: Record<string, unknown>) => PromiseLike<RpcResult<T>>
const rpc = supabase.rpc.bind(supabase) as unknown as Rpc

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Tasks returned an invalid payload.')
  return value as Record<string, unknown>
}
function text(value: unknown): string | null { return typeof value === 'string' ? value : null }
function numberOrNull(value: unknown): number | null {
  if (value === null || value === undefined) return null
  const result = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(result) ? result : null
}

export type StudentTaskStatus = 'upcoming' | 'ready' | 'in_progress' | 'awaiting_marking' | 'returned' | 'released' | 'overdue' | 'closed'
export type StudentTaskType = 'homework' | 'exercise' | 'quiz' | 'cat' | 'exam' | 'project' | 'remedial' | string
export type StudentRecommendationType = 'revise' | 'practice' | 'learn_next' | 'intervention' | 'teacher_priority'

export interface StudentTask {
  taskId: string
  taskType: StudentTaskType
  sourceId: string
  title: string
  subject: string
  classId: string | null
  assignedAt: string | null
  opensAt: string | null
  dueAt: string | null
  status: StudentTaskStatus
  priority: 'urgent' | 'high' | 'normal'
  progress: number
  actionUrl: string
  actionLabel: string
  score: number | null
  maxScore: number | null
  feedback: string | null
}
export interface StudentTaskLaunch {
  studentId: string
  taskId: string
  taskType: StudentTaskType
  sourceId: string
  title: string
  subject: string
  status: StudentTaskStatus
  actionUrl: string
  actionLabel: string
  progress: number
  resolvedAt: string
}
export interface StudentTaskCounts { toDo: number; inProgress: number; submitted: number; results: number; upcoming: number; overdue: number }
export interface StudentTaskFeed { studentId: string; tasks: StudentTask[]; counts: StudentTaskCounts }
export interface StudentAchievement { slug: string; title: string; description: string; icon: string; awardedAt: string | null }
export interface StudentSubjectProgress { subjectId: string; subjectName: string; completedTasks: number; totalTasks: number; averageScore: number | null; masteryPercentage: number | null }
export interface StudentMotivationSummary {
  studentId: string
  dailyGoal: { date: string | null; target: number; completed: number; complete: boolean }
  streak: { current: number; longest: number; graceTokens: number }
  totalXp: number
  achievements: StudentAchievement[]
  subjectProgress: StudentSubjectProgress[]
  nextMission: StudentTask | null
  awarded?: boolean
  xpAwarded?: number
}
export interface StudentLearningRecommendation {
  id: string
  subjectId: string | null
  outcomeId: string | null
  type: StudentRecommendationType
  title: string
  reason: string
  confidence: number
  priority: number
  nextReviewAt: string | null
}
export interface StudentTimelineEvent {
  id: string
  eventType: string
  sourceType: string
  sourceId: string | null
  subjectId: string | null
  title: string
  summary: string | null
  occurredAt: string
  metadata: Json
}
export interface StudentPersonalizedPath {
  studentId: string
  recommendations: StudentLearningRecommendation[]
  timeline: StudentTimelineEvent[]
  nextMission: StudentTask | null
  motivation: StudentMotivationSummary
}
export interface StudentHomeChange {
  id: string
  kind: 'result' | 'feedback' | 'completion' | 'update' | string
  title: string
  summary: string
  occurredAt: string
  sourceType: string
  sourceId: string | null
}
export interface StudentHomeUrgency {
  level: 'urgent' | 'attention' | 'clear'
  headline: string
  message: string
}
export interface StudentHomeOsBrief {
  studentId: string
  generatedAt: string
  nextAction: StudentTask | null
  urgency: StudentHomeUrgency
  taskFeed: StudentTaskFeed
  recentChanges: StudentHomeChange[]
  progress: {
    dailyGoal: StudentMotivationSummary['dailyGoal']
    streak: StudentMotivationSummary['streak']
    totalXp: number
    subjectProgress: StudentSubjectProgress[]
    recommendations: StudentLearningRecommendation[]
  }
}

function parseTask(value: unknown): StudentTask {
  const item = record(value)
  return {
    taskId: text(item.task_id) ?? '', taskType: text(item.task_type) ?? 'task', sourceId: text(item.source_id) ?? '',
    title: text(item.title) ?? 'Task', subject: text(item.subject) ?? 'General', classId: text(item.class_id),
    assignedAt: text(item.assigned_at), opensAt: text(item.opens_at), dueAt: text(item.due_at),
    status: (text(item.status) ?? 'ready') as StudentTaskStatus,
    priority: (text(item.priority) ?? 'normal') as StudentTask['priority'], progress: numberOrNull(item.progress) ?? 0,
    actionUrl: text(item.action_url) ?? '/student/tasks', actionLabel: text(item.action_label) ?? 'Open task',
    score: numberOrNull(item.score), maxScore: numberOrNull(item.max_score), feedback: text(item.feedback),
  }
}
function parseTaskFeed(value: unknown): StudentTaskFeed {
  const payload = record(value); const counts = record(payload.counts ?? {}); const tasks = Array.isArray(payload.tasks) ? payload.tasks : []
  return {
    studentId: text(payload.student_id) ?? '',
    counts: { toDo: numberOrNull(counts.to_do) ?? 0, inProgress: numberOrNull(counts.in_progress) ?? 0, submitted: numberOrNull(counts.submitted) ?? 0, results: numberOrNull(counts.results) ?? 0, upcoming: numberOrNull(counts.upcoming) ?? 0, overdue: numberOrNull(counts.overdue) ?? 0 },
    tasks: tasks.map(parseTask),
  }
}
function parseRecommendations(value: unknown): StudentLearningRecommendation[] {
  const recommendations = Array.isArray(value) ? value : []
  return recommendations.map(item => {
    const row = record(item)
    return { id: text(row.id) ?? '', subjectId: text(row.subject_id), outcomeId: text(row.outcome_id), type: (text(row.type) ?? 'practice') as StudentRecommendationType, title: text(row.title) ?? 'Learning recommendation', reason: text(row.reason) ?? '', confidence: numberOrNull(row.confidence) ?? 0, priority: numberOrNull(row.priority) ?? 0, nextReviewAt: text(row.next_review_at) }
  })
}
function parseSubjectProgress(value: unknown): StudentSubjectProgress[] {
  const subjects = Array.isArray(value) ? value : []
  return subjects.map(item => { const row = record(item); return { subjectId: text(row.subject_id) ?? '', subjectName: text(row.subject_name) ?? 'Subject', completedTasks: numberOrNull(row.completed_tasks) ?? 0, totalTasks: numberOrNull(row.total_tasks) ?? 0, averageScore: numberOrNull(row.average_score), masteryPercentage: numberOrNull(row.mastery_percentage) } })
}

export async function listMyTasks(): Promise<StudentTaskFeed> {
  const { data, error } = await rpc<Json>('student_list_my_tasks')
  if (error) throw new Error(error.message || 'Tasks could not be loaded.')
  return parseTaskFeed(data)
}

export async function resolveTaskLaunch(taskId: string): Promise<StudentTaskLaunch> {
  const { data, error } = await rpc<Json>('student_resolve_task_launch', { p_task_id: taskId })
  if (error) throw new Error(error.message || 'Task could not be opened.')
  const payload = record(data)
  return {
    studentId: text(payload.student_id) ?? '',
    taskId: text(payload.task_id) ?? taskId,
    taskType: text(payload.task_type) ?? 'task',
    sourceId: text(payload.source_id) ?? '',
    title: text(payload.title) ?? 'Task',
    subject: text(payload.subject) ?? 'General',
    status: (text(payload.status) ?? 'ready') as StudentTaskStatus,
    actionUrl: text(payload.action_url) ?? '/student/tasks',
    actionLabel: text(payload.action_label) ?? 'Open task',
    progress: numberOrNull(payload.progress) ?? 0,
    resolvedAt: text(payload.resolved_at) ?? new Date().toISOString(),
  }
}

export async function getMotivationSummary(): Promise<StudentMotivationSummary> {
  const { data, error } = await rpc<Json>('student_refresh_motivation_summary')
  if (error) throw new Error(error.message || 'Learning progress could not be loaded.')
  return parseMotivationSummary(data)
}
export async function getPersonalizedLearningPath(): Promise<StudentPersonalizedPath> {
  const { data, error } = await rpc<Json>('student_refresh_personalized_path')
  if (error) throw new Error(error.message || 'Personal learning path could not be loaded.')
  const payload = record(data)
  const timeline = Array.isArray(payload.timeline) ? payload.timeline : []
  return {
    studentId: text(payload.student_id) ?? '',
    recommendations: parseRecommendations(payload.recommendations),
    timeline: timeline.map(item => {
      const row = record(item)
      return { id: text(row.id) ?? '', eventType: text(row.event_type) ?? 'learning_event', sourceType: text(row.source_type) ?? 'learning', sourceId: text(row.source_id), subjectId: text(row.subject_id), title: text(row.title) ?? 'Learning event', summary: text(row.summary), occurredAt: text(row.occurred_at) ?? '', metadata: (row.metadata ?? {}) as Json }
    }),
    nextMission: payload.next_mission && typeof payload.next_mission === 'object' ? parseTask(payload.next_mission) : null,
    motivation: parseMotivationSummary(payload.motivation),
  }
}
export async function getStudentHomeOsBrief(): Promise<StudentHomeOsBrief> {
  const { data, error } = await rpc<Json>('student_get_home_os_brief')
  if (error) throw new Error(error.message || 'Your learner home could not be loaded.')
  const payload = record(data); const urgency = record(payload.urgency ?? {}); const progress = record(payload.progress ?? {}); const goal = record(progress.daily_goal ?? {}); const streak = record(progress.streak ?? {})
  const changes = Array.isArray(payload.recent_changes) ? payload.recent_changes : []
  return {
    studentId: text(payload.student_id) ?? '',
    generatedAt: text(payload.generated_at) ?? new Date().toISOString(),
    nextAction: payload.next_action && typeof payload.next_action === 'object' ? parseTask(payload.next_action) : null,
    urgency: { level: (text(urgency.level) ?? 'clear') as StudentHomeUrgency['level'], headline: text(urgency.headline) ?? 'You are on track', message: text(urgency.message) ?? '' },
    taskFeed: parseTaskFeed(payload.task_feed),
    recentChanges: changes.map(item => { const row = record(item); return { id: text(row.id) ?? '', kind: text(row.kind) ?? 'update', title: text(row.title) ?? 'Learning update', summary: text(row.summary) ?? '', occurredAt: text(row.occurred_at) ?? '', sourceType: text(row.source_type) ?? 'learning', sourceId: text(row.source_id) } }),
    progress: {
      dailyGoal: { date: text(goal.date), target: numberOrNull(goal.target) ?? 1, completed: numberOrNull(goal.completed) ?? 0, complete: Boolean(goal.complete) },
      streak: { current: numberOrNull(streak.current) ?? 0, longest: numberOrNull(streak.longest) ?? 0, graceTokens: numberOrNull(streak.grace_tokens) ?? 0 },
      totalXp: numberOrNull(progress.total_xp) ?? 0,
      subjectProgress: parseSubjectProgress(progress.subject_progress),
      recommendations: parseRecommendations(progress.recommendations),
    },
  }
}
export async function recordVerifiedTaskCompletion(input: { sourceType: string; sourceId: string; subjectId?: string | null }): Promise<StudentMotivationSummary> {
  const { data, error } = await rpc<Json>('student_record_verified_task_completion', { p_source_type: input.sourceType, p_source_id: input.sourceId, p_subject_id: input.subjectId ?? null })
  if (error) throw new Error(error.message || 'Task completion could not be verified.')
  return parseMotivationSummary(data)
}
function parseMotivationSummary(value: unknown): StudentMotivationSummary {
  const payload = record(value); const goal = record(payload.daily_goal ?? {}); const streak = record(payload.streak ?? {})
  const achievements = Array.isArray(payload.achievements) ? payload.achievements : []
  return {
    studentId: text(payload.student_id) ?? '',
    dailyGoal: { date: text(goal.date), target: numberOrNull(goal.target) ?? 1, completed: numberOrNull(goal.completed) ?? 0, complete: Boolean(goal.complete) },
    streak: { current: numberOrNull(streak.current) ?? 0, longest: numberOrNull(streak.longest) ?? 0, graceTokens: numberOrNull(streak.grace_tokens) ?? 0 },
    totalXp: numberOrNull(payload.total_xp) ?? 0,
    achievements: achievements.map(item => { const row = record(item); return { slug: text(row.slug) ?? '', title: text(row.title) ?? 'Achievement', description: text(row.description) ?? '', icon: text(row.icon) ?? '🏅', awardedAt: text(row.awarded_at) } }),
    subjectProgress: parseSubjectProgress(payload.subject_progress),
    nextMission: payload.next_mission && typeof payload.next_mission === 'object' ? parseTask(payload.next_mission) : null,
    awarded: typeof payload.awarded === 'boolean' ? payload.awarded : undefined,
    xpAwarded: numberOrNull(payload.xp_awarded) ?? undefined,
  }
}
