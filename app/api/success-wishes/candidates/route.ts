import { createServerClient } from '@supabase/ssr'
import { NextRequest } from 'next/server'
import { uuid, WishError } from '@/lib/success-wishes/contracts'
import { database, failure, limit, reply } from '@/lib/success-wishes/server'
import { staffReady } from '@/lib/success-wishes/security'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// School staff only. Public senders must never receive a student directory.
export async function GET(req: NextRequest) {
  try {
    if (!staffReady()) throw new WishError(503, 'Success Wishes is not open yet.')
    const schoolId = uuid(req.nextUrl.searchParams.get('schoolId'))
    const query = (req.nextUrl.searchParams.get('q') || '').trim()
    if (query.length < 2 || query.length > 80 || /[\u0000-\u001f]/.test(query)) {
      throw new WishError(400, 'Enter at least two letters from the candidate name.')
    }
    const userDb = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { getAll: () => req.cookies.getAll(), setAll: () => {} } },
    )
    const { data: { user }, error: authError } = await userDb.auth.getUser()
    if (authError || !user) throw new WishError(401, 'Sign in as authorised school staff.')
    const { data: isAdmin, error: roleError } = await userDb.rpc('is_school_admin', { p_school_id: schoolId })
    if (roleError || isAdmin !== true) throw new WishError(403, 'Your account cannot search candidates at this school.')
    const { data: profile, error: profileError } = await userDb.from('profiles')
      .select('account_status,is_anonymized').eq('id', user.id).maybeSingle()
    if (profileError || !profile || profile.account_status !== 'active' || profile.is_anonymized) {
      throw new WishError(403, 'Your school account cannot access candidate records.')
    }
    await limit(`candidate-search:${schoolId}:${user.id}`, 30, 60, true)
    const clean = query.replace(/[%_,()\\]/g, '')
    if (clean.length < 2) throw new WishError(400, 'Enter a candidate name.')
    const { data, error } = await database({ staffOnly: true }).from('student_classes')
      .select('student_id,students!inner(id,name,admission_number,deleted_at),classes!inner(school_id)')
      .eq('school_id', schoolId)
      .eq('classes.school_id', schoolId)
      .eq('is_current', true).is('left_at', null)
      .is('students.deleted_at', null)
      .ilike('students.name', `%${clean}%`)
      .limit(20)
    if (error) throw error
    const seen = new Set<string>()
    const candidates = (data || []).flatMap(row => {
      const s: unknown = Array.isArray(row.students) ? row.students[0] : row.students
      if (!s || typeof s !== 'object' || !('id' in s) || !('name' in s)
          || typeof s.id !== 'string' || typeof s.name !== 'string' || seen.has(s.id)) return []
      seen.add(s.id)
      return [{ id: s.id, name: s.name, admissionNumber:
        'admission_number' in s && typeof s.admission_number === 'string' ? s.admission_number : null }]
    })
    return reply({ candidates })
  } catch (error) { return failure(error) }
}
