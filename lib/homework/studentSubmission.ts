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

type RpcClient = {
  rpc: (
    fn: string,
    args: Record<string, unknown>,
  ) => Promise<{ data: unknown; error: { message?: string } | null }>
}

async function syncExecutionReceipt(client: RpcClient, homeworkId: string): Promise<void> {
  const { error } = await client.rpc('student_sync_task_execution_receipt', {
    p_task_id: `homework:${homeworkId}`,
  })
  if (error) {
    throw new Error(error.message || 'Homework progress could not be synchronized.')
  }
}

async function callSubmissionRpc(
  name: 'save_student_homework_draft' | 'submit_student_homework',
  input: {
    homeworkId: string
    answers: StudentHomeworkAnswerInput[]
    photoUrl?: string | null
  },
): Promise<StudentHomeworkSubmissionResult> {
  // Submission and task execution authority land in additive migrations. This
  // narrow cast avoids coupling the client to generated RPC types between
  // schema regeneration cycles.
  const client = supabase as unknown as RpcClient

  const { data, error } = await client.rpc(name, {
    p_homework_id: input.homeworkId,
    p_answers: normalizeAnswers(input.answers),
    p_photo_url: input.photoUrl ?? null,
  })

  if (error) {
    throw new Error(
      error.message ||
        (name === 'save_student_homework_draft'
          ? 'Could not save homework draft.'
          : 'Could not submit homework.'),
    )
  }

  const result = parseResult(data)
  await syncExecutionReceipt(client, input.homeworkId)
  return result
}

export function saveStudentHomeworkDraft(input: {
  homeworkId: string
  answers: StudentHomeworkAnswerInput[]
  photoUrl?: string | null
}): Promise<StudentHomeworkSubmissionResult> {
  return callSubmissionRpc('save_student_homework_draft', input)
}

export function submitStudentHomework(input: {
  homeworkId: string
  answers: StudentHomeworkAnswerInput[]
  photoUrl?: string | null
}): Promise<StudentHomeworkSubmissionResult> {
  return callSubmissionRpc('submit_student_homework', input)
}
