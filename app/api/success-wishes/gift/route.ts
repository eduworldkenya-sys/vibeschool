import { NextRequest } from 'next/server'
import { WishError } from '@/lib/success-wishes/contracts'
import { revocationDatabase, takeAttempt, failure, json, reply } from '@/lib/success-wishes/server'
import { hashSecret } from '@/lib/success-wishes/security'
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/** A random 256-bit private link is the only access capability. No account or recipient request. */
async function gift(req: NextRequest, reveal: boolean) {
  const body = await json(req) as { token?: unknown }
  const token = typeof body?.token === 'string' ? body.token : ''
  if (!/^[a-f0-9]{64}$/.test(token)) throw new WishError(404, 'This private gift link is unavailable.')
  const ip = (req.headers.get('x-real-ip') || req.headers.get('x-forwarded-for')?.split(',')[0] || 'unknown').slice(0,100)
  // A paid gift remains accessible when the new-payment switch is disabled.
  const db = revocationDatabase()
  await takeAttempt(db, 'guest-gift-access:' + ip, 40, 900)
  const { data: access, error: accessError } = await db.from('success_wish_guest_gifts')
    .select('id,guest_order_id,expires_at')
    .eq('link_hash', hashSecret('success-wishes:paid-link:' + token))
    .is('revoked_at',null).gt('expires_at',new Date().toISOString()).maybeSingle()
  if (accessError) throw new WishError(503,'Your gift is temporarily unavailable. Try again later.')
  if (!access) throw new WishError(404,'This private gift link is unavailable.')
  const { data: order, error } = await db.from('success_wish_guest_orders')
    .select('state,card,amount_kes,receiver_id,provider_receipt,provider_verified_at,settled_at,refunded_at')
    .eq('id',access.guest_order_id).maybeSingle()
  if (error) throw new WishError(503,'Your gift is temporarily unavailable. Try again later.')
  if (!order || order.state!=='settled' || order.amount_kes!==50
    || order.receiver_id!==null || order.refunded_at || !order.provider_receipt
    || !order.provider_verified_at || !order.settled_at || order.card?.kind!=='success_wish_text')
    throw new WishError(404,'This private gift is unavailable.')
  const card = order.card as { theme:string;candidate:string;sender:string;message:string;school:string;examYear:string }
  if (reveal) {
    // The gift message is returned only after the receiver taps the envelope.
    await db.from('success_wish_guest_gifts').update({opened_at:new Date().toISOString()})
      .eq('id',access.id).is('opened_at',null)
  }
  return { card: {
    id:access.id,theme:card.theme,candidate:card.candidate,school:card.school,
    examYear:card.examYear,sender:reveal?card.sender:null,
    ...(reveal?{message:card.message}:{}),consentRequired:false,
  } }
}
export async function POST(req:NextRequest){try{return reply(await gift(req,false))}catch(error){return failure(error)}}
export async function PUT(req:NextRequest){try{return reply(await gift(req,true))}catch(error){return failure(error)}}
