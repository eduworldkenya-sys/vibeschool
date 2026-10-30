import { createClient } from '@supabase/supabase-js'
import { verifiedFounderOperator } from '@/lib/success-wishes/mpesa-operator'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
type Card = { school?:string; sender?:string; candidate?:string }
type Summary = {name:string;cards:number;free:number;paid:number;senders:number;candidates:number;settledKes:number;latest:string}
const clean=(v:unknown)=>typeof v==='string'?v.trim().replace(/\s+/g,' '):''
const key=(v:string)=>v.toLocaleLowerCase()
export async function GET(request:Request){
 if(!await verifiedFounderOperator(request))return Response.json({error:'Forbidden'},{status:403})
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL,secret=process.env.SUPABASE_SERVICE_ROLE_KEY
 if(!url||!secret)return Response.json({error:'Reporting unavailable'},{status:503})
 const db=createClient(url,secret,{auth:{persistSession:false,autoRefreshToken:false}})
 const grouped=new Map<string,{name:string;cards:number;free:number;paid:number;senders:Set<string>;candidates:Set<string>;settledKes:number;latest:string}>()
 const add=(card:Card,kind:'free'|'paid',created:string,settled:number)=>{
  const name=clean(card.school)||'Not specified',id=key(name)
  let item=grouped.get(id)
  if(!item){item={name,cards:0,free:0,paid:0,senders:new Set(),candidates:new Set(),settledKes:0,latest:created};grouped.set(id,item)}
  item.cards++;item[kind]++
  if(clean(card.sender))item.senders.add(key(clean(card.sender)))
  if(clean(card.candidate))item.candidates.add(key(clean(card.candidate)))
  item.settledKes+=settled
  if(created>item.latest)item.latest=created
 }
 try{
  const batch=500
  for(let offset=0;;offset+=batch){
   const {data,error}=await db.from('success_wish_free_gifts').select('card,created_at').order('created_at',{ascending:true}).order('id',{ascending:true}).range(offset,offset+batch-1)
   if(error)throw error
   for(const row of data||[])add((row.card||{}) as Card,'free',row.created_at,0)
   if(!data||data.length<batch)break
  }
  for(let offset=0;;offset+=batch){
   const {data,error}=await db.from('success_wish_guest_gifts').select('card,created_at,success_wish_guest_orders!inner(card,state,amount_kes,settled_at,refunded_at)').order('created_at',{ascending:true}).order('id',{ascending:true}).range(offset,offset+batch-1)
   if(error)throw error
   for(const row of data||[]){
    const order=Array.isArray(row.success_wish_guest_orders)?row.success_wish_guest_orders[0]:row.success_wish_guest_orders
    const o=order as {card?:Card;state?:string;amount_kes?:number;settled_at?:string|null;refunded_at?:string|null}|null
    const card=(row.card||o?.card||{}) as Card
    add(card,'paid',row.created_at,o?.state==='settled'&&o.settled_at&&!o.refunded_at?o.amount_kes||0:0)
   }
   if(!data||data.length<batch)break
  }
  const schools:Summary[]=[...grouped.values()].map(s=>({name:s.name,cards:s.cards,free:s.free,paid:s.paid,senders:s.senders.size,candidates:s.candidates.size,settledKes:s.settledKes,latest:s.latest})).sort((a,b)=>b.cards-a.cards||a.name.localeCompare(b.name))
  return Response.json({schools,totalCards:schools.reduce((n,s)=>n+s.cards,0),generatedAt:new Date().toISOString()},{headers:{'Cache-Control':'private, no-store'}})
 }catch{return Response.json({error:'School reporting unavailable'},{status:503})}
}
