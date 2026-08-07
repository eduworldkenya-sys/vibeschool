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

export interface ExamSubjectSignal {
  subjectId: string | null
  subjectName: string
  attempts: number
  averagePercentage: number
  signal: 'needs_attention' | 'developing' | 'strong'
}

export interface ExamRevisionPriority {
  subject: string
  topic: string
  availableQuestions: number
  actionUrl: string
  reason: string
}

export interface ExamReadinessBrief {
  studentId: string
  classId: string | null
  className: string | null
  examName: string
  examDate: string | null
  daysRemaining: number | null
  targetGrade: string | null
  dailyRevisionMinutes: number
  confidenceCheck: number | null
  attemptCount: number
  averagePercentage: number | null
  subjectSignals: ExamSubjectSignal[]
  revisionPriorities: ExamRevisionPriority[]
  psychologyHeadline: string
  comparisonRule: string
  predictionDisclaimer: string
}

export interface RevisionPlanItem {
  id: string
  date: string
  subject: string
  topic: string
  activityType: string
  targetMinutes: number
  priority: number
  reason: string
  actionUrl: string
  status: string
}

export interface MistakeNotebookItem {
  id: string
  questionId: string | null
  sourceBlockId: string | null
  reviewUrl: string | null
  subject: string
  topic: string
  prompt: string
  selectedIndex: number | null
  correctIndex: number | null
  explanation: string | null
  hint: string | null
  repeatCount: number
  status: 'open' | 'practising' | 'resolved'
  lastMissedAt: string | null
}

export interface WeakTopic {
  subject: string
  topic: string
  misses: number
  attempts: number
  accuracy: number
}

export interface LearningJourney {
  practiceAttempts: number
  correctAnswers: number
  openMistakes: number
  resolvedMistakes: number
  booksStarted: number
  chaptersCompleted: number
  learningEvents30d: number
}

export interface TopicResource {
  id: string
  title: string
  description: string | null
  sourceType: string | null
  publicationId: string | null
  chapterId: string | null
}

export interface TopicQuestion {
  id: string
  difficulty: string | null
  question: string
  options: string[]
  hint: string | null
  explanation: string | null
}

export interface TopicWorkspace {
  subject: string
  topic: string
  note: string | null
  resources: TopicResource[]
  questions: TopicQuestion[]
  mistakes: Pick<MistakeNotebookItem, 'id' | 'questionId' | 'sourceBlockId' | 'reviewUrl' | 'prompt' | 'repeatCount' | 'status'>[]
  attempts: number
  accuracy: number | null
}

export interface RevisionWorkspace {
  revisionMode: {
    mode: 'steady_revision' | 'exam_revision' | 'final_sprint'
    daysRemaining: number
    message: string
  }
  todayPlan: RevisionPlanItem[]
  weekPlan: RevisionPlanItem[]
  mistakes: MistakeNotebookItem[]
  weakTopics: WeakTopic[]
  journey: LearningJourney
  topicWorkspace: TopicWorkspace | null
}

export interface GroundedPracticeSource {
  publicationId: string
  publicationTitle: string
  chapterId: string
  chapterTitle: string
  subject: string | null
  grade: string | null
  assessableBlockCount: number
  verifiedOutcomeCount: number
}

export interface GroundedPracticeQuestion {
  id: string
  contentBlockId: string
  publicationId: string
  chapterId: string
  outcomeId: string | null
  prompt: string
  difficulty: string | null
  bloomLevel: string | null
  reviewUrl: string
}

export interface GroundedChapterPractice {
  source: GroundedPracticeSource
  questions: GroundedPracticeQuestion[]
}

type WorkstationRpcClient = {
  rpc(fn: 'student_get_vibelearn_workstation', args?: Record<string, never>): Promise<{ data: unknown; error: { message: string } | null }>
}

type ReadinessRpcClient = {
  rpc(fn: 'student_get_exam_readiness_brief', args?: Record<string, never>): Promise<{ data: unknown; error: { message: string } | null }>
  rpc(fn: 'student_update_exam_readiness', args: { p_exam_date: string | null; p_daily_revision_minutes: number; p_confidence_check: number | null }): Promise<{ data: unknown; error: { message: string } | null }>
}

