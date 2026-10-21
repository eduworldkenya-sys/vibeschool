import { NextRequest } from 'next/server'
import { sameSavedTextSubmission, submission, WishError } from '@/lib/success-wishes/contracts'
import { database, failure, json, limit, reply } from '@/lib/success-wishes/server'
import { hashSecret, messageExpiry } from '@/lib/success-wishes/security'
export const runtime = 'nodejs'
export async function POST(req: NextRequest) {
  try {
    const input = submission(await json(req))
    const db = database()
    await limit('submission:global', 1000, 60)
    await limit(`submit:${input.schoolId}`, 100, 60)
    await limit(`recipient:${input.schoolId}:${input.admissionNumber.toLowerCase()}`, 20)
    const { data: school, error } = await db.from('success_wishes_schools').select('sponsored_text,sponsored_text_until,retention_days,expires_at').eq('school_id', input.schoolId).eq('enabled', true).gt('expires_at', new Date().toISOString()).maybeSingle()
    if (error) throw error
    if (!school) throw new WishError(503, 'Sending is not available for this school.')
    if (input.kind !== 'text') throw new WishError(503, 'Voice and video sending are not open yet.')
    if (!school.sponsored_text || !(Date.parse(school.sponsored_text_until || '') > Date.now())) throw new WishError(503, 'Sponsored sending is not available for this school. No payment has been taken.')
    const { data: inboxId, error: matchError } = await db.rpc('success_wishes_match_recipient', { p_school_id: input.schoolId, p_admission_number: input.admissionNumber, p_name: input.candidateName })
    if (matchError) throw matchError
    // Generic non-enumerating result: do not identify whether a learner/inbox exists.
    if (typeof inboxId !== 'string') throw new WishError(400, 'We could not send using those details. Please check with the school.')
    const manageToken = hashSecret('success-wishes:manage:' + input.idempotencyKey)
    const message = {
      inbox_id: inboxId, sender_name: input.senderName, relationship: input.relationship,
      format: 'text', body: input.text, management_token_hash: hashSecret(manageToken),
      idempotency_key: input.idempotencyKey, payment_status: 'sponsored', state: 'request',
      expires_at: messageExpiry(school.retention_days, school.expires_at),
    }
    const { data: inserted, error: insertError } = await db.from('success_wishes_messages').insert(message).select('id').single()
    if (insertError?.code === '23505') {
      const { data: previous, error: retryError } = await db.from('success_wishes_messages')
        .select('id,state,sender_name,relationship,format,body').eq('idempotency_key', input.idempotencyKey)
        .eq('management_token_hash', hashSecret(manageToken)).eq('inbox_id', inboxId).maybeSingle()
      if (retryError || !previous || !sameSavedTextSubmission(previous, input)) throw new WishError(409, 'This submission reference cannot be reused. Start a new message.')
      return reply({ reference: previous.id, managementToken: manageToken, status: previous.state, message: 'This submission was already received. No duplicate was created. Save your private withdrawal code.' })
    }
    if (insertError?.code === '23514') throw new WishError(429, 'This school has reached its sponsored wish limit. No payment has been taken.')
    if (insertError || !inserted) throw insertError || new Error('insert_failed')
    return reply({ reference: inserted.id, status: 'request', managementToken: manageToken, message: 'Sent as a message request. The candidate can choose to open it. Save your private withdrawal code.' }, 201)
  } catch (error) { return failure(error) }
}
export async function DELETE(req: NextRequest) {
  try {
    const { object, field, uuid } = await import('@/lib/success-wishes/contracts')
    const body = object(await json(req))
    const reference = uuid(body.reference)
    const secret = field(body.managementToken, 64, 64)
    await limit(`withdraw:${reference}`, 10)
    const { data: removed, error } = await database().from('success_wishes_messages').update({ state: 'withdrawn', body: null }).eq('id', reference).eq('management_token_hash', hashSecret(secret)).eq('format', 'text').select('id').maybeSingle()
    if (error) throw error
    if (!removed) throw new WishError(404, 'Check the reference and private withdrawal code.')
    return reply({ ok: true })
  } catch (error) { return failure(error) }
}
