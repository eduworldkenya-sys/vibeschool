import { supabase } from '@/lib/supabase'

export interface StudentHomeworkAnswerInput {
  questionId: string
  answerText: string
}

export interface StudentHomeworkSubmissionResult {
  submissionId: string
  status: 'draft' | 'received'
  revisionNumber: number
  updatedAt?: string
  submittedAt?: string
  receivedAt?: string
}

function normalizeAnswers(answers: StudentHomeworkAnswerInput[]) {
  return answers.map(answer => ({
    question_id: answer.questionId,
    answer_text: answer.answerText.trim(),
  }))
}

function parseResult(data: unknown): StudentHomeworkSubmissionResult {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new Error('Homework submission returned an invalid result.')
  }

  const raw = data as Record<string, unknown>
  const submissionId = raw.submission_id
  const status = raw.status
  const revisionNumber = raw.revision_number

  if (typeof submissionId !== 'string' || !submissionId) {
    throw new Error('Homework submission identity is missing.')
  }
  if (status !== 'draft' && status !== 'received') {
    throw new Error('Homework submission status is invalid.')
  }
  if (typeof revisionNumber !== 'number' || !Number.isInteger(revisionNumber)) {
    throw new Error('Homework submission revision is invalid.')
  }

  return {
    submissionId,
    status,
    revisionNumber,
    updatedAt: typeof raw.updated_at === 'string' ? raw.updated_at : undefined,
    submittedAt: typeof raw.submitted_at === 'string' ? raw.submitted_at : undefined,
    receivedAt: typeof raw.received_at === 'string' ? raw.received_at : undefined,
  }
}

export async function saveStudentHomeworkDraft(input: {
  homeworkId: string
  answers: StudentHomeworkAnswerInput[]
  photoUrl?: string | null
}): Promise<StudentHomeworkSubmissionResult> {
  const { data, error } = await supabase.rpc('save_student_homework_draft', {
    p_homework_id: input.homeworkId,
    p_answers: normalizeAnswers(input.answers),
    p_photo_url: input.photoUrl ?? null,
  })

  if (error) throw new Error(error.message || 'Could not save homework draft.')
  return parseResult(data)
}

export async function submitStudentHomework(input: {
  homeworkId: string
  answers: StudentHomeworkAnswerInput[]
  photoUrl?: string | null
}): Promise<StudentHomeworkSubmissionResult> {
  const { data, error } = await supabase.rpc('submit_student_homework', {
    p_homework_id: input.homeworkId,
    p_answers: normalizeAnswers(input.answers),
    p_photo_url: input.photoUrl ?? null,
  })

  if (error) throw new Error(error.message || 'Could not submit homework.')
  return parseResult(data)
}
