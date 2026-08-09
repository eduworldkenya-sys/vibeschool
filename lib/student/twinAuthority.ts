import { supabase } from '@/lib/supabase'
import type { Json } from '@/lib/database.types'

type RpcResult<T> = { data: T | null; error: { message?: string } | null }
type Rpc = <T>(name: string, args?: Record<string, unknown>) => PromiseLike<RpcResult<T>>
const rpc = supabase.rpc.bind(supabase) as unknown as Rpc

export interface LearnerTwinChatMessage { role: 'user' | 'assistant'; content: string }

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
}
function text(value: unknown): string | null { return typeof value === 'string' ? value : null }

/** Session-aware Twin chat transport. Server-side entitlement is authoritative. */
export async function askLearnerTwinWithSession(input: { messages: LearnerTwinChatMessage[]; firstName: string; sessionId: string }): Promise<string> {
  const sessionId = input.sessionId.trim()
  if (!sessionId) throw new Error('Twin session identity is required.')
  const { data, error } = await supabase.functions.invoke('twin-chat', {
    body: { role: 'student', firstName: input.firstName, messages: input.messages.slice(-10), sessionId },
  })
  if (error) throw new Error(error.message || 'Your Twin could not respond.')
  const payload = record(data as Json)
  const reply = text(payload.reply)
  if (!reply) throw new Error(text(payload.message) || text(payload.error) || 'Your Twin could not respond.')
  return reply
}

/** Typed low-level RPC helper retained for future Twin authority adapters. */
export async function callStudentTwinPolicyRpc<T>(name: string, args?: Record<string, unknown>): Promise<T> {
  const { data, error } = await rpc<T>(name, args)
  if (error) throw new Error(error.message || `${name} failed.`)
  return data as T
}
