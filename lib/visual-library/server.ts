import { createHash, timingSafeEqual } from 'node:crypto'
import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js'

/** Browser bearer tokens are validated on every HQ operation; the service key never reaches the browser. */
export function visualAdminClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('VISUAL_LIBRARY_CONFIGURATION_MISSING')
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false } })
}

export type VisualHQAuth = { admin: SupabaseClient; user: User }
export async function requireVisualHQ(req: Request): Promise<VisualHQAuth | null> {
  const value = req.headers.get('authorization') || ''
  if (!value.startsWith('Bearer ')) return null
  const token = value.slice(7).trim()
  if (!token || token.length > 4096) return null
  const admin = visualAdminClient()
  const { data: { user }, error: userError } = await admin.auth.getUser(token)
  if (userError || !user) return null
  const { data: member, error } = await admin.from('hq_human_members')
    .select('role,status,permissions,access_expires_at')
    .eq('profile_id', user.id).maybeSingle()
  if (error || !member || member.status !== 'active') return null
  if (member.access_expires_at && Date.parse(member.access_expires_at) <= Date.now()) return null
  if (member.role !== 'founder' && !(Array.isArray(member.permissions) && member.permissions.includes('content.approve'))) return null
  return { admin, user }
}
/** Scope is intake and certified reference lookup only; never certification or publication. 
 * VIBESCHOOL_VISUAL_INTAKE_TOKEN must be a dedicated >=32-character server-only secret.
 * A missing secret disables machine intake rather than opening an anonymous fallback.
 */
export type VisualIntakeSession = { admin: SupabaseClient; userId: string | null; actor: 'hq_human' | 'scoped_operator' }
export async function requireVisualOperator(req: Request): Promise<VisualIntakeSession | null> {
  const secret = process.env.VIBESCHOOL_VISUAL_INTAKE_TOKEN
  const bearer = req.headers.get('authorization') || ''
  if (!secret || secret.length < 32 || !bearer.startsWith('Bearer ')) return null
  const supplied = bearer.slice(7).trim()
  if (!supplied || supplied.length > 4096) return null
  const actual = createHash('sha256').update(supplied).digest()
  const expected = createHash('sha256').update(secret).digest()
  if (!timingSafeEqual(actual, expected)) return null
  return { admin: visualAdminClient(), userId: null, actor: 'scoped_operator' }
}
export const visualJson = (data: unknown, status = 200) => Response.json(data, { status, headers: { 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' } })
