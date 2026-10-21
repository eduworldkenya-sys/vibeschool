import { createServerClient } from '@supabase/ssr'
import { NextRequest } from 'next/server'
import { object, uuid, WishError } from '@/lib/success-wishes/contracts'
import { database, failure, json, limit, reply } from '@/lib/success-wishes/server'
import { enabled } from '@/lib/success-wishes/security'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// School setup is an authenticated operation. Free sponsorship and payment
// activation are deliberately outside this endpoint's authority.
async function schoolAdmin(req: NextRequest, schoolId: string) {
  if (!enabled()) throw new WishError(503, 'School setup is not open yet.')
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
  await limit(`school-participation:${schoolId}:${user.id}`, 30, 900)
  return userDb
}

export async function GET(req: NextRequest) {
  try {
    const schoolId = uuid(req.nextUrl.searchParams.get('schoolId'))
    await schoolAdmin(req, schoolId)
    const { data, error } = await database().from('success_wishes_schools')
      .select('enabled,expires_at,sponsored_text').eq('school_id', schoolId).maybeSingle()
    if (error) throw error
    return reply({
      enabled: data?.enabled === true && Date.parse(data.expires_at) > Date.now(),
      sponsoredText: data?.sponsored_text === true,
      expiresAt: data?.expires_at || null,
    })
  } catch (error) { return failure(error) }
}

export async function POST(req: NextRequest) {
  try {
    const input = object(await json(req))
    const schoolId = uuid(input.schoolId)
    if (typeof input.optIn !== 'boolean' || typeof input.confirmSchoolConsent !== 'boolean') {
      throw new WishError(400, 'Confirm the school participation decision.')
    }
    const userDb = await schoolAdmin(req, schoolId)
    const { data, error } = await userDb.rpc('success_wishes_set_school_participation', {
      p_school_id: schoolId,
      p_opt_in: input.optIn,
      p_confirm_school_consent: input.confirmSchoolConsent,
    })
    if (error || data !== true) throw new WishError(403, 'The school participation change was not authorised.')
    return reply({ enabled: input.optIn, message: input.optIn
      ? 'School participation registered. Sending and payments remain subject to separate release controls.'
      : 'School participation disabled and candidate sessions revoked.' })
  } catch (error) { return failure(error) }
}