type RevisionRpcClient = {
  rpc(fn: 'student_get_revision_workspace', args: { p_subject: string | null; p_topic: string | null }): Promise<{ data: unknown; error: { message: string } | null }>
  rpc(fn: 'student_generate_revision_plan', args: { p_start_date: string; p_days: number }): Promise<{ data: unknown; error: { message: string } | null }>
  rpc(fn: 'student_record_vibelearn_practice_answer', args: { p_exam_question_id: string; p_selected_index: number; p_response_ms: number | null; p_session_id: string | null }): Promise<{ data: unknown; error: { message: string } | null }>
  rpc(fn: 'student_resolve_mistake', args: { p_mistake_id: string }): Promise<{ data: unknown; error: { message: string } | null }>
  rpc(fn: 'student_save_topic_note', args: { p_subject: string; p_topic: string; p_note_text: string }): Promise<{ data: unknown; error: { message: string } | null }>
}

type GroundedPracticeRpcClient = {
  rpc(fn: 'student_get_grounded_chapter_practice', args: { p_publication_id: string; p_chapter_id: string; p_limit: number }): Promise<{ data: unknown; error: { message: string } | null }>
  rpc(fn: 'student_record_grounded_practice_answer', args: { p_content_block_id: string; p_response_text: string; p_response_ms: number | null; p_session_id: string | null }): Promise<{ data: unknown; error: { message: string } | null }>
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
}

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null
}

function asNumber(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0
}

function asNullableNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function parsePlanItems(value: unknown): RevisionPlanItem[] {
  return (Array.isArray(value) ? value : []).flatMap(entry => {
    const item = asRecord(entry)
    const id = asString(item.id)
    const date = asString(item.date)
    const subject = asString(item.subject)
    const topic = asString(item.topic)
    const actionUrl = asString(item.action_url)
    if (!id || !date || !subject || !topic || !actionUrl) return []
    return [{
      id,
      date,
      subject,
      topic,
      activityType: asString(item.activity_type) ?? 'practice',
      targetMinutes: asNumber(item.target_minutes),
      priority: asNumber(item.priority),
      reason: asString(item.reason) ?? 'Focused revision',
      actionUrl,
      status: asString(item.status) ?? 'planned',
    }]
  })
}

function parseMistakes(value: unknown): MistakeNotebookItem[] {
  return (Array.isArray(value) ? value : []).flatMap(entry => {
    const item = asRecord(entry)
    const id = asString(item.id)
    const questionId = asString(item.question_id)
    const sourceBlockId = asString(item.source_block_id)
    const subject = asString(item.subject)
    const topic = asString(item.topic)
    const prompt = asString(item.prompt)
    const status = asString(item.status)
    if (!id || (!questionId && !sourceBlockId) || !subject || !topic || !prompt || !['open', 'practising', 'resolved'].includes(status ?? '')) return []
    return [{
      id,
      questionId,
      sourceBlockId,
      reviewUrl: asString(item.review_url),
      subject,
      topic,
      prompt,
      selectedIndex: asNullableNumber(item.selected_index),
      correctIndex: asNullableNumber(item.correct_index),
      explanation: asString(item.explanation),
      hint: asString(item.hint),
      repeatCount: asNumber(item.repeat_count) || 1,
      status: status as MistakeNotebookItem['status'],
      lastMissedAt: asString(item.last_missed_at),
    }]
  })
}

function parseGroundedSource(row: Record<string, unknown>): GroundedPracticeSource | null {
  const publicationId = asString(row.publication_id)
  const chapterId = asString(row.chapter_id)
  if (row.ok !== true || !publicationId || !chapterId) return null
  return {
    publicationId,
    publicationTitle: asString(row.publication_title) ?? 'VibeTextbook',
    chapterId,
    chapterTitle: asString(row.chapter_title) ?? 'Current unit',
    subject: asString(row.subject),
    grade: asString(row.grade),
    assessableBlockCount: asNumber(row.assessable_block_count),
    verifiedOutcomeCount: asNumber(row.verified_outcome_count),
  }
}

