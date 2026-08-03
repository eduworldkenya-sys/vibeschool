import type { ContentEngineClient } from './client'
import {
  assertRequiredId,
  toContentEngineError,
} from './errors'
import type {
  BuildParentLearningSummaryInput,
  ParentLearningSummary,
  ParentSummaryFilters,
  UpdateParentLearningSummaryInput,
} from './types'

const DEFAULT_LIMIT = 50
const MAX_LIMIT = 250

function normalizeLimit(limit: number | undefined): number {
  if (limit === undefined || !Number.isFinite(limit)) {
    return DEFAULT_LIMIT
  }

  return Math.min(Math.max(Math.trunc(limit), 1), MAX_LIMIT)
}

function assertDateRange(
  periodStart: string,
  periodEnd: string,
  operation: string,
): void {
  const start = Date.parse(periodStart)
  const end = Date.parse(periodEnd)

  if (!Number.isFinite(start) || !Number.isFinite(end)) {
    throw toContentEngineError(
      operation,
      new Error('periodStart and periodEnd must be valid dates.'),
    )
  }

  if (end < start) {
    throw toContentEngineError(
      operation,
      new Error('periodEnd cannot be before periodStart.'),
    )
  }
}

export async function buildParentLearningSummary(
  client: ContentEngineClient,
  input: BuildParentLearningSummaryInput,
): Promise<string> {
  const operation = 'buildParentLearningSummary'
  const studentId = assertRequiredId(
    input.studentId,
    'studentId',
    operation,
  )

  assertDateRange(
    input.periodStart,
    input.periodEnd,
    operation,
  )

  const { data, error } = await client.rpc(
    'ce_build_parent_learning_summary',
    {
      p_student_id: studentId,
      p_period_start: input.periodStart,
      p_period_end: input.periodEnd,
      p_class_id: input.classId?.trim() || undefined,
    },
  )

  if (error) {
    throw toContentEngineError(operation, error)
  }

  return assertRequiredId(data, 'summaryId', operation)
}

export async function getParentLearningSummaryById(
  client: ContentEngineClient,
  summaryId: string,
): Promise<ParentLearningSummary | null> {
  const operation = 'getParentLearningSummaryById'
  const id = assertRequiredId(summaryId, 'summaryId', operation)

  const { data, error } = await client
    .from('parent_learning_summaries')
    .select('*')
    .eq('id', id)
    .maybeSingle()

  if (error) {
    throw toContentEngineError(operation, error)
  }

  return data
}

export async function listParentLearningSummaries(
  client: ContentEngineClient,
  filters: ParentSummaryFilters = {},
): Promise<ParentLearningSummary[]> {
  const operation = 'listParentLearningSummaries'

  let query = client
    .from('parent_learning_summaries')
    .select('*')
    .order('generated_at', { ascending: false })
    .limit(normalizeLimit(filters.limit))

  if (filters.studentId?.trim()) {
    query = query.eq('student_id', filters.studentId.trim())
  }

  if (filters.classId?.trim()) {
    query = query.eq('class_id', filters.classId.trim())
  }

  if (filters.status) {
    query = query.eq('status', filters.status)
  }

  const { data, error } = await query

  if (error) {
    throw toContentEngineError(operation, error)
  }

  return data
}

export async function listPublishedParentSummaries(
  client: ContentEngineClient,
  studentId?: string,
): Promise<ParentLearningSummary[]> {
  return listParentLearningSummaries(client, {
    studentId,
    status: 'published',
  })
}

export async function updateParentLearningSummary(
  client: ContentEngineClient,
  summaryId: string,
  input: UpdateParentLearningSummaryInput,
): Promise<ParentLearningSummary> {
  const operation = 'updateParentLearningSummary'
  const id = assertRequiredId(summaryId, 'summaryId', operation)

  const update = {
    ...(input.strengths !== undefined
      ? {
          strengths: input.strengths
            .map((value) => value.trim())
            .filter(Boolean),
        }
      : {}),
    ...(input.focusAreas !== undefined
      ? {
          focus_areas: input.focusAreas
            .map((value) => value.trim())
            .filter(Boolean),
        }
      : {}),
    ...(input.teacherComment !== undefined
      ? {
          teacher_comment:
            input.teacherComment?.trim() || null,
        }
      : {}),
  }

  const { data, error } = await client
    .from('parent_learning_summaries')
    .update(update)
    .eq('id', id)
    .eq('status', 'draft')
    .select('*')
    .single()

  if (error) {
    throw toContentEngineError(operation, error)
  }

  return data
}

export async function approveParentLearningSummary(
  client: ContentEngineClient,
  summaryId: string,
): Promise<ParentLearningSummary> {
  const operation = 'approveParentLearningSummary'
  const id = assertRequiredId(summaryId, 'summaryId', operation)

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
      new Error('An authenticated teacher or administrator is required.'),
    )
  }

  const approvedAt = new Date().toISOString()

  const { data, error } = await client
    .from('parent_learning_summaries')
    .update({
      status: 'approved',
      approved_by: user.id,
      approved_at: approvedAt,
    })
    .eq('id', id)
    .eq('status', 'draft')
    .select('*')
    .single()

  if (error) {
    throw toContentEngineError(operation, error)
  }

  return data
}

export async function publishParentLearningSummary(
  client: ContentEngineClient,
  summaryId: string,
): Promise<void> {
  const operation = 'publishParentLearningSummary'
  const id = assertRequiredId(summaryId, 'summaryId', operation)

  const { error } = await client.rpc(
    'ce_publish_parent_learning_summary',
    {
      p_summary_id: id,
    },
  )

  if (error) {
    throw toContentEngineError(operation, error)
  }
}
