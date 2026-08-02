import type { ContentEngineClient } from './client'
import {
  assertRequiredId,
  toContentEngineError,
} from './errors'
import type {
  ContentSubmissionEvidence,
  SubmitAssignmentEvidenceInput,
} from './types'

export async function submitAssignmentEvidence(
  client: ContentEngineClient,
  input: SubmitAssignmentEvidenceInput,
): Promise<string> {
  const operation = 'submitAssignmentEvidence'
  const assignmentId = assertRequiredId(
    input.assignmentId,
    'assignmentId',
    operation,
  )

  const textResponse = input.textResponse?.trim() || undefined
  const fileUrl = input.fileUrl?.trim() || undefined

  if (
    input.evidenceType !== 'reading_progress' &&
    !textResponse &&
    !fileUrl &&
    input.metadata === undefined
  ) {
    throw toContentEngineError(
      operation,
      new Error(
        'Submission evidence requires text, a file URL, or metadata.',
      ),
    )
  }

  const { data, error } = await client.rpc(
    'ce_submit_assignment_evidence',
    {
      p_assignment_id: assignmentId,
      p_evidence_type: input.evidenceType,
      p_text_response: textResponse,
      p_file_url: fileUrl,
      p_metadata: input.metadata ?? {},
    },
  )

  if (error) {
    throw toContentEngineError(operation, error)
  }

  return assertRequiredId(data, 'evidenceId', operation)
}

export async function listAssignmentEvidence(
  client: ContentEngineClient,
  assignmentLearnerId: string,
): Promise<ContentSubmissionEvidence[]> {
  const operation = 'listAssignmentEvidence'
  const id = assertRequiredId(
    assignmentLearnerId,
    'assignmentLearnerId',
    operation,
  )

  const { data, error } = await client
    .from('content_submission_evidence')
    .select('*')
    .eq('assignment_learner_id', id)
    .order('submitted_at', { ascending: false })

  if (error) {
    throw toContentEngineError(operation, error)
  }

  return data
}

export async function getSubmissionEvidenceById(
  client: ContentEngineClient,
  evidenceId: string,
): Promise<ContentSubmissionEvidence | null> {
  const operation = 'getSubmissionEvidenceById'
  const id = assertRequiredId(
    evidenceId,
    'evidenceId',
    operation,
  )

  const { data, error } = await client
    .from('content_submission_evidence')
    .select('*')
    .eq('id', id)
    .maybeSingle()

  if (error) {
    throw toContentEngineError(operation, error)
  }

  return data
}
