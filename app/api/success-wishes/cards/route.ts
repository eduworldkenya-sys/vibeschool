import { NextRequest } from 'next/server'
import { object, WishError } from '@/lib/success-wishes/contracts'
import { database, failure, json, limit, reply } from '@/lib/success-wishes/server'
import { normalizeSafaricomPhone } from '@/lib/success-wishes/payment-contract'
import { createGuestMpesaTransport } from '@/lib/success-wishes/mpesa-transport'

// Public sender endpoint for a paid digital success card.
// The price is set here on the server; the browser never chooses it.
// The card becomes deliverable only after a verified M-Pesa callback (not yet deployed).
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const themes = new Set(['heritage', 'botanical', 'nightfall', 'sunrise'])
const TEXT_PRICE_KES = 50

function clean(value: unknown, max: number) {
  return typeof value === 'string' ? value.trim().slice(0, max) : ''
}

export async function POST(req: NextRequest) {
  try {
    const body = object(await json(req))
    const senderName = clean(body.senderName, 48)
    const candidateName = clean(body.candidateName, 48)
    const examYear = clean(body.examYear, 4)
    const schoolAddress = clean(body.schoolAddress, 80) || null
    const theme = clean(body.theme, 20)
    const message = clean(body.message, 220)
    if (body.version !== 'text' || !senderName || !candidateName || !/^20\d{2}$/.test(examYear)
      || !themes.has(theme) || !message) {
      throw new WishError(400, 'Check the wish details and try again.')
    }

    let phone: string
    try {
      phone = normalizeSafaricomPhone(clean(body.mpesaNumber, 20))
    } catch {
      throw new WishError(400, 'Enter a valid Kenyan M-Pesa number.')
    }

    const ip = (req.headers.get('x-forwarded-for') || '').split(',')[0].trim() || 'unknown'
    await limit('cards:ip:' + ip, 10, 3600)
    await limit('cards:phone:' + phone, 5, 3600)

    const db = database()
    const { data: card, error: insertError } = await db.from('success_wish_cards').insert({
      sender_name: senderName,
      sender_phone: phone,
      candidate_name: candidateName,
      exam_year: Number(examYear),
      school_address: schoolAddress,
      theme,
      version: 'text',
      message,
      price_kes: TEXT_PRICE_KES,
    }).select('id').single()
    if (insertError || !card) throw insertError || new Error('insert_failed')

    // Only this conditional claim may start an STK request for the card.
    const attempt = { id: card.id as string, phone, amountKes: TEXT_PRICE_KES, state: 'submitting' as const }
    const transport = createGuestMpesaTransport()
    let acknowledgement
    try {
      acknowledgement = await transport.sendStk(attempt, async () => {
        const { data: claimed, error: claimError } = await db.from('success_wish_cards')
          .update({ status: 'pending_payment' })
          .eq('id', card.id).eq('status', 'pending_payment')
          .select('id').maybeSingle()
        return !claimError && !!claimed
      })
    } catch {
      // The provider may have accepted the request even if we timed out, so the
      // card is NOT retried or deleted here. It stays pending until reconciled.
      throw new WishError(503, 'M-Pesa is not available right now. Please try again shortly.')
    }

    await db.from('success_wish_cards')
      .update({ payment_order_id: acknowledgement.checkoutRequestId })
      .eq('id', card.id)

    return reply({
      id: card.id,
      status: 'pending_payment',
      customerMessage: acknowledgement.customerMessage,
    }, 201)
  } catch (error) {
    return failure(error)
  }
}
