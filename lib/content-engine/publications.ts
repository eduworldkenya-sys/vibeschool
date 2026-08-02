import type { ContentEngineClient } from './client'
import {
  assertRequiredId,
  toContentEngineError,
} from './errors'
import type {
  Chapter,
  Publication,
  PublicationFilters,
} from './types'

const DEFAULT_LIMIT = 50
const MAX_LIMIT = 200

function normalizeLimit(limit: number | undefined): number {
  if (limit === undefined || !Number.isFinite(limit)) {
    return DEFAULT_LIMIT
  }

  return Math.min(Math.max(Math.trunc(limit), 1), MAX_LIMIT)
}

export async function listPublishedPublications(
  client: ContentEngineClient,
  filters: PublicationFilters = {},
): Promise<Publication[]> {
  const operation = 'listPublishedPublications'

  let query = client
    .from('vibe_publications')
    .select('*')
    .eq('status', 'published')
    .order('published_at', { ascending: false })
    .limit(normalizeLimit(filters.limit))

  if (filters.grade?.trim()) {
    query = query.eq('cbc_grade', filters.grade.trim())
  }

  if (filters.subject?.trim()) {
    query = query.eq('cbc_subject', filters.subject.trim())
  }

  if (filters.authorId?.trim()) {
    query = query.eq('author_id', filters.authorId.trim())
  }

  const { data, error } = await query

  if (error) {
    throw toContentEngineError(operation, error)
  }

  return data
}

export async function getPublishedPublicationById(
  client: ContentEngineClient,
  publicationId: string,
): Promise<Publication | null> {
  const operation = 'getPublishedPublicationById'
  const id = assertRequiredId(publicationId, 'publicationId', operation)

  const { data, error } = await client
    .from('vibe_publications')
    .select('*')
    .eq('id', id)
    .eq('status', 'published')
    .maybeSingle()

  if (error) {
    throw toContentEngineError(operation, error)
  }

  return data
}

export async function listPublishedChapters(
  client: ContentEngineClient,
  publicationId: string,
): Promise<Chapter[]> {
  const operation = 'listPublishedChapters'
  const id = assertRequiredId(publicationId, 'publicationId', operation)

  const { data, error } = await client
    .from('vibe_chapters')
    .select('*')
    .eq('publication_id', id)
    .eq('status', 'published')
    .order('number', { ascending: true })

  if (error) {
    throw toContentEngineError(operation, error)
  }

  return data
}

export async function getPublishedChapterById(
  client: ContentEngineClient,
  chapterId: string,
): Promise<Chapter | null> {
  const operation = 'getPublishedChapterById'
  const id = assertRequiredId(chapterId, 'chapterId', operation)

  const { data, error } = await client
    .from('vibe_chapters')
    .select('*')
    .eq('id', id)
    .eq('status', 'published')
    .maybeSingle()

  if (error) {
    throw toContentEngineError(operation, error)
  }

  return data
}
