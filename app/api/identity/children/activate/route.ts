import { randomBytes } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { identityClient } from '@/lib/identity/server'
import { unifiedIdentityEnabled } from '@/lib/identity/features'
import { validSameOriginMutation } from '@/lib/identity/origin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
const headers = { 'Cache-Control': 'private, no-store', 'Referrer-Policy': 'no-referrer' }
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const GRADES = new Set([
  'PP1','PP2','Grade 1','Grade 2','Grade 3','Grade 4','Grade 5',
  'Grade 6','Grade 7','Grade 8','Grade 9','Grade 10','Grade 11',
  'Grade 12','Form 1','Form 2','Form 3','Form 4',
])
function response(body: unknown, status: number) {
  return NextResponse.json(body, { status, headers })
}

/** Creates a real, isolated student login for an already guardian-owned profile.
 * No school/class record and no additional guardian email/approval are required.
 */
export async function POST(request: NextRequest) {
  if (!unifiedIdentityEnabled) return response({ error: 'Not available yet' }, 503)
  if (!validSameOriginMutation(request)) return response({ error: 'Request origin rejected' }, 403)
  if (Number(request.headers.get('content-length') || 0) > 2048) {
    return response({ error: 'Request too large' }, 413)
  }
  const body = await request.json().catch(() => null)
  const identityId = typeof body?.identityId === 'string' ? body.identityId.trim() : ''
  const grade = typeof body?.grade === 'string' ? body.grade.trim() : ''
  if (!UUID.test(identityId) || !GRADES.has(grade) || body?.confirmGuardian !== true) {
    return response({ error: 'Select the child, learning level, and confirm guardianship' }, 400)
  }

  const db = await identityClient()
  const { data: { user }, error: userError } = await db.auth.getUser()
  if (userError || !user?.email_confirmed_at) {
    return response({ error: 'Sign in with your verified account' }, 401)
  }
  // First prove ownership through the session-scoped, read-only identity RPC.
  // Never create an Auth user solely from an untrusted child identifier.
  const { data: family, error: familyError } = await db.rpc('vs_list_my_identities')
  if (familyError || !family || typeof family !== 'object' || Array.isArray(family)) {
    return response({ error: 'Child profiles are temporarily unavailable' }, 503)
  }
  const children = Array.isArray(family.managed_learners) ? family.managed_learners : []
  const child = children.find((value: unknown): boolean => {
    if (!value || typeof value !== 'object') return false
    const entry = value as { id?: unknown; status?: unknown; username?: unknown }
    return entry.id === identityId && entry.status === 'managed'
      && typeof entry.username === 'string'
  }) as { id: string; username: string; display_name?: string } | undefined
  if (!child || !/^[a-z][a-z0-9_]{2,23}$/.test(child.username)) {
    return response({ error: 'This child is not available for activation' }, 403)
  }
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceRoleKey) return response({ error: 'Account setup unavailable' }, 503)
  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const password = randomBytes(18).toString('base64url')
  const email = `${child.username}@vs.internal`
  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email, password, email_confirm: true,
    user_metadata: { full_name: child.display_name || 'Learner' },
  })
  if (createError || !created.user) {
    // Do not reveal whether an email exists or which guardian owns it.
    return response({ error: 'Could not create this learner login. Please retry or contact support.' }, 409)
  }
  const newUserId = created.user.id
  try {
    // PostgreSQL validates the real signed-in guardian and writes the profile,
    // student, family link and identity atomically under a locked child row.
    const { data, error } = await db.rpc('vs_activate_managed_student', {
      p_identity_id: identityId,
      p_child_auth_user_id: newUserId,
      p_grade: grade,
    })
    if (error || !data || typeof data !== 'object' || Array.isArray(data) ||
        typeof data.student_id !== 'string') {
      throw new Error('Child transaction did not complete')
    }
    // Return password once, with no-store. It is never saved to the database
    // or put in a URL, log, email, or another household member's account.
    return response({
      activated: true,
      studentId: data.student_id,
      loginId: child.username,
      password,
    }, 201)
  } catch {
    // A network failure can occur AFTER PostgreSQL commits. A blind Auth
    // deletion at that point could orphan a valid child login and its records.
    // Recover only when an authoritative guardian-scoped RPC confirms the
    // committed child belongs to the exact Auth user created here.
    try {
      const { data: linkedUserId, error: linkedError } = await db.rpc('vs_my_managed_student_login', {
        p_identity_id: identityId,
      })
      if (!linkedError && linkedUserId === newUserId) {
        const { data: refreshed, error: refreshError } = await db.rpc('vs_list_my_identities')
        const childrenNow = refreshed && typeof refreshed === 'object' && !Array.isArray(refreshed) &&
          Array.isArray(refreshed.managed_learners) ? refreshed.managed_learners : []
        const linked = childrenNow.find((entry: unknown) =>
          !!entry && typeof entry === 'object' &&
          (entry as { id?: unknown }).id === identityId &&
          (entry as { status?: unknown }).status === 'linked' &&
          typeof (entry as { linked_student_id?: unknown }).linked_student_id === 'string')
        if (!refreshError && linked) {
          return response({
            activated: true,
            studentId: (linked as { linked_student_id: string }).linked_student_id,
            loginId: child.username,
            password,
          }, 201)
        }
      }
      // An unknown database outcome must be recovered deliberately. Never
      // delete a potentially committed learner account on a timed-out read.
      if (linkedError && linkedError.code !== 'PGRST202') {
        return response({ error: 'Learner setup needs recovery. No password has been disclosed.' }, 503)
      }
    } catch {
      return response({ error: 'Learner setup needs recovery. No password has been disclosed.' }, 503)
    }
    const { error: rollbackError } = await admin.auth.admin.deleteUser(newUserId)
    if (rollbackError) {
      return response({ error: 'Setup requires support to recover safely. No login details were issued.' }, 503)
    }
    return response({ error: 'Could not finish learner setup. Please retry.' }, 409)
  }
}