export async function getVibeLearnWorkstation(): Promise<VibeLearnWorkstation> {
  const rpcClient = supabase as unknown as WorkstationRpcClient
  const { data, error } = await rpcClient.rpc('student_get_vibelearn_workstation')
  if (error) throw new Error(error.message)
  const row = asRecord(data)
  const policy = asRecord(row.tutor_policy)
  const studentId = asString(row.student_id)
  if (!studentId) throw new Error('Student profile not found.')
  return {
    studentId,
    classId: asString(row.class_id),
    className: asString(row.class_name),
    subjects: (Array.isArray(row.subjects) ? row.subjects : []).flatMap(value => {
      const item = asRecord(value); const id = asString(item.id); const name = asString(item.name)
      return id && name ? [{ id, name, resourceCount: asNumber(item.resource_count) }] : []
    }),
    continueLearning: (Array.isArray(row.continue_learning) ? row.continue_learning : []).flatMap(value => {
      const item = asRecord(value); const publicationId = asString(item.publication_id); const title = asString(item.title); const actionUrl = asString(item.action_url)
      return publicationId && title && actionUrl ? [{ publicationId, chapterId: asString(item.chapter_id), title, chapterTitle: asString(item.chapter_title), progressPercent: asNumber(item.progress_percent), lastReadAt: asString(item.last_read_at), actionUrl }] : []
    }),
    practiceBySubject: (Array.isArray(row.practice_by_subject) ? row.practice_by_subject : []).flatMap(value => {
      const item = asRecord(value); const subject = asString(item.subject); const actionUrl = asString(item.action_url)
      return subject && actionUrl ? [{ subject, questionCount: asNumber(item.question_count), actionUrl }] : []
    }),
    assignedAssessments: (Array.isArray(row.assigned_assessments) ? row.assigned_assessments : []).flatMap(value => {
      const item = asRecord(value); const assignmentId = asString(item.assignment_id); const title = asString(item.title); const actionUrl = asString(item.action_url)
      return assignmentId && title && actionUrl ? [{ assignmentId, title, assessmentType: asString(item.assessment_type) ?? 'assessment', subjectId: asString(item.subject_id), subjectName: asString(item.subject_name), closesAt: asString(item.closes_at), actionUrl }] : []
    }),
    tutorPolicy: {
      defaultMode: 'off',
      allowedActions: Array.isArray(policy.allowed_actions) ? policy.allowed_actions.filter((value): value is string => typeof value === 'string') : [],
      blockedInTimedAssessment: policy.blocked_in_timed_assessment !== false,
      answerRevealRequiresEscalation: policy.answer_reveal_requires_escalation !== false,
      aiShareTargetPercent: asNumber(policy.ai_share_target_percent) || 10,
    },
  }
}

export async function getExamReadinessBrief(): Promise<ExamReadinessBrief> {
  const rpcClient = supabase as unknown as ReadinessRpcClient
  const { data, error } = await rpcClient.rpc('student_get_exam_readiness_brief')
  if (error) throw new Error(error.message)
  const row = asRecord(data)
  const evidence = asRecord(row.evidence)
  const psychology = asRecord(row.psychology)
  const studentId = asString(row.student_id)
  if (!studentId) throw new Error('Student profile not found.')
  return {
    studentId,
    classId: asString(row.class_id),
    className: asString(row.class_name),
    examName: asString(row.exam_name) ?? 'KCSE',
    examDate: asString(row.exam_date),
    daysRemaining: asNullableNumber(row.days_remaining),
    targetGrade: asString(row.target_grade),
    dailyRevisionMinutes: asNumber(row.daily_revision_minutes) || 90,
    confidenceCheck: asNullableNumber(row.confidence_check),
    attemptCount: asNumber(evidence.attempt_count),
    averagePercentage: asNullableNumber(evidence.average_percentage),
    subjectSignals: (Array.isArray(row.subject_signals) ? row.subject_signals : []).flatMap(value => {
      const item = asRecord(value); const subjectName = asString(item.subject_name); const signal = asString(item.signal)
      if (!subjectName || !['needs_attention', 'developing', 'strong'].includes(signal ?? '')) return []
      return [{ subjectId: asString(item.subject_id), subjectName, attempts: asNumber(item.attempts), averagePercentage: asNumber(item.average_percentage), signal: signal as ExamSubjectSignal['signal'] }]
    }),
    revisionPriorities: (Array.isArray(row.revision_priorities) ? row.revision_priorities : []).flatMap(value => {
      const item = asRecord(value); const subject = asString(item.subject); const topic = asString(item.topic); const actionUrl = asString(item.action_url)
      return subject && topic && actionUrl ? [{ subject, topic, availableQuestions: asNumber(item.available_questions), actionUrl, reason: asString(item.reason) ?? 'Exam practice available' }] : []
    }),
    psychologyHeadline: asString(psychology.headline) ?? 'Build confidence through focused daily practice.',
    comparisonRule: asString(psychology.comparison_rule) ?? 'Compete with your previous performance, not public rankings.',
    predictionDisclaimer: asString(psychology.prediction_disclaimer) ?? 'Readiness is not an official KCSE prediction.',
  }
}

