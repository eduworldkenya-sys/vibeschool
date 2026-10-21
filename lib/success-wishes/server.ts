import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { WishError } from './contracts'
import { enabled, hashSecret, SESSION_COOKIE, staffReady } from './security'

// This module is only imported by Node API routes. Never expose its client to a browser.
export function database(options: { staffOnly?: boolean } = {}) {
  if (typeof window !== 'undefined') throw new Error('Server-only module')
  if (!(options.staffOnly ? staffReady() : enabled())) throw new WishError(503, 'Success Wishes is not open yet. Please try again later.')
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}
export function reply(value: unknown, status = 200) {
  return NextResponse.json(value, { status, headers: {
    'Cache-Control': 'private, no-store, max-age=0', 'Pragma': 'no-cache',
    'Referrer-Policy': 'no-referrer', 'X-Content-Type-Options': 'nosniff',
  } })
}
export function failure(error: unknown) {
  return error instanceof WishError ? reply({ error: error.message }, error.status)
    : reply({ error: 'We could not complete that request. Please try again.' }, 503)
}
export function sameOrigin(req: NextRequest) {
  const origin = req.headers.get('origin')
  if (!origin || origin !== req.nextUrl.origin) throw new WishError(403, 'Please open VibeSchool and try again.')
}
export async function json(req: NextRequest) {
  sameOrigin(req)
  if (!(req.headers.get('content-type') || '').startsWith('application/json')) throw new WishError(415, 'Use the message form to continue.')
  if (Number(req.headers.get('content-length')) > 16000) throw new WishError(413, 'This message is too large.')
  const reader = req.body?.getReader()
  if (!reader) throw new WishError(400, 'Check the details and try again.')
  const chunks: Uint8Array[] = []
  let length = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    length += value.byteLength
    if (length > 16000) { await reader.cancel(); throw new WishError(413, 'This message is too large.') }
    chunks.push(value)
  }
  const raw = Buffer.concat(chunks).toString('utf8')
  try { const parsed: unknown = JSON.parse(raw); return parsed } catch { throw new WishError(400, 'Check the details and try again.') }
}
export async function limit(key: string, max: number, seconds = 900, staffOnly = false) {
  const { data, error } = await database({ staffOnly }).rpc('success_wishes_take_attempt', {
    p_key_hash: hashSecret(key), p_limit: max, p_window_seconds: seconds,
  })
  if (error) throw new WishError(503, 'Please try again later.')
  if (data !== true) throw new WishError(429, 'Too many attempts. Please wait and try again.')
}
export async function session(req: NextRequest) {
  const secret = req.cookies.get(SESSION_COOKIE)?.value || ''
  if (!/^[a-f0-9]{64}$/.test(secret)) throw new WishError(401, 'Open your inbox using your school-issued code.')
  const db = database()
  const { data: active, error } = await db.from('success_wishes_sessions').select('inbox_id,access_epoch,expires_at').eq('token_hash', hashSecret(secret)).maybeSingle()
  if (error || !active || !(Date.parse(active.expires_at) > Date.now())) throw new WishError(401, 'Your session ended. Open your inbox again.')
  const { data: inbox } = await db.from('success_wishes_inboxes').select('id,school_id,student_id,access_epoch,expires_at').eq('id', active.inbox_id).maybeSingle()
  if (!inbox || inbox.access_epoch !== active.access_epoch || !(Date.parse(inbox.expires_at) > Date.now())) throw new WishError(401, 'Your session ended. Open your inbox again.')
  await eligible(db, inbox)
  return { db, inbox }
}

export async function eligible(db: ReturnType<typeof database>, inbox: { school_id: string; student_id: string }) {
  const { data: setting, error: settingError } = await db.from('success_wishes_schools')
    .select('school_id,schools!inner(status,deleted_at)').eq('school_id', inbox.school_id)
    .eq('enabled', true).gt('expires_at', new Date().toISOString())
    .is('schools.deleted_at', null).in('schools.status', ['active', 'pending']).maybeSingle()
  const { data: enrollments, error: enrollmentError } = await db.from('student_classes')
    .select('id,classes!inner(school_id),students!inner(deleted_at)')
    .eq('student_id', inbox.student_id).eq('school_id', inbox.school_id)
    .eq('is_current', true).is('left_at', null).eq('classes.school_id', inbox.school_id)
    .is('students.deleted_at', null).limit(2)
  if (settingError || enrollmentError) throw new WishError(503, 'We could not verify this inbox. Please try again.')
  if (!setting || !enrollments?.length) throw new WishError(401, 'This inbox is no longer available. Check with your school.')
}
