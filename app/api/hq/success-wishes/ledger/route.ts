import {NextRequest} from 'next/server'
import {WishError} from '@/lib/success-wishes/contracts'
import {failure,reply,revocationDatabase} from '@/lib/success-wishes/server'
export const runtime='nodejs'
export const dynamic='force-dynamic'
export async function GET(req:NextRequest){
 try{
  const bearer=(req.headers.get('authorization')||'').match(/^Bearer\s+(.+)$/i)?.[1]
  if(!bearer)throw new WishError(401,'HQ sign-in required.')
  const db=revocationDatabase()
  const {data:auth,error:authError}=await db.auth.getUser(bearer)
  if(authError||!auth.user)throw new WishError(401,'HQ sign-in required.')
  const {data:member,error:memberError}=await db.from('hq_human_members').select('role,status,permissions,access_expires_at').eq('profile_id',auth.user.id).maybeSingle()
  if(memberError||!member||member.status!=='active'||(member.access_expires_at&&Date.parse(member.access_expires_at)<=Date.now())||(member.role!=='founder'&&!member.permissions?.includes('finance.view')&&!member.permissions?.includes('support.manage')))
   throw new WishError(403,'HQ ledger permission required.')
  const [orders,gifts,free,receivers]=await Promise.all([
   db.from('success_wish_guest_orders').select('id,state,amount_kes,created_at,settled_at,provider_verified_at,refunded_at,inbox_receiver_id,receiver_id,inbox_opened_at,inbox_claimed_at,card,delivery_phone_override,provider_receipt,success_wish_guest_gifts(id,delivery_receiver_id)').order('created_at',{ascending:false}).limit(500),
   db.from('success_wish_guest_gifts').select('id,guest_order_id,item_index,created_at,inbox_receiver_id,inbox_opened_at,inbox_claimed_at,revoked_at,card,delivery_receiver_id').not('item_index','is',null).order('created_at',{ascending:false}).limit(1000),
   db.from('success_wish_free_gifts').select('id,created_at,inbox_receiver_id,inbox_opened_at,inbox_claimed_at,revoked_at,card,delivery_receiver_id').order('created_at',{ascending:false}).limit(500),
   db.from('success_wish_receivers').select('id').or('pin_hash.not.is.null,consent_status.eq.verified').limit(1000)
  ])
  if(orders.error||gifts.error||free.error||receivers.error)throw new WishError(503,'Ledger is temporarily unavailable.')
  const orderRows=orders.data||[],groupRows=gifts.data||[],freeRows=free.data||[]
  const paid=orderRows.filter(o=>o.state==='settled'&&!!o.settled_at&&!!o.provider_verified_at&&!o.refunded_at)
  const details=[
   ...orderRows.filter(o=>o.amount_kes===50).map(o=>({id:o.success_wish_guest_gifts?.[0]?.id||o.id,orderId:o.id,kind:'single',status:o.state,paid:o.state==='settled'&&!!o.provider_verified_at&&!o.refunded_at,createdAt:o.created_at,claimed:!!o.inbox_receiver_id,opened:!!o.inbox_opened_at,receiverId:o.inbox_receiver_id,deliveryRecipientId:o.success_wish_guest_gifts?.[0]?.delivery_receiver_id||o.receiver_id,recipient:o.card?.candidate||'',sender:o.card?.sender||'',deliveryAddress:o.delivery_phone_override||o.card?.deliveryPhone||'',receipt:o.provider_receipt||''})),
   ...groupRows.map(g=>({id:g.id,orderId:g.guest_order_id,kind:'group',status:orderRows.find(o=>o.id===g.guest_order_id)?.state||'unknown',paid:paid.some(o=>o.id===g.guest_order_id),createdAt:g.created_at,claimed:!!g.inbox_receiver_id,opened:!!g.inbox_opened_at,receiverId:g.inbox_receiver_id,deliveryRecipientId:g.delivery_receiver_id,recipient:g.card?.candidate||'',sender:g.card?.sender||'',deliveryAddress:g.card?.deliveryPhone||'',receipt:orderRows.find(o=>o.id===g.guest_order_id)?.provider_receipt||''})),
   ...freeRows.map(g=>({id:g.id,orderId:null,kind:'free',status:g.revoked_at?'revoked':'created',paid:false,createdAt:g.created_at,claimed:!!g.inbox_receiver_id,opened:!!g.inbox_opened_at,receiverId:g.inbox_receiver_id,deliveryRecipientId:g.delivery_receiver_id,recipient:g.card?.candidate||'',sender:g.card?.sender||'',deliveryAddress:g.card?.deliveryPhone||'',receipt:''}))
  ].sort((a,b)=>String(b.createdAt).localeCompare(String(a.createdAt)))
  return reply({summary:{orders:orderRows.length,paidOrders:paid.length,verifiedRevenueKes:paid.reduce((s,o)=>s+o.amount_kes,0),cards:details.length,claimed:details.filter(x=>x.claimed).length,opened:details.filter(x=>x.opened).length,receiverAccounts:receivers.data?.length||0},rows:details.slice(0,250),limited:true,notice:'Most recent 500 orders and free cards, 1000 group gifts, 1000 receiver accounts. Counts may be incomplete beyond these limits. Sharing is not proof of delivery.'})
 }catch(error){return failure(error)}
}
