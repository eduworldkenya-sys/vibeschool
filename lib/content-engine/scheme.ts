import type { ContentEngineClient } from './client'
import {
  assertRequiredId,
  toContentEngineError,
} from './errors'
import type {
  SaveSchemeResourceLinkInput,
  SchemeLessonResourceLink,
  UpdateSchemeResourceLinkInput,
} from './types'

function validatePositiveInteger(
  value: number,
  fieldName: string,
  operation: string,
): number {
  if (!Number.isInteger(value) || value <= 0) {
    throw toContentEngineError(
      operation,
      new Error(`${fieldName} must be a positive integer.`),
    )
  }

  return value
}

function validatePageRange(
  pageStart: number | null | undefined,
  pageEnd: number | null | undefined,
  operation: string,
): void {
  const startMissing = pageStart === null || pageStart === undefined
  const endMissing = pageEnd === null || pageEnd === undefined

  if (startMissing && endMissing) {
    return
  }

  if (startMissing || endMissing) {
    throw toContentEngineError(
      operation,
      new Error('pageStart and pageEnd must be provided together.'),
    )
  }

  validatePositiveInteger(pageStart, 'pageStart', operation)
  validatePositiveInteger(pageEnd, 'pageEnd', operation)

  if (pageEnd < pageStart) {
    throw toContentEngineError(
      operation,
      new Error('pageEnd cannot be less than pageStart.'),
    )
  }
}

export async function listSchemeResourceLinks(
  client: ContentEngineClient,
  schemeLessonId: string,
): Promise<SchemeLessonResourceLink[]> {
  const operation = 'listSchemeResourceLinks'
  const lessonId = assertRequiredId(
    schemeLessonId,
    'schemeLessonId',
    operation,
  )

  const { data, error } = await client
    .from('scheme_lesson_resource_links')
    .select('*')
    .eq('scheme_lesson_id', lessonId)
    .order('sequence', { ascending: true })

  if (error) {
    throw toContentEngineError(operation, error)
  }

  return data
}

export async function saveSchemeResourceLink(
  client: ContentEngineClient,
  input: SaveSchemeResourceLinkInput,
): Promise<SchemeLessonResourceLink> {
  const operation = 'saveSchemeResourceLink'

  const schemeLessonId = assertRequiredId(
    input.schemeLessonId,
    'schemeLessonId',
    operation,
  )
  const publicationId = assertRequiredId(
    input.publicationId,
    'publicationId',
    operation,
  )
  const chapterId = assertRequiredId(
    input.chapterId,
    'chapterId',
    operation,
  )
  const resourceId = assertRequiredId(
    input.resourceId,
    'resourceId',
    operation,
  )

  const sequence = validatePositiveInteger(
    input.sequence ?? 1,
    'sequence',
    operation,
  )

  validatePageRange(input.pageStart, input.pageEnd, operation)

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

  const { data, error } = await client
    .from('scheme_lesson_resource_links')
    .upsert(
      {
        scheme_lesson_id: schemeLessonId,
        publication_id: publicationId,
        chapter_id: chapterId,
        resource_id: resourceId,
        resource_role: input.resourceRole,
        sequence,
        page_start: input.pageStart,
        page_end: input.pageEnd,
        exercise_refs: input.exerciseRefs ?? [],
        created_by: user.id,
      },
      {
        onConflict: 'scheme_lesson_id,chapter_id,resource_role',
      },
    )
    .select('*')
    .single()

  if (error) {
    throw toContentEngineError(operation, error)
  }

  return data
}

export async function updateSchemeResourceLink(
  client: ContentEngineClient,
  linkId: string,
  input: UpdateSchemeResourceLinkInput,
): Promise<SchemeLessonResourceLink> {
  const operation = 'updateSchemeResourceLink'
  const id = assertRequiredId(linkId, 'linkId', operation)

  if (input.sequence !== undefined) {
    validatePositiveInteger(input.sequence, 'sequence', operation)
  }

  validatePageRange(input.pageStart, input.pageEnd, operation)

  const update = {
    ...(input.resourceRole !== undefined
      ? { resource_role: input.resourceRole }
      : {}),
    ...(input.sequence !== undefined
      ? { sequence: input.sequence }
      : {}),
    ...(input.pageStart !== undefined
      ? { page_start: input.pageStart }
      : {}),
    ...(input.pageEnd !== undefined
      ? { page_end: input.pageEnd }
      : {}),
    ...(input.exerciseRefs !== undefined
      ? { exercise_refs: input.exerciseRefs }
      : {}),
  }

  const { data, error } = await client
    .from('scheme_lesson_resource_links')
    .update(update)
    .eq('id', id)
    .select('*')
    .single()

  if (error) {
    throw toContentEngineError(operation, error)
  }

  return data
}

export async function removeSchemeResourceLink(
  client: ContentEngineClient,
  linkId: string,
): Promise<void> {
  const operation = 'removeSchemeResourceLink'
  const id = assertRequiredId(linkId, 'linkId', operation)

  const { error } = await client
    .from('scheme_lesson_resource_links')
    .delete()
    .eq('id', id)

  if (error) {
    throw toContentEngineError(operation, error)
  }
}
