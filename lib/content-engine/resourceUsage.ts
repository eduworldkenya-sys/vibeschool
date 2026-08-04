import { supabase } from '@/lib/supabase'

interface RpcError {
  message: string
}

type RpcCaller = (
  functionName: string,
  args: Record<string, unknown>,
) => PromiseLike<{
  data: unknown
  error: RpcError | null
}>

const callRpc =
  supabase.rpc as unknown as RpcCaller

export interface OccurrenceResourceUsage {
  usageId: string
  resourceId: string
  resourceLinkId: string
  lessonPlanId: string
  usedAt: string
  title: string
  sourceType: string
  usageRole: string
}

export async function listOccurrenceResourceUsage(
  occurrenceId: string,
): Promise<OccurrenceResourceUsage[]> {
  const { data, error } = await callRpc(
    'list_occurrence_resource_usage',
    {
      p_occurrence_id: occurrenceId,
    },
  )

  if (error) {
    throw new Error(error.message)
  }

  const payload = data as {
    ok?: boolean
    error?: string | null
    items?: Array<{
      usage_id?: string
      resource_id?: string
      resource_link_id?: string
      lesson_plan_id?: string
      used_at?: string
      title?: string
      source_type?: string
      usage_role?: string
    }>
  } | null

  if (!payload?.ok) {
    throw new Error(
      payload?.error ??
      'occurrence_resource_usage_load_failed',
    )
  }

  return (payload.items ?? []).flatMap(
    item => {
      if (
        !item.usage_id ||
        !item.resource_id ||
        !item.resource_link_id ||
        !item.lesson_plan_id ||
        !item.used_at
      ) {
        return []
      }

      return [{
        usageId: item.usage_id,
        resourceId: item.resource_id,
        resourceLinkId:
          item.resource_link_id,
        lessonPlanId:
          item.lesson_plan_id,
        usedAt: item.used_at,
        title:
          item.title ??
          'Untitled resource',
        sourceType:
          item.source_type ??
          'resource',
        usageRole:
          item.usage_role ??
          'source',
      }]
    },
  )
}

export async function markOccurrenceResourceUsed(
  input: {
    occurrenceId: string
    lessonPlanId: string
    resourceId: string
  },
): Promise<void> {
  const { data, error } = await callRpc(
    'mark_occurrence_resource_used',
    {
      p_occurrence_id:
        input.occurrenceId,
      p_lesson_plan_id:
        input.lessonPlanId,
      p_resource_id:
        input.resourceId,
    },
  )

  if (error) {
    throw new Error(error.message)
  }

  const payload = data as {
    ok?: boolean
    error?: string | null
  } | null

  if (!payload?.ok) {
    throw new Error(
      payload?.error ??
      'occurrence_resource_usage_failed',
    )
  }
}
