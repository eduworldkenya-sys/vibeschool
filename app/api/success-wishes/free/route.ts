import { createHash } from 'node:crypto'
import { NextRequest } from 'next/server'
import { field, object, WishError } from '@/lib/success-wishes/contracts'
import { database, failure, json, limit, reply } from '@/lib/success-wishes/server'
import { hashSecret } from '@/lib/success-wishes/security'
import { senderPhone } from '@/lib/success-wishes/phone-verification'
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

async function freeWish(req: NextRequest, raw: unknown) {
 const b = object(raw)
 if (typeof b.code !== 'string' || b.code.trim().toUpperCase() !== 'DNJIMAX3') throw new WishError(400,'Enter the valid free-card code DNJIMAX3.')
 for (const name of ['amountKes','price','paid','paymentStatus','providerReceipt','checkoutRequestId','merchantRequestId','paymentAttemptId']) {
  if (Object.prototype.hasOwnProperty.call(b,name)) throw new WishError(400,'Payment details cannot be supplied.')
 }
 if (b.version !== 'text') throw new WishError(400,'Only text wishes are available.')
 if (typeof b.theme !== 'string' || !['heritage','botanical','nightfall','sunrise'].includes(b.theme)) throw new WishError(400,'Choose a card design.')
 const senderNumber = senderPhone(b.senderPhone)
 const senderHash = hashSecret('success-wishes:trial:sender:'+senderNumber)
 const key = field(b.key,64,64)
 if (!/^[a-f0-9]{64}$/.test(key)) throw new WishError(400,'Invalid private key.')
 const card = {
  kind:'success_wish_text',theme:b.theme,
  candidate:field(b.candidate,1,48),sender:field(b.sender,1,48),
  message:field(b.message,1,220),examYear:field(b.examYear,4,4),
  school:b.school==null || b.school===''?'':field(b.school,1,80),
 }
 if (!/^20\d{2}$/.test(card.examYear)) throw new WishError(400,'Enter a valid exam year.')
 const db = database()
 const ip=(req.headers.get('x-real-ip')||req.headers.get('x-forwarded-for')?.split(',')[0]||'unknown').slice(0,100)
 await limit('free-gift-ip:'+ip,10,3600)
 await limit('free-gift-global',1000,3600)
 const {data:control,error:controlError}=await db.from('success_wishes_pilot_control').select('free_text_enabled').eq('singleton',true).maybeSingle()
 if(controlError || !control?.free_text_enabled) throw new WishError(503,'Free wishes are not available.')
 const digest=createHash('sha256').update('vibeschool:success-wishes:text-card:v1:').update(JSON.stringify(card)).digest('hex')
 const secret=hashSecret('success-wishes:guest-card-link:'+key)
 const {data,error}=await db.rpc('success_wish_issue_trial_guest_gift',{
  p_key_hash:hashSecret('success-wishes:guest-order:'+key),
  p_link_hash:hashSecret('success-wishes:paid-link:'+secret),
  p_card:card,p_card_digest:digest,p_sender_hash:senderHash,
 })
 if(error){
  if(error.message?.includes('FREE_LIMIT_REACHED')) throw new WishError(409,'Your 5 free Success Cards have been used. Continue with paid checkout.')
  if(['23505','23514'].includes(error.code)) throw new WishError(409,'This private key already belongs to another gift or sending is disabled.')
  throw new WishError(503,'Your wish could not be sent. Please try again.')
 }
 if(!data) throw new WishError(503,'Your wish could not be sent.')
 return {id:data.id,remaining:data.remaining,state:'free_issued',amountKes:0,invitationUrl:'https://vibeschool.co.ke/success-wishes/gift#token='+secret}
}
export async function POST(req:NextRequest){try{return reply(await freeWish(req,await json(req)))}catch(error){return failure(error)}}
