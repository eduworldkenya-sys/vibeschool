'use client'

import { supabase } from '@/lib/supabase'
import type { Json } from '@/lib/database.types'

type RpcResult<T> = { data: T | null; error: { message?: string } | null }
type Rpc = <T>(name: string, args?: Record<string, unknown>) => PromiseLike<RpcResult<T>>
const rpc = supabase.rpc.bind(supabase) as unknown as Rpc

function record(value: unknown): Record<string, unknown> { return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {} }
function text(value: unknown): string { return typeof value === 'string' ? value : '' }

export interface TwinCoreRouteResult {
  handled: boolean
  intent: string
  reply: string
  payload: Record<string, unknown>
  requiresAi: boolean
}

export interface TwinPrivateItem {
  id: string
  itemType: string
  title: string
  body: string
  subject: string
  topic: string
  visibility: 'private' | 'twin' | 'teacher' | string
  status: string
  tags: string[]
  updatedAt: string
}

function parseRouteResult(data: Json | null): TwinCoreRouteResult {
  const row = record(data)
  return {
    handled: row.handled === true,
    intent: text(row.intent) || 'ai_fallback',
    reply: text(row.reply),
    payload: record(row.payload),
    requiresAi: row.requires_ai === true,
  }
}

export async function routeTwinCore(input: string): Promise<TwinCoreRouteResult> {
  // Small deterministic facts are checked before the wider legacy router.
  // If the forward migration has not reached an environment yet, the existing
  // Twin remains available instead of turning a missing helper into an outage.
  const { data: factData, error: factError } = await rpc<Json>('student_twin_date_results_route', { p_input: input })
  if (!factError) {
    const factRoute = parseRouteResult(factData)
    if (factRoute.handled) return factRoute
  }

  const { data, error } = await rpc<Json>('student_twin_core_route', { p_input: input })
  if (error) throw new Error(error.message || 'Twin Core could not route that request.')
  return parseRouteResult(data)
}

export async function saveTwinPrivateItem(input: {
  itemType: 'note' | 'question' | 'goal' | 'bookmark' | 'draft' | 'ask_teacher_later' | 'journal'
  body: string
  title?: string
  subject?: string
  topic?: string
  tags?: string[]
  visibility?: 'private' | 'twin' | 'teacher'
}): Promise<Record<string, unknown>> {
  const { data, error } = await rpc<Json>('student_twin_save_private_item', {
    p_item_type: input.itemType,
    p_body: input.body,
    p_title: input.title ?? null,
    p_subject: input.subject ?? null,
    p_topic: input.topic ?? null,
    p_tags: input.tags ?? [],
    p_visibility: input.visibility ?? 'private',
  })
  if (error) throw new Error(error.message || 'Twin could not save that item.')
  return record(data)
}

export async function searchTwinPrivateSpace(query = '', limit = 20): Promise<TwinPrivateItem[]> {
  const { data, error } = await rpc<Json>('student_twin_search_private_space', { p_query: query || null, p_limit: limit })
  if (error) throw new Error(error.message || 'Twin could not search your private space.')
  const row = record(data)
  const items = Array.isArray(row.items) ? row.items : []
  return items.map(value => {
    const item = record(value)
    return {
      id: text(item.id), itemType: text(item.item_type), title: text(item.title), body: text(item.body), subject: text(item.subject), topic: text(item.topic), visibility: text(item.visibility), status: text(item.status), tags: Array.isArray(item.tags) ? item.tags.filter((tag): tag is string => typeof tag === 'string') : [], updatedAt: text(item.updated_at),
    }
  })
}
