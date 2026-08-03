import type { ContentEngineClient } from './client'
import {
  assertRequiredId,
  toContentEngineError,
} from './errors'
import type {
  LearningResource,
  ResourceFilters,
} from './types'

const DEFAULT_LIMIT = 100
const MAX_LIMIT = 250

function normalizeLimit(limit: number | undefined): number {
  if (limit === undefined || !Number.isFinite(limit)) {
    return DEFAULT_LIMIT
  }

  return Math.min(Math.max(Math.trunc(limit), 1), MAX_LIMIT)
}

export async function listActiveLearningResources(
  client: ContentEngineClient,
  filters: ResourceFilters = {},
): Promise<LearningResource[]> {
  const operation = 'listActiveLearningResources'

  let query = client
    .from('learning_resources')
    .select('*')
    .eq('status', 'active')
    .order('updated_at', { ascending: false })
    .limit(normalizeLimit(filters.limit))

  if (filters.publicationId?.trim()) {
    query = query.eq('publication_id', filters.publicationId.trim())
  }

  if (filters.chapterId?.trim()) {
    query = query.eq('chapter_id', filters.chapterId.trim())
  }

  if (filters.subjectId?.trim()) {
    query = query.eq('subject_id', filters.subjectId.trim())
  }

  if (filters.grade?.trim()) {
    query = query.eq('grade', filters.grade.trim())
  }

  if (filters.sourceType?.trim()) {
    query = query.eq('source_type', filters.sourceType.trim())
  }

  if (filters.visibility?.trim()) {
    query = query.eq('visibility', filters.visibility.trim())
  }

  const { data, error } = await query

  if (error) {
    throw toContentEngineError(operation, error)
  }

  return data
}

export async function getActiveLearningResourceById(
  client: ContentEngineClient,
  resourceId: string,
): Promise<LearningResource | null> {
  const operation = 'getActiveLearningResourceById'
  const id = assertRequiredId(resourceId, 'resourceId', operation)

  const { data, error } = await client
    .from('learning_resources')
    .select('*')
    .eq('id', id)
    .eq('status', 'active')
    .maybeSingle()

  if (error) {
    throw toContentEngineError(operation, error)
  }

  return data
}

export async function listChapterResources(
  client: ContentEngineClient,
  chapterId: string,
): Promise<LearningResource[]> {
  const operation = 'listChapterResources'
  const id = assertRequiredId(chapterId, 'chapterId', operation)

  const { data, error } = await client
    .from('learning_resources')
    .select('*')
    .eq('chapter_id', id)
    .eq('status', 'active')
    .order('updated_at', { ascending: false })

  if (error) {
    throw toContentEngineError(operation, error)
  }

  return data
}
