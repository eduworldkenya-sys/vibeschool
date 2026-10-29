import {NextRequest} from 'next/server'
import {WishError,object} from '@/lib/success-wishes/contracts'
import {failure,json,reply} from '@/lib/success-wishes/server'
import {receiverSession,ownedGift,savedGift,savedGroupGift,type SavedGift} from '@/lib/success-wishes/receiver-collection'
export const dynamic='force-dynamic'
export const runtime='nodejs'
export async function GET(req:NextRequest){try{
 let active
 try{active=await receiverSession(req)}catch(e){if(!(e instanceof WishError&&e.status===401))throw e;const {GET:legacy}=await import('../inbox/route');const response=await legacy(req);if(!response.ok)return response;const old=await response.json();return reply({...old,legacy:true,cards:old.cards.map((c:{id:string;sender:string|null;opened:boolean})=>({...c,source:'legacy'}))})}
 const {db,receiver:r}=active
 const [paid,free,group]=await Promise.all([db.from('success_wish_guest_orders').select('*,success_wish_guest_gifts(revoked_at,expires_at)').eq('inbox_receiver_id',r.id).eq('state','settled').is('refunded_at',null).order('created_at',{ascending:false}).limit(100),db.from('success_wish_free_gifts').select('*').eq('inbox_receiver_id',r.id).is('revoked_at',null).gt('expires_at',new Date().toISOString()).order('created_at',{ascending:false}).limit(100),db.from('success_wish_guest_gifts').select('*,success_wish_guest_orders(*)').eq('inbox_receiver_id',r.id).not('item_index','is',null).is('revoked_at',null).gt('expires_at',new Date().toISOString()).order('created_at',{ascending:false}).limit(100)])
 if(paid.error||free.error||group.error)throw new WishError(503,'Your wishes could not be loaded. Try again.')
 const cards:SavedGift[]=[];for(const row of paid.data||[]){const c=savedGift(row,'paid');if(c)cards.push(c)}for(const row of free.data||[]){const c=savedGift(row,'free');if(c)cards.push(c)}
 for(const row of group.data||[]){const c=savedGroupGift(row);if(c)cards.push(c)}
 // Authenticated upgrades retain the canonical legacy cards as well as new gifts.
 if(r.consent_status==='verified'){const {data,error}=await db.from('success_wish_cards').select('id,theme,sender_name,sender_reveal_early,opened_at,created_at,expires_at,payment_attempt_id,guest_order_id').eq('receiver_id',r.id).is('hidden_at',null).is('revoked_at',null).gt('expires_at',new Date().toISOString()).order('created_at',{ascending:false}).limit(100);if(error)throw error;const {settledCardIds}=await import('@/lib/success-wishes/receiver');const eligible=await settledCardIds(db,data||[]);for(const c of data||[])if(eligible.has(c.id))cards.push({id:c.id,source:'legacy',candidate:r.display_name,school:r.school_label,examYear:r.pin_exam_year,theme:c.theme,sender:c.opened_at||c.sender_reveal_early?c.sender_name:null,opened:!!c.opened_at,expiresAt:c.expires_at})}
 return reply({recipient:{id:r.id,name:r.display_name,school:r.school_label},cards})
}catch(e){return failure(e)}}
export async function POST(req:NextRequest){try{const b=object(await json(req)),{db,receiver:r}=await receiverSession(req);return reply({card:await ownedGift(db,r.id,b.id,b.source,b.reveal===true)})}catch(e){return failure(e)}}
