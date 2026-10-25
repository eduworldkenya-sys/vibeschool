import { NextRequest } from 'next/server'
import { WishError } from '@/lib/success-wishes/contracts'
import { database, failure, limit, reply } from '@/lib/success-wishes/server'
import { settleCard, type CardStatus, type SettlementStore } from '@/lib/success-wishes/settlement'

// Sender status for one digital card. The unguessable card id is the only capability.
// Polling this route settles a pending card from the sandbox provider; the browser never
// decides payment. The private link token is returned only in the reply that settles the card.
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const MESSAGES: Record<CardStatus, string> = {
  pending_payment: 'Check your phone to confirm the M-Pesa payment.',
  paid: 'Payment received. Your private link is ready.',
  failed: 'The payment did not go through. You can start the card again.',
  expired: 'The payment request expired. You can start the card again.',
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const id = params.id
    if (!UUID.test(id)) throw new WishError(404, 'We could not find that card.')

    const ip = (req.headers.get('x-forwarded-for') || '').split(',')[0].trim() || 'unknown'
    await limit('cards:status:ip:' + ip, 240, 3600)
    await limit('cards:status:id:' + id, 120, 3600)

    const db = database()
    const { data: card, error } = await db.from('success_wish_cards')
      .select('id,status,payment_order_id').eq('id', id).maybeSingle()
    if (error) throw new WishError(503, 'Please try again later.')
    if (!card) throw new WishError(404, 'We could not find that card.')

    const store: SettlementStore = {
      async markPaid(cardId, linkTokenHash) {
        const { data, error: updateError } = await db.from('success_wish_cards')
          .update({ status: 'paid', paid_at: new Date().toISOString(), link_token_hash: linkTokenHash })
          .eq('id', cardId).eq('status', 'pending_payment').select('id').maybeSingle()
        if (updateError) throw new WishError(503, 'Please try again later.')
        return !!data
      },
      async markTerminal(cardId, status) {
        const { error: updateError } = await db.from('success_wish_cards')
          .update({ status }).eq('id', cardId).eq('status', 'pending_payment')
        if (updateError) throw new WishError(503, 'Please try again later.')
      },
    }

    const result = await settleCard(
      { id: card.id, status: card.status as CardStatus, payment_order_id: card.payment_order_id },
      store,
    )

    return reply({
      id: card.id,
      status: result.status,
      customerMessage: MESSAGES[result.status],
      ...(result.linkToken ? { linkToken: result.linkToken } : {}),
    })
  } catch (error) {
    return failure(error)
  }
}
