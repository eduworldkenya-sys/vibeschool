import { NextRequest } from 'next/server'
import { WishError } from '@/lib/success-wishes/contracts'
import { database, failure, json, limit, reply } from '@/lib/success-wishes/server'
import { hashSecret } from '@/lib/success-wishes/security'
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/** A random 256-bit private link is the only access capability. No account or recipient request. */
async function gift(req: NextRequest, reveal: boolean) {
  const body = await json(req) as { token?: unknown }
  const token = typeof body?.token === 'string' ? body.token : ''
  if (!/^[a-f0-9]{64}$/.test(token)) throw new WishError(404, 'This private gift link is unavailable.')
  const ip = (req.headers.get('x-real-ip') || req.headers.get('x-forwarded-for')?.split(',')[0] || 'unknown').slice(0,100)
  await limit('guest-gift-access:' + ip, 40, 900)
  const db = database()
  const { data: access, error: accessError } = await db.from('success_wish_guest_gifts')
    .select('id,guest_order_id,expires_at')
    .eq('link_hash', hashSecret('success-wishes:paid-link:' + token))
    .is('revoked_at',null).gt('expires_at',new Date().toISOString()).maybeSingle()
  if (accessError) throw new WishError(503,'Your gift is temporarily unavailable. Try again later.')
  if (!access) {
    // Free pilot gifts are independent of the paid-order ledger.
    const {data:free,error:freeError}=await db.from('success_wish_free_gifts')
      .select('id,card,expires_at').eq('link_hash',hashSecret('success-wishes:paid-link:'+token))
      .is('revoked_at',null).gt('expires_at',new Date().toISOString()).maybeSingle()
    if(freeError) throw new WishError(503,'Your gift is temporarily unavailable. Try again later.')
    if(!free || free.card?.kind!=='success_wish_text') throw new WishError(404,'This private gift link is unavailable.')
    if(reveal) {
      const {error:openedError}=await db.from('success_wish_free_gifts').update({opened_at:new Date().toISOString()})
        .eq('id',free.id).is('opened_at',null)
      if(openedError) throw new WishError(503,'Your gift could not be opened. Try again.')
    }
    const card=free.card as {theme:string;candidate:string;sender:string;message:string;school:string;examYear:string}
    return {card:{id:free.id,theme:card.theme,candidate:card.candidate,school:card.school,
      examYear:card.examYear,sender:reveal?card.sender:null,
      ...(reveal?{message:card.message}:{}),consentRequired:false}}
  }
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
    const {data:opened,error:oe}=await db.rpc('success_wish_pin_open_gift',{p_link:hashSecret('success-wishes:paid-link:'+token)})
    if(oe||opened!==true)throw new WishError(503,'Your gift could not be opened. Try again.')
  }
  return { card: {
    id:access.id,theme:card.theme,candidate:card.candidate,school:card.school,
    examYear:card.examYear,sender:reveal?card.sender:null,
    ...(reveal?{message:card.message}:{}),consentRequired:false,
  } }
}
export async function POST(req:NextRequest){try{return reply(await gift(req,false))}catch(error){return failure(error)}}
export async function PUT(req:NextRequest){try{return reply(await gift(req,true))}catch(error){return failure(error)}}
