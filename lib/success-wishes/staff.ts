import { createServerClient } from '@supabase/ssr'
import { NextRequest } from 'next/server'
import { WishError } from './contracts'
import { limit } from './server'
import { staffReady } from './security'

export async function schoolAdmin(req: NextRequest, schoolId: string) {
  if (!staffReady()) throw new WishError(503, 'School setup is not open yet.')
  const userDb = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => req.cookies.getAll(), setAll: () => {} } },
  )
  const { data: { user }, error: authError } = await userDb.auth.getUser()
  if (authError || !user) throw new WishError(401, 'Sign in as school administrator.')
  const { data: authorised, error: roleError } = await userDb.rpc('is_school_admin', { p_school_id: schoolId })
  if (roleError || authorised !== true) throw new WishError(403, 'You cannot manage this school.')
  const { data: profile, error: profileError } = await userDb.from('profiles')
    .select('account_status,is_anonymized').eq('id', user.id).maybeSingle()
  if (profileError || !profile || profile.account_status !== 'active' || profile.is_anonymized) {
    throw new WishError(403, 'An active school administrator is required.')
  }
  await limit(`school-wishes-admin:${schoolId}:${user.id}`, 90, 900, true)
  return userDb
}
