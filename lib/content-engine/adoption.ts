import type { ContentEngineClient } from './client'
import {
  assertRequiredId,
  toContentEngineError,
} from './errors'
import type {
  AddResourceToClassLibraryInput,
  AdoptLearningResourceInput,
  ClassResourceLibraryEntry,
  TeacherResourceAdoption,
} from './types'

export async function getCurrentTeacherResourceAdoptions(
  client: ContentEngineClient,
): Promise<TeacherResourceAdoption[]> {
  const operation = 'getCurrentTeacherResourceAdoptions'

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
    .from('teacher_resource_adoptions')
    .select('*')
    .eq('teacher_id', user.id)
    .order('updated_at', { ascending: false })

  if (error) {
    throw toContentEngineError(operation, error)
  }

  return data
}

export async function adoptLearningResource(
  client: ContentEngineClient,
  input: AdoptLearningResourceInput,
): Promise<string> {
  const operation = 'adoptLearningResource'
  const resourceId = assertRequiredId(
    input.resourceId,
    'resourceId',
    operation,
  )

  const { data, error } = await client.rpc(
    'ce_adopt_learning_resource',
    {
      p_resource_id: resourceId,
      p_preferred_role: input.preferredRole?.trim() || undefined,
      p_notes: input.notes?.trim() || undefined,
    },
  )

  if (error) {
    throw toContentEngineError(operation, error)
  }

  return assertRequiredId(data, 'adoptionId', operation)
}

export async function addResourceToClassLibrary(
  client: ContentEngineClient,
  input: AddResourceToClassLibraryInput,
): Promise<string> {
  const operation = 'addResourceToClassLibrary'
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
    'ce_add_resource_to_class_library',
    {
      p_resource_id: resourceId,
      p_class_id: classId,
      p_subject_id: input.subjectId?.trim() || undefined,
      p_usage_role: input.usageRole?.trim() || undefined,
      p_available_from: input.availableFrom || undefined,
      p_available_until: input.availableUntil || undefined,
      p_notes: input.notes?.trim() || undefined,
    },
  )

  if (error) {
    throw toContentEngineError(operation, error)
  }

  return assertRequiredId(data, 'classLibraryEntryId', operation)
}

export async function listClassResourceLibrary(
  client: ContentEngineClient,
  classId: string,
): Promise<ClassResourceLibraryEntry[]> {
  const operation = 'listClassResourceLibrary'
  const id = assertRequiredId(classId, 'classId', operation)

  const { data, error } = await client
    .from('class_resource_library')
    .select('*')
    .eq('class_id', id)
    .eq('status', 'active')
    .order('updated_at', { ascending: false })

  if (error) {
    throw toContentEngineError(operation, error)
  }

  return data
}
