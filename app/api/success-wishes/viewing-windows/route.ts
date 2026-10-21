import { NextRequest } from 'next/server'
import { field, object, uuid, WishError } from '@/lib/success-wishes/contracts'
import { database, failure, json, limit, reply } from '@/lib/success-wishes/server'
import { schoolAdmin } from '@/lib/success-wishes/staff'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const HOURS = /^([01][0-9]|2[0-3]):[0-5][0-9]$/
const MAX_SLOTS_PER_SCHOOL = 14

function time(value: unknown): string {
  if (typeof value !== 'string' || !HOURS.test(value)) {
    throw new WishError(400, 'Enter a valid viewing time.')
  }
  return value
}

function parseWindow(value: unknown) {
  const b = object(value)
  const schoolId = uuid(b.schoolId)
  const weekday = b.weekday
  if (typeof weekday !== 'number' || !Number.isInteger(weekday) || weekday < 0 || weekday > 6) {
    throw new WishError(400, 'Choose a day of the week.')
  }
  const startsAt = time(b.startsAt), endsAt = time(b.endsAt)
  if (startsAt >= endsAt) throw new WishError(400, 'The finish time must be after the start time.')
  const venue = field(b.venue, 2, 120)
  const guidance = b.guidance === undefined || b.guidance === '' ? '' : field(b.guidance, 1, 320)
  if (b.isActive !== undefined && typeof b.isActive !== 'boolean') {
    throw new WishError(400, 'Choose whether the viewing time is active.')
  }
  return { schoolId, weekday, startsAt, endsAt, venue, guidance, isActive: b.isActive !== false }
}

export async function GET(req: NextRequest) {
  try {
    const schoolId = uuid(req.nextUrl.searchParams.get('schoolId'))
    await schoolAdmin(req, schoolId)
    const { data, error } = await database({ staffOnly: true }).from('success_wishes_viewing_windows')
      .select('id,weekday,starts_at,ends_at,venue,guidance,is_active')
      .eq('school_id', schoolId).order('weekday').order('starts_at').limit(25)
    if (error) throw error
    return reply({ windows: (data || []).map(w => ({
      id: w.id, weekday: w.weekday, startsAt: w.starts_at,
      endsAt: w.ends_at, venue: w.venue, guidance: w.guidance, isActive: w.is_active,
    })) })
  } catch (error) { return failure(error) }
}

export async function POST(req: NextRequest) {
  try {
    const input = parseWindow(await json(req))
    await schoolAdmin(req, input.schoolId)
    await limit('viewing-schedule:' + input.schoolId, 30, 900, true)
    const db = database({ staffOnly: true })
    const { data: existing, error: readError } = await db.from('success_wishes_viewing_windows')
      .select('weekday,starts_at,ends_at').eq('school_id', input.schoolId).limit(25)
    if (readError) throw readError
    if ((existing || []).length >= MAX_SLOTS_PER_SCHOOL) {
      throw new WishError(409, 'This school already has the maximum number of viewing sessions.')
    }
    // Avoid double-booking the same school device within a weekday.
    if ((existing || []).some(w => w.weekday === input.weekday
      && w.starts_at.slice(0,5) < input.endsAt && input.startsAt < w.ends_at.slice(0,5))) {
      throw new WishError(409, 'A viewing session already overlaps this time.')
    }
    const { data: inserted, error } = await db.from('success_wishes_viewing_windows')
      .insert({
        school_id: input.schoolId, weekday: input.weekday,
        starts_at: input.startsAt, ends_at: input.endsAt,
        venue: input.venue, guidance: input.guidance, is_active: input.isActive,
      }).select('id').single()
    if (error?.code === '23505') throw new WishError(409, 'This viewing time already exists.')
    if (error || !inserted) throw error || new Error('viewing_insert_failed')
    return reply({ ok: true, id: inserted.id }, 201)
  } catch (error) { return failure(error) }
}

export async function DELETE(req: NextRequest) {
  try {
    const b = object(await json(req))
    const schoolId = uuid(b.schoolId), id = uuid(b.id)
    await schoolAdmin(req, schoolId)
    await limit('viewing-schedule:' + schoolId, 30, 900, true)
    const { data, error } = await database({ staffOnly: true }).from('success_wishes_viewing_windows')
      .delete().eq('id', id).eq('school_id', schoolId).select('id').maybeSingle()
    if (error) throw error
    if (!data) throw new WishError(404, 'This viewing session is unavailable.')
    return reply({ ok: true })
  } catch (error) { return failure(error) }
}
