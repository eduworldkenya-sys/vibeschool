import { WishError } from './contracts'
import { senderPhone } from './phone-verification'
import { enabled } from './security'
import { hashSecret } from './security'

type Env = Record<string,string|undefined>
export function giftSmsReady(env: Env = process.env): boolean {
  return enabled(env) && env.SUCCESS_WISHES_GIFT_SMS_ENABLED === 'true'
    && !!env.SUCCESS_WISHES_AT_USERNAME?.trim() && !!env.SUCCESS_WISHES_AT_API_KEY?.trim()
    && (env.SUCCESS_WISHES_AT_MODE === 'live'
      || (env.SUCCESS_WISHES_AT_MODE === 'sandbox' && env.VERCEL_ENV === 'preview'))
}

export async function sendGiftSms(phone: string, link: string, env: Env = process.env) {
  if (!giftSmsReady(env)) throw new WishError(503, 'Wish delivery SMS is not enabled.')
  const to = senderPhone(phone)
  if (!/^https:\/\/vibeschool\.co\.ke\/success-wishes\/gift#token=[a-f0-9]{64}$/.test(link))
    throw new Error('Invalid private delivery link.')
  const endpoint = env.SUCCESS_WISHES_AT_MODE === 'sandbox'
    ? 'https://api.sandbox.africastalking.com/version1/messaging'
    : 'https://api.africastalking.com/version1/messaging'
  // A private link is a bearer credential: never include it in errors, logs or provider diagnostics.
  const message = 'A private VibeSchool Success Wish is waiting for you. Open: ' + link
  const data = new URLSearchParams({username:env.SUCCESS_WISHES_AT_USERNAME!.trim(),to,message})
  if (env.SUCCESS_WISHES_AT_SENDER_ID?.trim()) data.set('from',env.SUCCESS_WISHES_AT_SENDER_ID!.trim())
  let res: Response
  try {
    res = await fetch(endpoint,{method:'POST',headers:{
      apiKey:env.SUCCESS_WISHES_AT_API_KEY!.trim(),Accept:'application/json',
      'Content-Type':'application/x-www-form-urlencoded',
    },body:data.toString(),redirect:'error',cache:'no-store',signal:AbortSignal.timeout(12000)})
  } catch { throw new WishError(503,'Wish delivery SMS could not be confirmed.') }
  if(!res.ok) throw new WishError(503,'Wish delivery SMS was rejected.')
  const payload:unknown = await res.json().catch(()=>null)
  const recipients=(payload as {SMSMessageData?:{Recipients?:unknown}}|null)?.SMSMessageData?.Recipients
  if(!Array.isArray(recipients) || recipients.length!==1)throw new WishError(503,'Wish delivery SMS was not confirmed.')
  const recipient=recipients[0] as {number?:unknown;statusCode?:unknown;status?:unknown;messageId?:unknown}
  if(recipient.number!==to || recipient.statusCode!==102 || recipient.status!=='Success')
    throw new WishError(503,'Wish delivery SMS was not confirmed.')
  return {providerId:typeof recipient.messageId==='string'?recipient.messageId:null}
}
type DB = ReturnType<typeof import('./server').database>
export async function deliverGuestGiftOnce(db: DB, order: {
  id:string;card:{deliveryPhone?:string}|null;state:string;refunded_at?:string|null;
}, key: string, link: string): Promise<'disabled'|'accepted'|'needs_review'|'not_addressed'> {
  if(!order.card?.deliveryPhone)return 'not_addressed'
  if(!giftSmsReady())return 'disabled'
  // This RPC checks the locked settled order, immutable delivery number, and issued gift.
  const {data:claimed,error}=await db.rpc('success_wish_claim_guest_sms_delivery',{
    p_id:order.id,p_key_hash:hashSecret('success-wishes:guest-order:'+key),
  })
  if(error) return 'needs_review'
  if(claimed===order.id){
    try {
      const result=await sendGiftSms(order.card.deliveryPhone,link)
      const {error:updated}=await db.from('success_wish_guest_sms_delivery')
        .update({status:'accepted',provider_id:result.providerId,submitted_at:new Date().toISOString(),
          updated_at:new Date().toISOString()}).eq('guest_order_id',order.id).eq('status','sending')
      if(updated)return 'needs_review'
      return 'accepted'
    }catch {
      // An uncertain provider submission is NEVER repeated automatically.
      await db.from('success_wish_guest_sms_delivery')
        .update({status:'needs_review',updated_at:new Date().toISOString()})
        .eq('guest_order_id',order.id).eq('status','sending')
      return 'needs_review'
    }
  }
  const {data:record,error:readError}=await db.from('success_wish_guest_sms_delivery')
    .select('status').eq('guest_order_id',order.id).maybeSingle()
  if(readError)return 'needs_review'
  return record?.status==='accepted'?'accepted':'needs_review'
}
