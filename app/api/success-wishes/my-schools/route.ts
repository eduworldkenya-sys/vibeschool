import { createServerClient } from '@supabase/ssr'
import { NextRequest } from 'next/server'
import { WishError } from '@/lib/success-wishes/contracts'
import { database, failure, limit, reply } from '@/lib/success-wishes/server'
import { staffReady } from '@/lib/success-wishes/security'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    if (!staffReady()) throw new WishError(503, 'School setup is not open yet.')
    const userDb = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { getAll: () => req.cookies.getAll(), setAll: () => {} } },
    )
    const { data: { user }, error: authError } = await userDb.auth.getUser()
    if (authError || !user) throw new WishError(401, 'Sign in as school administrator.')
    const { data: profile, error: profileError } = await userDb.from('profiles')
      .select('account_status,is_anonymized').eq('id', user.id).maybeSingle()
    if (profileError || !profile || profile.account_status !== 'active' || profile.is_anonymized) {
      throw new WishError(403, 'An active school administrator is required.')
    }
    await limit(`my-wishes-schools:${user.id}`, 30, 900, true)
    const { data, error } = await database({ staffOnly: true }).from('school_members')
      .select('school_id,schools!inner(id,name,status,deleted_at)')
      .eq('profile_id', user.id).eq('role', 'admin')
      .eq('schools.status', 'active').is('schools.deleted_at', null).limit(50)
    if (error) throw error
    const schools = (data || []).flatMap(row => {
      const s: unknown = Array.isArray(row.schools) ? row.schools[0] : row.schools
      return s && typeof s === 'object' && 'id' in s && 'name' in s
        && typeof s.id === 'string' && typeof s.name === 'string'
        ? [{ id: s.id, name: s.name }] : []
    })
    return reply({ schools })
  } catch (error) { return failure(error) }
}
