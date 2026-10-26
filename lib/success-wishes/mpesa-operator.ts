// Verify the actual signed-in HQ founder. A service-role secret by itself does not
// prove caller authority. The admin key stays server-side and is never returned.
import { createClient } from '@supabase/supabase-js'

export async function verifiedFounderOperator(req: Request): Promise<boolean> {
  const header = req.headers.get('authorization') ?? ''
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : ''
  if (!token) return false
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceRoleKey) return false
  try {
    const admin = createClient(url, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
    })
    const { data: userResult, error: userError } = await admin.auth.getUser(token)
    const user = userResult.user
    if (userError || !user) return false
    const { data: member, error: memberError } = await admin
      .from('hq_human_members')
      .select('role,status,access_expires_at')
      .eq('profile_id', user.id)
      .maybeSingle()
    if (memberError || !member) return false
    if (member.role !== 'founder' || member.status !== 'active') return false
    if (member.access_expires_at &&
      !(Date.parse(member.access_expires_at) > Date.now())) return false
    return true
  } catch {
    return false
  }
}
