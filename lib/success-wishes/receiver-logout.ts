import { NextRequest } from 'next/server'
import { revocationDatabase, failure, reply, sameOrigin } from './server'
import { RECEIVER_COOKIE, sessionDigest } from './receiver'
import { INBOX_COOKIE, inboxCookie, inboxDigest } from './receiver-otp'

/** Both entry points clear both receiver capabilities, independently of public activation. */
export async function logoutReceiver(req: NextRequest) {
  try { sameOrigin(req) } catch (error) { return failure(error) }
  let error: unknown
  const card = req.cookies.get(RECEIVER_COOKIE)?.value || ''
  const inbox = req.cookies.get(INBOX_COOKIE)?.value || ''
  try {
    if (/^[a-f0-9]{64}$/.test(card) || /^[a-f0-9]{64}$/.test(inbox)) {
      const db = revocationDatabase()
      const results = await Promise.all([
        /^[a-f0-9]{64}$/.test(card) ? db.from('success_wish_card_sessions').delete().eq('token_hash', sessionDigest(card)) : null,
        /^[a-f0-9]{64}$/.test(inbox) ? db.from('success_wish_receiver_sessions').delete().eq('token_hash', inboxDigest(inbox)) : null,
      ])
      error = results.find(result => result?.error)?.error
    }
  } catch (reason) { error = reason }
  const response = error ? failure(error) : reply({ ok: true })
  for (const name of [RECEIVER_COOKIE, INBOX_COOKIE]) response.cookies.set(name, '', inboxCookie(req, 0))
  return response
}
