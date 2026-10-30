import {NextRequest,NextResponse} from 'next/server'
import {randomBytes} from 'node:crypto'
import {WishError} from './contracts'
import {database} from './server'
import {hashSecret} from './security'
import {savedGift,savedGroupGift,type DB} from './receiver-collection'

export const GIFT_COOKIE='vs_wish_gifts'
const AGE=90*86400
const valid=(v:unknown):v is string=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v)
export const browserHash=(raw:string)=>hashSecret('success-wishes:gift-browser:'+raw)
export const giftCookie=(req:NextRequest,age=AGE)=>({httpOnly:true as const,secure:req.nextUrl.protocol==='https:',sameSite:'strict' as const,path:'/api/success-wishes',maxAge:age})
export type RememberedGift={id:string;source:'remembered';recipientId:string;collectionId?:string|null;candidate:string;school:string;examYear:string;theme:string;sender:string|null;opened:boolean;message?:string;expiresAt:string}
async function requireRecipient(db:DB,id:string|null|undefined){
 if(!id)return
 const {data,error}=await db.from('success_wish_receivers').select('consent_status').eq('id',id).maybeSingle()
 if(error)throw new WishError(503,'Your gift is temporarily unavailable.')
 if(!data||data.consent_status==='revoked')throw new WishError(404,'This gift is unavailable.')
}
/** Always revalidate the parent payment and current gift revocation, even with a valid device session. */
export async function privateGift(db:DB,hash:string,reveal=false):Promise<{card:RememberedGift;paid:boolean}> {
 const {data:g,error}=await db.from('success_wish_guest_gifts').select('*,success_wish_guest_orders(*)').eq('link_hash',hash).is('revoked_at',null).gt('expires_at',new Date().toISOString()).maybeSingle()
 if(error)throw new WishError(503,'Your gift is temporarily unavailable.')
 if(g){
  const o=g.success_wish_guest_orders
  const saved=g.item_index!=null?savedGroupGift(g,reveal):o?.receiver_id==null?savedGift({...o,success_wish_guest_gifts:[g]},'paid',reveal):null
  if(!saved)throw new WishError(404,'This gift is unavailable.')
  await requireRecipient(db,g.inbox_receiver_id||o.inbox_receiver_id||g.delivery_receiver_id)
  if(reveal){const {data,error:opened}=await db.rpc('success_wish_pin_open_gift',{p_link:hash});if(opened||data!==true)throw new WishError(503,'Could not open your gift. Try again.')}
  return {card:{...saved,id:g.id,source:'remembered',collectionId:g.inbox_receiver_id||o.inbox_receiver_id||null,recipientId:g.delivery_receiver_id||g.inbox_receiver_id||o.inbox_receiver_id||g.id},paid:true}
 }
 const {data:f,error:freeError}=await db.from('success_wish_free_gifts').select('*').eq('link_hash',hash).is('revoked_at',null).gt('expires_at',new Date().toISOString()).maybeSingle()
 if(freeError)throw new WishError(503,'Your gift is temporarily unavailable.')
 const saved=f&&savedGift({...f,inbox_opened_at:f.inbox_opened_at||f.opened_at},'free',reveal)
 if(!saved)throw new WishError(404,'This gift link is unavailable. Ask the sender to share it again.')
 await requireRecipient(db,f.inbox_receiver_id||f.delivery_receiver_id)
 if(reveal){const {error:opened}=await db.from('success_wish_free_gifts').update({opened_at:new Date().toISOString()}).eq('id',f.id).is('opened_at',null);if(opened)throw new WishError(503,'Could not open your gift. Try again.')}
 return {card:{...saved,id:f.id,source:'remembered',collectionId:f.inbox_receiver_id||null,recipientId:f.delivery_receiver_id||f.inbox_receiver_id||f.id},paid:false}
}
/** This grants one gift only. No phone lookup, PIN session, consent grant or collection claim. */
export async function rememberGift(req:NextRequest,response:NextResponse,gift:{card:RememberedGift;paid:boolean}) {
 const current=req.cookies.get(GIFT_COOKIE)?.value
 const raw=valid(current)?current:randomBytes(32).toString('hex')
 const row={token_hash:hashSecret('success-wishes:remember-gift:'+raw+':'+gift.card.id),guest_browser_hash:browserHash(raw),receiver_id:null,
  guest_gift_id:gift.paid?gift.card.id:null,free_gift_id:gift.paid?null:gift.card.id,expires_at:gift.card.expiresAt}
 const {error}=await database().from('success_wish_receiver_sessions').upsert(row,{onConflict:'token_hash'})
 if(error)throw new WishError(503,'Your card is open. Reconnect to remember it on this browser.')
 response.cookies.set(GIFT_COOKIE,raw,giftCookie(req))
}
export async function rememberedSessions(req:NextRequest){
 const raw=req.cookies.get(GIFT_COOKIE)?.value
 if(!valid(raw))return []
 const {data,error}=await database().from('success_wish_receiver_sessions').select('guest_gift_id,free_gift_id,expires_at')
  .eq('guest_browser_hash',browserHash(raw)).gt('expires_at',new Date().toISOString()).order('expires_at',{ascending:false}).limit(100)
 if(error)throw new WishError(503,'Your saved gifts could not be loaded.')
 return data||[]
}
export async function rememberedGift(req:NextRequest,id:string,reveal=false,knownSessions?:Awaited<ReturnType<typeof rememberedSessions>>){
 const sessions=knownSessions??await rememberedSessions(req),s=sessions.find(s=>s.guest_gift_id===id||s.free_gift_id===id)
 if(!s)throw new WishError(404,'Open your private gift link first.')
 const {data,error}=await database().from(s.guest_gift_id?'success_wish_guest_gifts':'success_wish_free_gifts').select('link_hash').eq('id',id).maybeSingle()
 if(error)throw new WishError(503,'Your gift is temporarily unavailable.')
 if(!data)throw new WishError(404,'This gift is unavailable.')
 return (await privateGift(database(),data.link_hash,reveal)).card
}
