import { NextRequest } from 'next/server'
import { field, object, uuid, WishError } from '@/lib/success-wishes/contracts'
import { database, eligible, failure, json, limit, reply, sameOrigin } from '@/lib/success-wishes/server'
import { accessHash, equalHash, hashSecret, SESSION_COOKIE, SESSION_SECONDS, token } from '@/lib/success-wishes/security'
export const runtime = 'nodejs'
export async function POST(req: NextRequest) {
  try {
    const b = object(await json(req)), schoolId = uuid(b.schoolId)
    const admission = field(b.admissionNumber, 1, 80), code = field(b.code, 32, 32).toUpperCase()
    if (!/^[0-9A-F]{32}$/.test(code)) throw new WishError(401, 'Check your school, admission number and access code.')
    await limit('unlock:global', 1000, 60)
    await limit(`unlock:${schoolId}:${admission.toLowerCase()}`, 8)
    await limit(`unlock-school:${schoolId}`, 500)
    const db = database()
    const { data: setting } = await db.from('success_wishes_schools').select('school_id').eq('school_id', schoolId).eq('enabled', true).gt('expires_at', new Date().toISOString()).maybeSingle()
    const { data: candidates, error } = await db.from('success_wishes_inboxes').select('id,school_id,student_id,access_code_hash,access_epoch,expires_at,students!inner(admission_number,deleted_at)').eq('school_id', schoolId).eq('students.admission_number', admission).is('students.deleted_at', null).limit(2)
    if (error) throw error
    const inbox = candidates?.length === 1 ? candidates[0] : null
    if (!setting || !inbox || !(Date.parse(inbox.expires_at) > Date.now()) || !equalHash(accessHash(code), inbox.access_code_hash)) throw new WishError(401, 'Check your school, admission number and access code.')
    await eligible(db, inbox)
    const secret = token()
    const expiry = new Date(Math.min(Date.now() + SESSION_SECONDS * 1000, Date.parse(inbox.expires_at)))
    const { error: insertError } = await db.from('success_wishes_sessions').insert({ token_hash: hashSecret(secret), inbox_id: inbox.id, access_epoch: inbox.access_epoch, expires_at: expiry.toISOString() })
    if (insertError) throw insertError
    const response = reply({ ok: true })
    response.cookies.set(SESSION_COOKIE, secret, { httpOnly: true, secure: req.nextUrl.protocol === 'https:', sameSite: 'strict', path: '/api/success-wishes', maxAge: Math.floor((expiry.getTime() - Date.now()) / 1000) })
    return response
  } catch (error) { return failure(error) }
}
export async function DELETE(req: NextRequest) {
  try {
    sameOrigin(req)
    const secret = req.cookies.get(SESSION_COOKIE)?.value
    if (secret) {
      const { error } = await database().from('success_wishes_sessions').delete().eq('token_hash', hashSecret(secret))
      if (error) throw error
    }
    const response = reply({ ok: true })
    response.cookies.set(SESSION_COOKIE, '', { httpOnly: true, secure: req.nextUrl.protocol === 'https:', sameSite: 'strict', path: '/api/success-wishes', maxAge: 0 })
    return response
  } catch (error) {
    const response = failure(error)
    // A failed database revocation must never leave a reusable cookie on this device.
    // Preserve the error so the client does not falsely claim server-side revocation.
    if (req.headers.get('origin') === req.nextUrl.origin) {
      response.cookies.set(SESSION_COOKIE, '', {
        httpOnly: true, secure: req.nextUrl.protocol === 'https:', sameSite: 'strict',
        path: '/api/success-wishes', maxAge: 0,
      })
    }
    return response
  }
}
