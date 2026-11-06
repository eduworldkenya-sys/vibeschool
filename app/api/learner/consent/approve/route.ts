import { NextRequest } from 'next/server'
import {
  actor, adminClient, consentEnabled, json, readToken, recordEvent, tokenHash,
} from '@/lib/learner/guardian-consent'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

async function resolve(req: NextRequest, raw: unknown) {
  const admin = adminClient()
  const guardian = await actor(req, admin, 'parent')
  if (!guardian || !guardian.email || !guardian.email_confirmed_at) return null
  const token = readToken(raw)
  if (!token) return null
  const { data } = await admin.from('learner_guardian_consent_requests')
    .select('id,learner_user_id,guardian_email,guardian_name,guardian_relationship,consent_purpose,policy_version,token_expires_at')
    .eq('token_hash', tokenHash(token)).eq('status', 'pending')
    .not('learner_email_verified_at', 'is', null)
    .gt('token_expires_at', new Date().toISOString()).maybeSingle()
  if (!data || data.guardian_email !== guardian.email.toLowerCase() ||
      data.learner_user_id === guardian.id || data.consent_purpose !== 'personal_learning') return null
  return { admin, guardian, request: data, token }
}

export async function GET(req: NextRequest) {
  if (!consentEnabled()) return json({ error: 'Consent review is unavailable.' }, 503)
  try {
    const resolved = await resolve(req, req.nextUrl.searchParams.get('token'))
    if (!resolved) return json({ error: 'Sign in with the invited, verified guardian email, or request another link.' }, 403)
    const { request } = resolved
    return json({
      request: {
        purpose: 'personal_learning',
        relationship: request.guardian_relationship,
        policy_version: request.policy_version,
        expires_at: request.token_expires_at,
      },
    })
  } catch {
    return json({ error: 'Could not load consent request.' }, 500)
  }
}

export async function POST(req: NextRequest) {
  if (!consentEnabled()) return json({ error: 'Consent review is unavailable.' }, 503)
  try {
    const input = await req.json()
    if (input.declare_guardianship !== true || input.allow_personal_learning !== true) {
      return json({ error: 'You must explicitly confirm guardianship and consent.' }, 400)
    }
    const resolved = await resolve(req, input.token)
    if (!resolved) return json({ error: 'The approval link is invalid, expired, or belongs to another account.' }, 403)
    const { admin, guardian, request, token } = resolved
    const now = new Date().toISOString()
    const { data: approved, error } = await admin.from('learner_guardian_consent_requests')
      .update({
        status: 'approved', guardian_user_id: guardian.id, guardian_email_verified_at: now,
        declared_guardianship_at: now, approved_at: now,
        token_hash: null, updated_at: now,
      })
      .eq('id', request.id).eq('status', 'pending').eq('token_hash', tokenHash(token))
      .gt('token_expires_at', now).not('learner_email_verified_at', 'is', null)
      .select('id').maybeSingle()
    if (error || !approved) return json({ error: 'This request was already handled or expired.' }, 409)
    await recordEvent(admin, approved.id, 'guardianship_declared', 'verified_parent_account_declaration', guardian.id)
    await recordEvent(admin, approved.id, 'approved', 'confirmed_guardian_email_and_declaration', guardian.id)
    return json({ ok: true, message: 'Consent recorded for personal learning only.' })
  } catch {
    return json({ error: 'Could not complete consent review.' }, 500)
  }
}
