import { NextRequest } from 'next/server'
import { actor, adminClient, consentEnabled, json, recordEvent } from '@/lib/learner/guardian-consent'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  if (!consentEnabled()) return json({ error: 'Consent management is unavailable.' }, 503)
  try {
    const admin = adminClient()
    const guardian = await actor(req, admin, 'parent')
    if (!guardian || !guardian.email_confirmed_at) return json({ error: 'Verified guardian required.' }, 401)
    const { data, error } = await admin.from('learner_guardian_consent_requests')
      .select('id,status,consent_purpose,approved_at,withdrawn_at')
      .eq('guardian_user_id', guardian.id).eq('guardian_email', (guardian.email ?? '').toLowerCase())
      .in('status', ['approved', 'withdrawn'])
      .order('approved_at', { ascending: false }).limit(30)
    if (error) throw error
    return json({ requests: data ?? [] })
  } catch {
    return json({ error: 'Cannot load consent history.' }, 500)
  }
}

export async function POST(req: NextRequest) {
  if (!consentEnabled()) return json({ error: 'Consent management is unavailable.' }, 503)
  try {
    const admin = adminClient()
    const guardian = await actor(req, admin, 'parent')
    if (!guardian || !guardian.email_confirmed_at) return json({ error: 'Verified guardian account required.' }, 401)
    const input = await req.json()
    if (typeof input.request_id !== 'string' || !/^[0-9a-f-]{36}$/i.test(input.request_id)) {
      return json({ error: 'Invalid consent request.' }, 400)
    }
    const { data: updated, error } = await admin.from('learner_guardian_consent_requests')
      .update({ status: 'withdrawn', withdrawn_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq('id', input.request_id).eq('guardian_user_id', guardian.id)
      .eq('guardian_email', (guardian.email ?? '').toLowerCase()).eq('status', 'approved')
      .select('id').maybeSingle()
    if (error || !updated) return json({ error: 'No active consent found for this guardian.' }, 404)
    await recordEvent(admin, updated.id, 'withdrawn', 'verified_guardian_withdrawal', guardian.id)
    return json({ ok: true, message: 'Consent withdrawn. Access dependent on this consent must remain restricted.' })
  } catch {
    return json({ error: 'Could not withdraw consent.' }, 500)
  }
}
