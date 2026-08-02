import type { ContentEngineClient } from './client'
import {
  assertRequiredId,
  toContentEngineError,
} from './errors'
import type {
  AssessmentRubric,
  AssessmentRubricCriterion,
  RubricWithCriteria,
  SaveCriterionMarkInput,
  SaveSubmissionMarkDraftInput,
  SubmissionCriterionMark,
  SubmissionMark,
  SubmissionMarkWithCriteria,
} from './types'

function assertNonNegativeScore(
  value: number,
  fieldName: string,
  operation: string,
): number {
  if (!Number.isFinite(value) || value < 0) {
    throw toContentEngineError(
      operation,
      new Error(`${fieldName} must be zero or greater.`),
    )
  }

  return value
}

function assertPositiveScore(
  value: number,
  fieldName: string,
  operation: string,
): number {
  if (!Number.isFinite(value) || value <= 0) {
    throw toContentEngineError(
      operation,
      new Error(`${fieldName} must be greater than zero.`),
    )
  }

  return value
}

export async function listActiveRubrics(
  client: ContentEngineClient,
): Promise<AssessmentRubric[]> {
  const operation = 'listActiveRubrics'

  const { data, error } = await client
    .from('assessment_rubrics')
    .select('*')
    .eq('status', 'active')
    .order('updated_at', { ascending: false })

  if (error) {
    throw toContentEngineError(operation, error)
  }

  return data
}

export async function getRubricWithCriteria(
  client: ContentEngineClient,
  rubricId: string,
): Promise<RubricWithCriteria | null> {
  const operation = 'getRubricWithCriteria'
  const id = assertRequiredId(rubricId, 'rubricId', operation)

  const [
    { data: rubric, error: rubricError },
    { data: criteria, error: criteriaError },
  ] = await Promise.all([
    client
      .from('assessment_rubrics')
      .select('*')
      .eq('id', id)
      .maybeSingle(),
    client
      .from('assessment_rubric_criteria')
      .select('*')
      .eq('rubric_id', id)
      .order('sequence', { ascending: true }),
  ])

  if (rubricError) {
    throw toContentEngineError(operation, rubricError)
  }

  if (criteriaError) {
    throw toContentEngineError(operation, criteriaError)
  }

  if (!rubric) {
    return null
  }

  return {
    rubric,
    criteria,
  }
}

export async function getSubmissionMark(
  client: ContentEngineClient,
  evidenceId: string,
): Promise<SubmissionMarkWithCriteria | null> {
  const operation = 'getSubmissionMark'
  const id = assertRequiredId(evidenceId, 'evidenceId', operation)

  const { data: mark, error: markError } = await client
    .from('submission_marks')
    .select('*')
    .eq('evidence_id', id)
    .maybeSingle()

  if (markError) {
    throw toContentEngineError(operation, markError)
  }

  if (!mark) {
    return null
  }

  const { data: criteria, error: criteriaError } = await client
    .from('submission_criterion_marks')
    .select('*')
    .eq('submission_mark_id', mark.id)

  if (criteriaError) {
    throw toContentEngineError(operation, criteriaError)
  }

  return {
    mark,
    criteria,
  }
}

export async function saveSubmissionMarkDraft(
  client: ContentEngineClient,
  input: SaveSubmissionMarkDraftInput,
): Promise<SubmissionMark> {
  const operation = 'saveSubmissionMarkDraft'
  const evidenceId = assertRequiredId(
    input.evidenceId,
    'evidenceId',
    operation,
  )

  const score = assertNonNegativeScore(
    input.score,
    'score',
    operation,
  )

  const maxScore = assertPositiveScore(
    input.maxScore,
    'maxScore',
    operation,
  )

  if (score > maxScore) {
    throw toContentEngineError(
      operation,
      new Error('score cannot exceed maxScore.'),
    )
  }

  const {
    data: { user },
    error: userError,
  } = await client.auth.getUser()

  if (userError) {
    throw toContentEngineError(operation, userError)
  }

  if (!user) {
    throw toContentEngineError(
      operation,
      new Error('An authenticated marker is required.'),
    )
  }

  const { data, error } = await client
    .from('submission_marks')
    .upsert(
      {
        evidence_id: evidenceId,
        rubric_id: input.rubricId?.trim() || null,
        marker_id: user.id,
        score,
        max_score: maxScore,
        feedback: input.feedback?.trim() || null,
        status: 'draft',
        marked_at: null,
      },
      {
        onConflict: 'evidence_id',
      },
    )
    .select('*')
    .single()

  if (error) {
    throw toContentEngineError(operation, error)
  }

  return data
}

export async function saveCriterionMark(
  client: ContentEngineClient,
  input: SaveCriterionMarkInput,
): Promise<SubmissionCriterionMark> {
  const operation = 'saveCriterionMark'
  const submissionMarkId = assertRequiredId(
    input.submissionMarkId,
    'submissionMarkId',
    operation,
  )
  const criterionId = assertRequiredId(
    input.criterionId,
    'criterionId',
    operation,
  )

  const score = assertNonNegativeScore(
    input.score,
    'score',
    operation,
  )

  const { data, error } = await client
    .from('submission_criterion_marks')
    .upsert(
      {
        submission_mark_id: submissionMarkId,
        criterion_id: criterionId,
        score,
        feedback: input.feedback?.trim() || null,
      },
      {
        onConflict: 'submission_mark_id,criterion_id',
      },
    )
    .select('*')
    .single()

  if (error) {
    throw toContentEngineError(operation, error)
  }

  return data
}

export async function releaseSubmissionMark(
  client: ContentEngineClient,
  submissionMarkId: string,
): Promise<SubmissionMark> {
  const operation = 'releaseSubmissionMark'
  const id = assertRequiredId(
    submissionMarkId,
    'submissionMarkId',
    operation,
  )

  const { data, error } = await client
    .from('submission_marks')
    .update({
      status: 'released',
      marked_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select('*')
    .single()

  if (error) {
    throw toContentEngineError(operation, error)
  }

  return data
}

export async function voidSubmissionMark(
  client: ContentEngineClient,
  submissionMarkId: string,
): Promise<SubmissionMark> {
  const operation = 'voidSubmissionMark'
  const id = assertRequiredId(
    submissionMarkId,
    'submissionMarkId',
    operation,
  )

  const { data, error } = await client
    .from('submission_marks')
    .update({
      status: 'void',
    })
    .eq('id', id)
    .select('*')
    .single()

  if (error) {
    throw toContentEngineError(operation, error)
  }

  return data
}