export async function updateExamReadiness(input: { examDate: string | null; dailyRevisionMinutes: number; confidenceCheck: number | null }): Promise<void> {
  const rpcClient = supabase as unknown as ReadinessRpcClient
  const { error } = await rpcClient.rpc('student_update_exam_readiness', { p_exam_date: input.examDate, p_daily_revision_minutes: input.dailyRevisionMinutes, p_confidence_check: input.confidenceCheck })
  if (error) throw new Error(error.message)
}

export async function getRevisionWorkspace(subject: string | null = null, topic: string | null = null): Promise<RevisionWorkspace> {
  const rpcClient = supabase as unknown as RevisionRpcClient
  const { data, error } = await rpcClient.rpc('student_get_revision_workspace', { p_subject: subject, p_topic: topic })
  if (error) throw new Error(error.message)
  const row = asRecord(data)
  const mode = asRecord(row.revision_mode)
  const journey = asRecord(row.journey)
  const topicRow = row.topic_workspace ? asRecord(row.topic_workspace) : null
  return {
    revisionMode: {
      mode: (['steady_revision', 'exam_revision', 'final_sprint'].includes(asString(mode.mode) ?? '') ? asString(mode.mode) : 'steady_revision') as RevisionWorkspace['revisionMode']['mode'],
      daysRemaining: asNumber(mode.days_remaining),
      message: asString(mode.message) ?? 'Use focused revision and evidence from your own work.',
    },
    todayPlan: parsePlanItems(row.today_plan),
    weekPlan: parsePlanItems(row.week_plan),
    mistakes: parseMistakes(row.mistakes),
    weakTopics: (Array.isArray(row.weak_topics) ? row.weak_topics : []).flatMap(value => {
      const item = asRecord(value); const subjectName = asString(item.subject); const topicName = asString(item.topic)
      return subjectName && topicName ? [{ subject: subjectName, topic: topicName, misses: asNumber(item.misses), attempts: asNumber(item.attempts), accuracy: asNumber(item.accuracy) }] : []
    }),
    journey: {
      practiceAttempts: asNumber(journey.practice_attempts),
      correctAnswers: asNumber(journey.correct_answers),
      openMistakes: asNumber(journey.open_mistakes),
      resolvedMistakes: asNumber(journey.resolved_mistakes),
      booksStarted: asNumber(journey.books_started),
      chaptersCompleted: asNumber(journey.chapters_completed),
      learningEvents30d: asNumber(journey.learning_events_30d),
    },
    topicWorkspace: topicRow ? {
      subject: asString(topicRow.subject) ?? subject ?? '',
      topic: asString(topicRow.topic) ?? topic ?? '',
      note: asString(topicRow.note),
      resources: (Array.isArray(topicRow.resources) ? topicRow.resources : []).flatMap(value => {
        const item = asRecord(value); const id = asString(item.id); const title = asString(item.title)
        return id && title ? [{ id, title, description: asString(item.description), sourceType: asString(item.source_type), publicationId: asString(item.publication_id), chapterId: asString(item.chapter_id) }] : []
      }),
      questions: (Array.isArray(topicRow.questions) ? topicRow.questions : []).flatMap(value => {
        const item = asRecord(value); const id = asString(item.id); const questionText = asString(item.question); const options = Array.isArray(item.options) ? item.options.filter((entry): entry is string => typeof entry === 'string') : []
        return id && questionText && options.length >= 2 ? [{ id, difficulty: asString(item.difficulty), question: questionText, options, hint: asString(item.hint), explanation: asString(item.explanation) }] : []
      }),
      mistakes: parseMistakes(topicRow.mistakes).map(item => ({ id: item.id, questionId: item.questionId, sourceBlockId: item.sourceBlockId, reviewUrl: item.reviewUrl, prompt: item.prompt, repeatCount: item.repeatCount, status: item.status })),
      attempts: asNumber(asRecord(topicRow.stats).attempts),
      accuracy: asNullableNumber(asRecord(topicRow.stats).accuracy),
    } : null,
  }
}

