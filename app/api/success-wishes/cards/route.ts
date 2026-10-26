import { NextRequest } from 'next/server'
import { object, WishError } from '@/lib/success-wishes/contracts'
import { database, failure, json, limit, reply } from '@/lib/success-wishes/server'
import { normalizeSafaricomPhone } from '@/lib/success-wishes/payment-contract'

// Public sender endpoint for a digital success card.
// The server calls the sandbox checkout function with the operator secret, which is
// never sent to the browser. The price comes from the database catalogue, not the client.
// A card is only delivered after the sandbox callback settles its order (not yet built).
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const themes = new Set(['heritage', 'botanical', 'nightfall', 'sunrise'])
const PRODUCT_KIND = 'success_wish'
const SANDBOX_ITEM = 'sandbox-success-wish'
const CHECKOUT_PATH = '/functions/v1/unified-commerce-sandbox-checkout'

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

    const checkoutUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\/$/, '') + CHECKOUT_PATH
    const operatorToken = process.env.COMMERCE_SANDBOX_OPERATOR_TOKEN || ''
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !operatorToken) {
      throw new WishError(503, 'Payments are not available right now. Please try again shortly.')
    }

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
      price_kes: 50,
    }).select('id').single()
    if (insertError || !card) throw insertError || new Error('insert_failed')

    let response: Response
    try {
      response = await fetch(checkoutUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + operatorToken },
        cache: 'no-store',
        redirect: 'error',
        signal: AbortSignal.timeout(15000),
        body: JSON.stringify({
          product_kind: PRODUCT_KIND,
          item_reference: SANDBOX_ITEM,
          owner_type: 'guest',
          owner_reference: card.id,
          idempotency_key: 'sw-' + String(card.id).replace(/-/g, ''),
          phone,
        }),
      })
    } catch {
      // The provider may already have accepted a request, so this card is not retried or deleted here.
      throw new WishError(503, 'Payment could not start. Please try again shortly.')
    }

    const payload = await response.json().catch(() => null) as Record<string, unknown> | null

    if (response.status === 202 && payload?.state === 'awaiting_customer' && typeof payload.order_id === 'string') {
      await db.from('success_wish_cards').update({ payment_order_id: payload.order_id }).eq('id', card.id)
      return reply({
        id: card.id,
        status: 'pending_payment',
        customerMessage: 'Check your phone to confirm the M-Pesa payment.',
      }, 201)
    }

    if (payload?.state === 'pre_payment_failure') {
      await db.from('success_wish_cards').update({ status: 'failed' }).eq('id', card.id)
      throw new WishError(503, 'Payment could not start. Please try again shortly.')
    }

    if (response.status === 400 && typeof payload?.error === 'string') {
      // Sandbox only accepts the approved test number; surface that as a plain message.
      await db.from('success_wish_cards').update({ status: 'failed' }).eq('id', card.id)
      throw new WishError(400, payload.error)
    }

    // Anything else may mean an STK prompt was sent. Leave the card pending for reconciliation.
    throw new WishError(503, 'Payment status is being checked. Please do not pay again yet.')
  } catch (error) {
    return failure(error)
  }
}
