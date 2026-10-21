import { NextRequest } from 'next/server'
import { object, uuid, WishError } from '@/lib/success-wishes/contracts'
import { database, failure, json, reply } from '@/lib/success-wishes/server'
import { schoolAdmin } from '@/lib/success-wishes/staff'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Moderators receive report details only, never child message text or media.
export async function GET(req: NextRequest) {
  try {
    const schoolId = uuid(req.nextUrl.searchParams.get('schoolId'))
    await schoolAdmin(req, schoolId)
    const { data, error } = await database({ staffOnly: true }).from('success_wishes_reports')
      .select('id,reason,status,created_at,success_wishes_inboxes!inner(school_id)')
      .eq('success_wishes_inboxes.school_id', schoolId)
      .eq('status', 'open').order('created_at', { ascending: false }).limit(50)
    if (error) throw error
    const reports = (data || []).map(item => ({
      id: item.id, reason: item.reason, createdAt: item.created_at, status: item.status,
    }))
    return reply({ reports })
  } catch (error) { return failure(error) }
}

export async function POST(req: NextRequest) {
  try {
    const input = object(await json(req))
    const schoolId = uuid(input.schoolId), reportId = uuid(input.reportId)
    const userDb = await schoolAdmin(req, schoolId)
    const { data, error } = await userDb.rpc('success_wishes_resolve_report', {
      p_school_id: schoolId, p_report_id: reportId,
    })
    if (error) throw new WishError(403, 'Report resolution was not authorised.')
    if (data !== true) throw new WishError(404, 'This report is unavailable.')
    return reply({ ok: true })
  } catch (error) { return failure(error) }
}
