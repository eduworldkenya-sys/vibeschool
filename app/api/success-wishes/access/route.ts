import { createServerClient } from '@supabase/ssr'
import { NextRequest } from 'next/server'
import { object, uuid, WishError } from '@/lib/success-wishes/contracts'
import { failure, json, reply } from '@/lib/success-wishes/server'
import { staffReady } from '@/lib/success-wishes/security'
export async function POST(req: NextRequest) {
  try {
    if (!staffReady()) throw new WishError(503, 'Success Wishes is not open yet.')
    const b = object(await json(req)), schoolId = uuid(b.schoolId), studentId = uuid(b.studentId)
    const response = reply({})
    const db = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
      cookies: { getAll: () => req.cookies.getAll(), setAll: values => values.forEach(({ name, value, options }) => response.cookies.set(name, value, options)) },
    })
    const { data: { user }, error: authError } = await db.auth.getUser()
    if (authError || !user) throw new WishError(401, 'Sign in with your authorised school account.')
    const { data, error } = await db.rpc('success_wishes_reset_access', { p_school_id: schoolId, p_student_id: studentId })
    if (error) throw new WishError(403, 'Your school account cannot issue access for this learner, or the school is not participating.')
    const issued = object(data)
    const result = reply({ code: issued.access_code, expiresAt: issued.expires_at })
    response.cookies.getAll().forEach(cookie => result.cookies.set(cookie))
    return result
  } catch (error) { return failure(error) }
}
