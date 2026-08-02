import type { ContentEngineClient } from './client'
import {
  assertRequiredId,
  toContentEngineError,
} from './errors'
import type {
  AssessmentBlueprintBundle,
  ContentAssessmentBlueprint,
  ContentAssessmentSource,
  CreateAssessmentBlueprintInput,
  CreateGeneratedAssessmentInput,
  GeneratedAssessment,
  GeneratedAssessmentBundle,
  GeneratedAssessmentItem,
  GeneratedAssessmentStatus,
  SaveAssessmentSourceInput,
  SaveGeneratedAssessmentItemInput,
} from './types'

function assertPositiveInteger(
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

function assertPositiveNumber(
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

function assertRequiredText(
  value: string,
  fieldName: string,
  operation: string,
): string {
  const normalized = value.trim()

  if (!normalized) {
    throw toContentEngineError(
      operation,
      new Error(`${fieldName} is required.`),
    )
  }

  return normalized
}

export async function createAssessmentBlueprint(
  client: ContentEngineClient,
  input: CreateAssessmentBlueprintInput,
): Promise<ContentAssessmentBlueprint> {
  const operation = 'createAssessmentBlueprint'
  const title = assertRequiredText(input.title, 'title', operation)
  const totalMarks = assertPositiveInteger(
    input.totalMarks,
    'totalMarks',
    operation,
  )

  if (input.durationMinutes !== undefined) {
    assertPositiveInteger(
      input.durationMinutes,
      'durationMinutes',
      operation,
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
      new Error('An authenticated teacher is required.'),
    )
  }

  const { data, error } = await client
    .from('content_assessment_blueprints')
    .insert({
      teacher_id: user.id,
      school_id: input.schoolId?.trim() || null,
      class_id: input.classId?.trim() || null,
      subject_id: input.subjectId?.trim() || null,
      title,
      assessment_type: input.assessmentType,
      total_marks: totalMarks,
      duration_minutes: input.durationMinutes ?? null,
      status: 'draft',
      difficulty_distribution:
        input.difficultyDistribution ?? {},
      bloom_distribution:
        input.bloomDistribution ?? {},
    })
    .select('*')
    .single()

  if (error) {
    throw toContentEngineError(operation, error)
  }

  return data
}

export async function updateAssessmentBlueprint(
  client: ContentEngineClient,
  blueprintId: string,
  input: Partial<CreateAssessmentBlueprintInput>,
): Promise<ContentAssessmentBlueprint> {
  const operation = 'updateAssessmentBlueprint'
  const id = assertRequiredId(
    blueprintId,
    'blueprintId',
    operation,
  )

  if (input.totalMarks !== undefined) {
    assertPositiveInteger(
      input.totalMarks,
      'totalMarks',
      operation,
    )
  }

  if (input.durationMinutes !== undefined) {
    assertPositiveInteger(
      input.durationMinutes,
      'durationMinutes',
      operation,
    )
  }

  const update = {
    ...(input.title !== undefined
      ? {
          title: assertRequiredText(
            input.title,
            'title',
            operation,
          ),
        }
      : {}),
    ...(input.assessmentType !== undefined
      ? { assessment_type: input.assessmentType }
      : {}),
    ...(input.totalMarks !== undefined
      ? { total_marks: input.totalMarks }
      : {}),
    ...(input.classId !== undefined
      ? { class_id: input.classId.trim() || null }
      : {}),
    ...(input.subjectId !== undefined
      ? { subject_id: input.subjectId.trim() || null }
      : {}),
    ...(input.schoolId !== undefined
      ? { school_id: input.schoolId.trim() || null }
      : {}),
    ...(input.durationMinutes !== undefined
      ? { duration_minutes: input.durationMinutes }
      : {}),
    ...(input.difficultyDistribution !== undefined
      ? {
          difficulty_distribution:
            input.difficultyDistribution,
        }
      : {}),
    ...(input.bloomDistribution !== undefined
      ? { bloom_distribution: input.bloomDistribution }
      : {}),
  }

  const { data, error } = await client
    .from('content_assessment_blueprints')
    .update(update)
    .eq('id', id)
    .select('*')
    .single()

  if (error) {
    throw toContentEngineError(operation, error)
  }

  return data
}

export async function getAssessmentBlueprintBundle(
  client: ContentEngineClient,
  blueprintId: string,
): Promise<AssessmentBlueprintBundle | null> {
  const operation = 'getAssessmentBlueprintBundle'
  const id = assertRequiredId(
    blueprintId,
    'blueprintId',
    operation,
  )

  const [
    { data: blueprint, error: blueprintError },
    { data: sources, error: sourcesError },
    { data: assessments, error: assessmentsError },
  ] = await Promise.all([
    client
      .from('content_assessment_blueprints')
      .select('*')
      .eq('id', id)
      .maybeSingle(),
    client
      .from('content_assessment_sources')
      .select('*')
      .eq('blueprint_id', id)
      .order('created_at', { ascending: true }),
    client
      .from('generated_assessments')
      .select('*')
      .eq('blueprint_id', id)
      .order('version', { ascending: false }),
  ])

  if (blueprintError) {
    throw toContentEngineError(operation, blueprintError)
  }

  if (sourcesError) {
    throw toContentEngineError(operation, sourcesError)
  }

  if (assessmentsError) {
    throw toContentEngineError(operation, assessmentsError)
  }

  if (!blueprint) {
    return null
  }

  return {
    blueprint,
    sources,
    assessments,
  }
}

export async function saveAssessmentSource(
  client: ContentEngineClient,
  input: SaveAssessmentSourceInput,
): Promise<ContentAssessmentSource> {
  const operation = 'saveAssessmentSource'
  const blueprintId = assertRequiredId(
    input.blueprintId,
    'blueprintId',
    operation,
  )
  const resourceId = assertRequiredId(
    input.resourceId,
    'resourceId',
    operation,
  )
  const weight = assertPositiveNumber(
    input.weight ?? 1,
    'weight',
    operation,
  )

  let existingQuery = client
    .from('content_assessment_sources')
    .select('*')
    .eq('blueprint_id', blueprintId)
    .eq('resource_id', resourceId)

  if (input.outcomeId?.trim()) {
    existingQuery = existingQuery.eq(
      'outcome_id',
      input.outcomeId.trim(),
    )
  } else {
    existingQuery = existingQuery.is('outcome_id', null)
  }

  const { data: existing, error: existingError } =
    await existingQuery.maybeSingle()

  if (existingError) {
    throw toContentEngineError(operation, existingError)
  }

  if (existing) {
    const { data, error } = await client
      .from('content_assessment_sources')
      .update({
        scheme_resource_link_id:
          input.schemeResourceLinkId?.trim() || null,
        weight,
      })
      .eq('id', existing.id)
      .select('*')
      .single()

    if (error) {
      throw toContentEngineError(operation, error)
    }

    return data
  }

  const { data, error } = await client
    .from('content_assessment_sources')
    .insert({
      blueprint_id: blueprintId,
      resource_id: resourceId,
      scheme_resource_link_id:
        input.schemeResourceLinkId?.trim() || null,
      outcome_id: input.outcomeId?.trim() || null,
      weight,
    })
    .select('*')
    .single()

  if (error) {
    throw toContentEngineError(operation, error)
  }

  return data
}

export async function removeAssessmentSource(
  client: ContentEngineClient,
  sourceId: string,
): Promise<void> {
  const operation = 'removeAssessmentSource'
  const id = assertRequiredId(sourceId, 'sourceId', operation)

  const { error } = await client
    .from('content_assessment_sources')
    .delete()
    .eq('id', id)

  if (error) {
    throw toContentEngineError(operation, error)
  }
}

export async function createGeneratedAssessment(
  client: ContentEngineClient,
  input: CreateGeneratedAssessmentInput,
): Promise<GeneratedAssessment> {
  const operation = 'createGeneratedAssessment'
  const blueprintId = assertRequiredId(
    input.blueprintId,
    'blueprintId',
    operation,
  )
  const version = assertPositiveInteger(
    input.version,
    'version',
    operation,
  )
  const totalMarks = assertPositiveInteger(
    input.totalMarks,
    'totalMarks',
    operation,
  )

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
    .from('generated_assessments')
    .insert({
      blueprint_id: blueprintId,
      version,
      status: 'draft',
      total_marks: totalMarks,
      generated_by: user.id,
    })
    .select('*')
    .single()

  if (error) {
    throw toContentEngineError(operation, error)
  }

  return data
}

export async function saveGeneratedAssessmentItem(
  client: ContentEngineClient,
  input: SaveGeneratedAssessmentItemInput,
): Promise<GeneratedAssessmentItem> {
  const operation = 'saveGeneratedAssessmentItem'
  const assessmentId = assertRequiredId(
    input.assessmentId,
    'assessmentId',
    operation,
  )
  const sourceResourceId = assertRequiredId(
    input.sourceResourceId,
    'sourceResourceId',
    operation,
  )
  const sequence = assertPositiveInteger(
    input.sequence,
    'sequence',
    operation,
  )
  const marks = assertPositiveInteger(
    input.marks,
    'marks',
    operation,
  )
  const prompt = assertRequiredText(
    input.prompt,
    'prompt',
    operation,
  )

  const { data, error } = await client
    .from('generated_assessment_items')
    .upsert(
      {
        assessment_id: assessmentId,
        sequence,
        question_type: input.questionType,
        prompt,
        options: input.options ?? null,
        answer_key: input.answerKey ?? null,
        marks,
        difficulty: input.difficulty ?? null,
        bloom_level: input.bloomLevel ?? null,
        source_resource_id: sourceResourceId,
        source_block_id:
          input.sourceBlockId?.trim() || null,
        outcome_id: input.outcomeId?.trim() || null,
      },
      {
        onConflict: 'assessment_id,sequence',
      },
    )
    .select('*')
    .single()

  if (error) {
    throw toContentEngineError(operation, error)
  }

  return data
}

export async function removeGeneratedAssessmentItem(
  client: ContentEngineClient,
  itemId: string,
): Promise<void> {
  const operation = 'removeGeneratedAssessmentItem'
  const id = assertRequiredId(itemId, 'itemId', operation)

  const { error } = await client
    .from('generated_assessment_items')
    .delete()
    .eq('id', id)

  if (error) {
    throw toContentEngineError(operation, error)
  }
}

export async function getGeneratedAssessmentBundle(
  client: ContentEngineClient,
  assessmentId: string,
): Promise<GeneratedAssessmentBundle | null> {
  const operation = 'getGeneratedAssessmentBundle'
  const id = assertRequiredId(
    assessmentId,
    'assessmentId',
    operation,
  )

  const [
    { data: assessment, error: assessmentError },
    { data: items, error: itemsError },
  ] = await Promise.all([
    client
      .from('generated_assessments')
      .select('*')
      .eq('id', id)
      .maybeSingle(),
    client
      .from('generated_assessment_items')
      .select('*')
      .eq('assessment_id', id)
      .order('sequence', { ascending: true }),
  ])

  if (assessmentError) {
    throw toContentEngineError(operation, assessmentError)
  }

  if (itemsError) {
    throw toContentEngineError(operation, itemsError)
  }

  if (!assessment) {
    return null
  }

  return {
    assessment,
    items,
  }
}

export async function setGeneratedAssessmentStatus(
  client: ContentEngineClient,
  assessmentId: string,
  status: GeneratedAssessmentStatus,
): Promise<GeneratedAssessment> {
  const operation = 'setGeneratedAssessmentStatus'
  const id = assertRequiredId(
    assessmentId,
    'assessmentId',
    operation,
  )

  const { data, error } = await client
    .from('generated_assessments')
    .update({ status })
    .eq('id', id)
    .select('*')
    .single()

  if (error) {
    throw toContentEngineError(operation, error)
  }

  return data
}
