import type { ContentEngineClient } from './client'
import {
  assertRequiredId,
  toContentEngineError,
} from './errors'
import type {
  ContentEngineDailyMetric,
  ContentMetricFilters,
  TeacherContentEngineSummary,
} from './types'

const DEFAULT_LIMIT = 250
const MAX_LIMIT = 1000

function normalizeLimit(limit: number | undefined): number {
  if (limit === undefined || !Number.isFinite(limit)) {
    return DEFAULT_LIMIT
  }

  return Math.min(Math.max(Math.trunc(limit), 1), MAX_LIMIT)
}

export async function getTeacherContentEngineSummary(
  client: ContentEngineClient,
  teacherId: string,
  classId?: string,
): Promise<TeacherContentEngineSummary[]> {
  const operation = 'getTeacherContentEngineSummary'
  const id = assertRequiredId(teacherId, 'teacherId', operation)

  let query = client
    .from('teacher_content_engine_summary')
    .select('*')
    .eq('teacher_id', id)

  if (classId?.trim()) {
    query = query.eq('class_id', classId.trim())
  }

  const { data, error } = await query

  if (error) {
    throw toContentEngineError(operation, error)
  }

  return data
}

export async function getCurrentTeacherContentEngineSummary(
  client: ContentEngineClient,
  classId?: string,
): Promise<TeacherContentEngineSummary[]> {
  const operation = 'getCurrentTeacherContentEngineSummary'

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
      new Error('An authenticated teacher is required.'),
    )
  }

  return getTeacherContentEngineSummary(
    client,
    user.id,
    classId,
  )
}

export async function listContentEngineDailyMetrics(
  client: ContentEngineClient,
  filters: ContentMetricFilters = {},
): Promise<ContentEngineDailyMetric[]> {
  const operation = 'listContentEngineDailyMetrics'

  let query = client
    .from('content_engine_daily_metrics')
    .select('*')
    .order('metric_date', { ascending: false })
    .limit(normalizeLimit(filters.limit))

  if (filters.dateFrom?.trim()) {
    query = query.gte('metric_date', filters.dateFrom.trim())
  }

  if (filters.dateTo?.trim()) {
    query = query.lte('metric_date', filters.dateTo.trim())
  }

  if (filters.teacherId?.trim()) {
    query = query.eq('teacher_id', filters.teacherId.trim())
  }

  if (filters.classId?.trim()) {
    query = query.eq('class_id', filters.classId.trim())
  }

  if (filters.subjectId?.trim()) {
    query = query.eq('subject_id', filters.subjectId.trim())
  }

  if (filters.metricKey?.trim()) {
    query = query.eq('metric_key', filters.metricKey.trim())
  }

  const { data, error } = await query

  if (error) {
    throw toContentEngineError(operation, error)
  }

  return data
}
