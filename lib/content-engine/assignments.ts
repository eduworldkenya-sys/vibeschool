import type { ContentEngineClient } from './client'
import {
  assertRequiredId,
  toContentEngineError,
} from './errors'
import type {
  AssignResourceToClassInput,
  ContentAssignment,
  ContentAssignmentLearner,
} from './types'

export async function assignResourceToClass(
  client: ContentEngineClient,
  input: AssignResourceToClassInput,
): Promise<string> {
  const operation = 'assignResourceToClass'
  const resourceId = assertRequiredId(
    input.resourceId,
    'resourceId',
    operation,
  )
  const classId = assertRequiredId(
    input.classId,
    'classId',
    operation,
  )

  const { data, error } = await client.rpc(
    'ce_assign_resource_to_class',
    {
      p_resource_id: resourceId,
      p_class_id: classId,
      p_assignment_type: input.assignmentType,
      p_subject_id: input.subjectId?.trim() || undefined,
      p_scheme_resource_link_id:
        input.schemeResourceLinkId?.trim() || undefined,
      p_opens_at: input.opensAt || undefined,
      p_due_at: input.dueAt || undefined,
      p_instructions: input.instructions?.trim() || undefined,
    },
  )

  if (error) {
    throw toContentEngineError(operation, error)
  }

  return assertRequiredId(data, 'assignmentId', operation)
}

export async function getAssignmentById(
  client: ContentEngineClient,
  assignmentId: string,
): Promise<ContentAssignment | null> {
  const operation = 'getAssignmentById'
  const id = assertRequiredId(
    assignmentId,
    'assignmentId',
    operation,
  )

  const { data, error } = await client
    .from('vibe_chapter_assignments')
    .select('*')
    .eq('id', id)
    .maybeSingle()

  if (error) {
    throw toContentEngineError(operation, error)
  }

  return data
}

export async function listClassAssignments(
  client: ContentEngineClient,
  classId: string,
): Promise<ContentAssignment[]> {
  const operation = 'listClassAssignments'
  const id = assertRequiredId(classId, 'classId', operation)

  const { data, error } = await client
    .from('vibe_chapter_assignments')
    .select('*')
    .eq('class_id', id)
    .order('assigned_at', { ascending: false })

  if (error) {
    throw toContentEngineError(operation, error)
  }

  return data
}

export async function listAssignmentLearners(
  client: ContentEngineClient,
  assignmentId: string,
): Promise<ContentAssignmentLearner[]> {
  const operation = 'listAssignmentLearners'
  const id = assertRequiredId(
    assignmentId,
    'assignmentId',
    operation,
  )

  const { data, error } = await client
    .from('content_assignment_learners')
    .select('*')
    .eq('assignment_id', id)
    .order('assigned_at', { ascending: true })

  if (error) {
    throw toContentEngineError(operation, error)
  }

  return data
}
