import { NextRequest } from 'next/server'
import { field, object, WishError } from '@/lib/success-wishes/contracts'
import { database, failure, json, reply, takeAttempt } from '@/lib/success-wishes/server'
import { hashSecret } from '@/lib/success-wishes/security'
import { senderPhone } from '@/lib/success-wishes/phone-verification'
import { nameKey } from '@/lib/success-wishes/receiver-pin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// A lost-link request proves no account ownership. It must never create a session,
// reset a PIN, reveal matching accounts or expose a private card.
export async function POST(req: NextRequest) {
  try {
    const body = object(await json(req))
    const phone = senderPhone(body.phone)
    const name = nameKey(field(body.name, 1, 100))
    const year = field(body.examYear, 4, 4)
    if (!name || !/^20\d{2}$/.test(year)) throw new WishError(400, 'Enter the learner details.')
    const phoneDigest = hashSecret('success-wishes:recovery-review:phone:' + phone)
    const nameDigest = hashSecret('success-wishes:recovery-review:name:' + name)
    await takeAttempt(database(), 'pin-recovery-review:global', 200, 86400)
    await takeAttempt(database(), 'pin-recovery-review:' + phoneDigest, 3, 86400)
    const { error } = await database().from('success_wish_recovery_reviews').insert({
      phone_digest: phoneDigest, name_digest: nameDigest, exam_year: year,
    })
    if (error) throw new WishError(503, 'Could not record the recovery request.')
    return reply({ ok: true, message: 'Request received. Access is not changed. Support must independently verify the adult or guardian before any recovery.' })
  } catch (error) { return failure(error) }
}
