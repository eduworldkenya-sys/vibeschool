import { NextRequest } from 'next/server'
import { object, uuid, WishError } from '@/lib/success-wishes/contracts'
import { database, failure, json, reply } from '@/lib/success-wishes/server'
import { schoolAdmin } from '@/lib/success-wishes/staff'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const schoolId = uuid(req.nextUrl.searchParams.get('schoolId'))
    await schoolAdmin(req, schoolId)
    const { data, error } = await database({ staffOnly: true }).from('success_wishes_schools')
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
