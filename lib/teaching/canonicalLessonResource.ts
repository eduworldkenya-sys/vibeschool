import { supabase } from '@/lib/supabase'

export async function pinCanonicalLessonResource({
  lessonPlanId,
  resourceId,
  resourceVersionId,
}: {
  lessonPlanId: string
  resourceId: string
  resourceVersionId: string
}): Promise<void> {
  const { data, error } = await supabase.rpc(
    'cla_pin_lesson_plan_resource_version',
    {
      p_lesson_plan_id: lessonPlanId,
      p_resource_id: resourceId,
      p_resource_version_id: resourceVersionId,
    },
  )

  if (error) {
    throw error
  }

  const payload = data as {
    ok?: boolean
  } | null

  if (!payload?.ok) {
    throw new Error(
      'canonicalLessonResource: exact version pin failed.',
    )
  }
}
