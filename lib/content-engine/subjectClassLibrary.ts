import { supabase } from '@/lib/supabase'

export interface SubjectClassLibraryItem {
  id: string
  classId: string
  subjectId: string | null
  resourceId: string
  usageRole: string
  title: string
  sourceType: string
}

interface ClassLibraryRow {
  id: string
  class_id: string
  subject_id: string | null
  resource_id: string
  usage_role: string
}

interface LearningResourceRow {
  id: string
  title: string
  source_type: string
}

export async function loadSubjectClassLibrary(input: {
  teacherId: string
  schoolId: string
  subjectId: string
  classIds: string[]
}): Promise<SubjectClassLibraryItem[]> {
  const {
    teacherId,
    schoolId,
    subjectId,
    classIds,
  } = input

  if (classIds.length === 0) {
    return []
  }

  const { data: libraryRows, error: libraryError } =
    await supabase
      .from('class_resource_library')
      .select(
        'id,class_id,subject_id,resource_id,usage_role'
      )
      .eq('teacher_id', teacherId)
      .eq('school_id', schoolId)
      .eq('subject_id', subjectId)
      .eq('status', 'active')
      .in('class_id', classIds)

  if (libraryError) {
    throw libraryError
  }

  const typedLibraryRows =
    (libraryRows ?? []) as ClassLibraryRow[]

  const resourceIds = Array.from(
    new Set(
      typedLibraryRows.map(
        row => row.resource_id,
      ),
    ),
  )

  if (resourceIds.length === 0) {
    return []
  }

  const { data: resourceRows, error: resourceError } =
    await supabase
      .from('learning_resources')
      .select('id,title,source_type')
      .eq('status', 'active')
      .in('id', resourceIds)

  if (resourceError) {
    throw resourceError
  }

  const resourcesById = new Map(
    (
      (resourceRows ?? []) as LearningResourceRow[]
    ).map(row => [row.id, row]),
  )

  return typedLibraryRows.flatMap(row => {
    const resource =
      resourcesById.get(row.resource_id)

    if (!resource) {
      return []
    }

    return [{
      id: row.id,
      classId: row.class_id,
      subjectId: row.subject_id,
      resourceId: row.resource_id,
      usageRole: row.usage_role,
      title: resource.title,
      sourceType: resource.source_type,
    }]
  })
}
