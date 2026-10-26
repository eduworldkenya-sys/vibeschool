import { WishError } from './contracts'
import { receiverDatabase } from './receiver'
import { sendReceiverSms, receiverSmsReady } from './receiver-sms'

type Template = 'heritage'|'botanical'|'nightfall'|'sunrise'
type Gift = {
  paymentAttemptId: string
  receiverId: string
  theme: Template
  senderName: string
  message: string
  examYear: string
  revealSenderBeforeOpen?: boolean
}
type Issued = { issued_card_id: string; link_secret: string|null; access_code: string|null; newly_issued: boolean }

/**
 * Only a trusted, server-side, verified commerce callback may invoke this function.
 * The database independently rejects simulated, refunded and unrelated purchases.
 *
 * The first invocation returns one-time link/code material for the purchaser and SMS.
 * Replays report already_issued and return NO secret. Checkout must persist delivery
 * acknowledgement and provide an authenticated regenerate/recovery action.
 */
export async function issueReceiverWishFromVerifiedOrder(input: Gift) {
  const db = receiverDatabase()
  const { data: recipient, error: receiverError } = await db.from('success_wish_receivers')
    .select('phone_e164,consent_status').eq('id', input.receiverId).maybeSingle()
  if (receiverError || recipient?.consent_status !== 'verified') {
    throw new WishError(409, 'Receiver identity and consent must be verified before delivery.')
  }
  const baseUrl = process.env.SUCCESS_WISHES_PUBLIC_BASE_URL?.trim()
  if (!baseUrl) throw new WishError(503, 'Public invitation address is not commissioned.')
  let publicBase: URL
  try { publicBase = new URL(baseUrl) }
  catch { throw new WishError(503, 'Public invitation address is invalid.') }
  if (publicBase.protocol !== 'https:' || publicBase.username || publicBase.password || publicBase.search
    || publicBase.hash || publicBase.pathname !== '/')
    throw new WishError(503, 'A secure production invitation address is required.')
  const { data, error } = await db.rpc('success_wish_issue_verified_paid_card', {
    p_payment_attempt_id: input.paymentAttemptId,
    p_receiver_id: input.receiverId,
    p_theme: input.theme,
    p_sender_name: input.senderName,
    p_message: input.message,
    p_exam_year: input.examYear,
    p_sender_reveal_early: input.revealSenderBeforeOpen === true,
  }).single()
  if (error || !data) throw new WishError(409, 'A verified, settled gift order is required.')
  const issued = data as Issued
  if (!issued.newly_issued) return {
    cardId: issued.issued_card_id, alreadyIssued: true as const,
    invitationUrl: null, backupCode: null, smsStatus: 'not_resubmitted' as const,
  }
  if (!issued.link_secret || !issued.access_code) throw new WishError(503, 'Card access issuance failed.')

  const invitationUrl = publicBase.origin + '/success-wishes/invitation#token=' + issued.link_secret
  const backupCode = issued.access_code

  let smsStatus: 'accepted'|'failed'|'disabled' = receiverSmsReady() ? 'failed' : 'disabled'
  if (receiverSmsReady()) {
    // No message content or full sender identity is sent over SMS.
    try {
      const { data: delivery, error: logError } = await db.from('success_wish_sms_deliveries')
        .insert({ card_id: issued.issued_card_id, receiver_id: input.receiverId, purpose: 'card', status: 'queued' })
        .select('id').single()
      if (logError || !delivery) throw new Error('Could not queue delivery.')
      try {
        const notice = `A VibeSchool Success Wish is waiting. Open: ${invitationUrl} Code: ${backupCode}`
        const result = await sendReceiverSms(recipient.phone_e164, notice)
        const { error: updateError } = await db.from('success_wish_sms_deliveries').update({
          status: 'accepted', provider_id: result.providerId, updated_at: new Date().toISOString(),
        }).eq('id', delivery.id)
        if (updateError) throw updateError
        smsStatus = 'accepted'
      } catch {
        await db.from('success_wish_sms_deliveries').update({
          status: 'failed', failure_code: 'provider_or_logging_error', updated_at: new Date().toISOString(),
        }).eq('id', delivery.id)
        smsStatus = 'failed'
      }
    } catch { smsStatus = 'failed' }
  }
  return {
    cardId: issued.issued_card_id, alreadyIssued: false as const,
    invitationUrl, backupCode, smsStatus,
  }
}
