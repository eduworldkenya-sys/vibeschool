import { NextRequest } from 'next/server'
import { adminClient, json } from '@/lib/learner/guardian-consent'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const ALLOWED = ['founder', 'partner_admin', 'hq_admin', 'reviewer']

export async function GET(req: NextRequest) {
  try {
    const token = (req.headers.get('authorization') ?? '').replace(/^Bearer /, '')
    if (!token) return json({ error: 'Sign in to HQ.' }, 401)
    const admin = adminClient()
    const { data: { user }, error: authError } = await admin.auth.getUser(token)
    if (authError || !user) return json({ error: 'Unauthorized.' }, 401)
    const { data: member } = await admin.from('hq_human_members')
      .select('role,status,access_expires_at,suspended_at,revoked_at')
      .eq('profile_id', user.id).maybeSingle()
    if (!member || !ALLOWED.includes(member.role) || member.status !== 'active' ||
      member.suspended_at || member.revoked_at ||
      (member.access_expires_at && Date.parse(member.access_expires_at) <= Date.now())) {
      return json({ error: 'Authorized safeguarding staff only.' }, 403)
    }
    const states = ['pending', 'approved', 'rejected', 'withdrawn', 'expired', 'review_required']
    const counts = await Promise.all(states.map(async status => {
      const { count, error } = await admin.from('learner_guardian_consent_requests')
        .select('id', { count: 'exact', head: true }).eq('status', status)
      if (error) throw error
      return { status, count: count ?? 0 }
    }))
    // Counts only. No learner emails, guardian contacts, tokens or identity documents.
    return json({ counts, total: counts.reduce((sum, item) => sum + item.count, 0) })
  } catch {
    return json({ error: 'Could not load consent totals.' }, 500)
  }
}
