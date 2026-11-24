import { randomBytes } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { identityClient } from '@/lib/identity/server'
import { validSameOriginMutation } from '@/lib/identity/origin'
import { unifiedIdentityEnabled } from '@/lib/identity/features'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
const headers = { 'Cache-Control': 'private, no-store', 'Referrer-Policy': 'no-referrer' }
const ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
function result(body: unknown, status: number) {
  return NextResponse.json(body, { status, headers })
}

/** Recover a child login from the existing guardian's verified session.
 * Never expose current passwords or alter school roles, grades or progress.
 */
export async function POST(request: NextRequest) {
  if (!unifiedIdentityEnabled) return result({ error: 'Unavailable' }, 503)
  if (!validSameOriginMutation(request)) return result({ error: 'Request origin rejected' }, 403)
  if (Number(request.headers.get('content-length') || 0) > 2048) {
    return result({ error: 'Request too large' }, 413)
  }
  const payload = await request.json().catch(() => null)
  const identityId = typeof payload?.identityId === 'string' ? payload.identityId.trim() : ''
  if (!ID.test(identityId) || payload?.confirmReset !== true) {
    return result({ error: 'Confirm which child needs a new password' }, 400)
  }
  const db = await identityClient()
  const { data: { user }, error: authError } = await db.auth.getUser()
  if (authError || !user?.email_confirmed_at) {
    return result({ error: 'Verified sign-in required' }, 401)
  }
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return result({ error: 'Password recovery unavailable' }, 503)
  }
  // The atomic RPC enforces active guardian ownership, a live family link,
  // and an explicit per-child reset budget before any privileged Auth action.
  const { data: childAuthUserId, error: authorityError } = await db.rpc(
    'vs_authorize_managed_password_reset', { p_identity_id: identityId },
  )
  if (authorityError || typeof childAuthUserId !== 'string' || !ID.test(childAuthUserId)) {
    return result({ error: authorityError?.code === '54000'
      ? 'Please wait before resetting this learner password again.'
      : 'You cannot reset this learner password.' },
      authorityError?.code === '54000' ? 429 : 403)
  }
  const password = randomBytes(24).toString('base64url')
  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const { data: updated, error: resetError } =
    await admin.auth.admin.updateUserById(childAuthUserId, { password })
  if (resetError || updated?.user?.id !== childAuthUserId) {
    // The attempt is already rate-limited. Do not return a password that
    // the Auth provider has not confirmed, or log either credential.
    return result({ error: 'Password recovery failed. Try again later.' }, 503)
  }
  return result({ reset: true, password }, 200)
}
