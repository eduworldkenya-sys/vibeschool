import { NextRequest } from 'next/server'
import { failure, reply, session } from '@/lib/success-wishes/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Private, candidate-session-only access. No student identifiers in the URL
// or response. Staff cannot use this API to impersonate a learner.
export async function GET(req: NextRequest) {
  try {
    const { db, inbox } = await session(req)
    const { data, error } = await db.from('success_wishes_viewing_windows')
      .select('weekday,starts_at,ends_at,venue,guidance')
      .eq('school_id', inbox.school_id).eq('is_active', true)
      .order('weekday').order('starts_at').limit(14)
    if (error) throw error
    return reply({
      timezone: 'Africa/Nairobi',
      windows: (data || []).map(w => ({
        weekday: w.weekday, startsAt: w.starts_at, endsAt: w.ends_at,
        venue: w.venue, guidance: w.guidance,
      })),
    })
  } catch (error) { return failure(error) }
}
