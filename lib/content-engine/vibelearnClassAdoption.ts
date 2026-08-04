import { supabase } from '@/lib/supabase'

export interface AdoptionClassOption {
  id: string
  name: string
  stream: string | null
}

export interface RegistryResourceMap {
  contentId: string
  resourceId: string
}

interface LearningResourceRow {
  id: string
  source_type: string
  content_id: string | null
  publication_id: string | null
}

export async function loadSubjectAdoptionClasses(
  subjectId: string,
): Promise<AdoptionClassOption[]> {
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    throw new Error('AUTH_REQUIRED')
  }

  const { data: assignments, error: assignmentError } =
    await supabase
      .from('teacher_classes')
      .select('class_id')
      .eq('teacher_id', user.id)
      .eq('subject_id', subjectId)

  if (assignmentError) {
    throw assignmentError
  }

  const classIds = Array.from(
    new Set(
      (assignments ?? []).map(row => row.class_id),
    ),
  )

  if (classIds.length === 0) {
    return []
  }

  const { data: classes, error: classError } =
    await supabase
      .from('classes')
      .select('id,name,stream')
      .in('id', classIds)
      .order('name')
      .order('stream')

  if (classError) {
    throw classError
  }

  return (classes ?? []) as AdoptionClassOption[]
}

export async function resolvePublicRegistryResources(
  items: {
    id: string
    vibePublicationId: string | null
  }[],
): Promise<RegistryResourceMap[]> {
  const contentIds = items.map(item => item.id)

  const publicationIds = items
    .map(item => item.vibePublicationId)
    .filter(
      (id): id is string =>
        typeof id === 'string' && id.length > 0,
    )

  const resourceRows: LearningResourceRow[] = []

  if (contentIds.length > 0) {
    const { data, error } = await supabase
      .from('learning_resources')
      .select(
        'id,source_type,content_id,publication_id'
      )
      .eq('status', 'active')
      .in('visibility', [
        'public',
        'school',
        'licensed',
        'purchased',
      ])
      .eq('source_type', 'vibelearn_content')
      .in('content_id', contentIds)

    if (error) {
      throw error
    }

    resourceRows.push(
      ...((data ?? []) as LearningResourceRow[]),
    )
  }

  if (publicationIds.length > 0) {
    const { data, error } = await supabase
      .from('learning_resources')
      .select(
        'id,source_type,content_id,publication_id'
      )
      .eq('status', 'active')
      .in('visibility', [
        'public',
        'school',
        'licensed',
        'purchased',
      ])
      .eq('source_type', 'publication')
      .in('publication_id', publicationIds)

    if (error) {
      throw error
    }

    resourceRows.push(
      ...((data ?? []) as LearningResourceRow[]),
    )
  }

  const publicationToContent = new Map(
    items
      .filter(item => item.vibePublicationId)
      .map(item => [
        item.vibePublicationId as string,
        item.id,
      ]),
  )

  return resourceRows.flatMap(row => {
    const contentId =
      row.source_type === 'vibelearn_content'
        ? row.content_id
        : row.publication_id
          ? publicationToContent.get(
              row.publication_id,
            ) ?? null
          : null

    if (!contentId) {
      return []
    }

    return [{
      contentId,
      resourceId: row.id,
    }]
  })
}

export async function addResourceToClass(input: {
  resourceId: string
  classId: string
  subjectId: string
}): Promise<string> {
  const { data, error } = await supabase.rpc(
    'ce_add_resource_to_class_library',
    {
      p_resource_id: input.resourceId,
      p_class_id: input.classId,
      p_subject_id: input.subjectId,
      p_usage_role: 'supplementary',
    },
  )

  if (error) {
    throw error
  }

  if (typeof data !== 'string') {
    throw new Error(
      'CLASS_LIBRARY_ADOPTION_FAILED',
    )
  }

  return data
}