export async function generateRevisionPlan(startDate: string, days = 7): Promise<void> {
  const rpcClient = supabase as unknown as RevisionRpcClient
  const { error } = await rpcClient.rpc('student_generate_revision_plan', { p_start_date: startDate, p_days: days })
  if (error) throw new Error(error.message)
}

export async function recordPracticeAnswer(input: { questionId: string; selectedIndex: number; responseMs?: number | null; sessionId?: string | null }): Promise<{ correct: boolean; correctIndex: number; explanation: string | null; hint: string | null }> {
  const rpcClient = supabase as unknown as RevisionRpcClient
  const { data, error } = await rpcClient.rpc('student_record_vibelearn_practice_answer', { p_exam_question_id: input.questionId, p_selected_index: input.selectedIndex, p_response_ms: input.responseMs ?? null, p_session_id: input.sessionId ?? null })
  if (error) throw new Error(error.message)
  const row = asRecord(data)
  return { correct: row.correct === true, correctIndex: asNumber(row.correct_index), explanation: asString(row.explanation), hint: asString(row.hint) }
}

export async function getGroundedChapterPractice(input: { publicationId: string; chapterId: string; limit?: number }): Promise<GroundedChapterPractice> {
  const rpcClient = supabase as unknown as GroundedPracticeRpcClient
  const { data, error } = await rpcClient.rpc('student_get_grounded_chapter_practice', {
    p_publication_id: input.publicationId,
    p_chapter_id: input.chapterId,
    p_limit: input.limit ?? 10,
  })
  if (error) throw new Error(error.message)
  const row = asRecord(data)
  const source = parseGroundedSource(row)
  if (!source) throw new Error('This learning source is not available for practice.')
  const questions = (Array.isArray(row.questions) ? row.questions : []).flatMap(value => {
    const item = asRecord(value)
    const id = asString(item.id)
    const contentBlockId = asString(item.content_block_id)
    const publicationId = asString(item.publication_id)
    const chapterId = asString(item.chapter_id)
    const prompt = asString(item.prompt)
    const reviewUrl = asString(item.review_url)
    if (!id || !contentBlockId || !publicationId || !chapterId || !prompt || !reviewUrl) return []
    return [{
      id,
      contentBlockId,
      publicationId,
      chapterId,
      outcomeId: asString(item.outcome_id),
      prompt,
      difficulty: asString(item.difficulty),
      bloomLevel: asString(item.bloom_level),
      reviewUrl,
    }]
  })
  return { source, questions }
}

export async function recordGroundedPracticeAnswer(input: { contentBlockId: string; responseText: string; responseMs?: number | null; sessionId?: string | null }): Promise<{ correct: boolean; expectedAnswer: string | null; reviewUrl: string | null; outcomeId: string | null }> {
  const rpcClient = supabase as unknown as GroundedPracticeRpcClient
  const { data, error } = await rpcClient.rpc('student_record_grounded_practice_answer', {
    p_content_block_id: input.contentBlockId,
    p_response_text: input.responseText,
    p_response_ms: input.responseMs ?? null,
    p_session_id: input.sessionId ?? null,
  })
  if (error) throw new Error(error.message)
  const row = asRecord(data)
  return {
    correct: row.correct === true,
    expectedAnswer: asString(row.expected_answer),
    reviewUrl: asString(row.review_url),
    outcomeId: asString(row.outcome_id),
  }
}

export async function resolveMistake(mistakeId: string): Promise<void> {
  const rpcClient = supabase as unknown as RevisionRpcClient
  const { error } = await rpcClient.rpc('student_resolve_mistake', { p_mistake_id: mistakeId })
  if (error) throw new Error(error.message)
}

export async function saveTopicNote(subject: string, topic: string, noteText: string): Promise<void> {
  const rpcClient = supabase as unknown as RevisionRpcClient
  const { error } = await rpcClient.rpc('student_save_topic_note', { p_subject: subject, p_topic: topic, p_note_text: noteText })
  if (error) throw new Error(error.message)
}
