import { createClient } from '@supabase/supabase-js'
import { verifiedFounderOperator } from '@/lib/success-wishes/mpesa-operator'
import { hashSecret } from '@/lib/success-wishes/security'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
const reply = (value: unknown, status=200) => Response.json(value, {status, headers:{'Cache-Control':'private, no-store'}})
const maskPhone=(v:unknown)=>typeof v==='string'&&v.length>=7?v.slice(0,4)+'••••'+v.slice(-3):null
type Card={candidate?:string;sender?:string;school?:string;examYear?:string;theme?:string}
type Entry={id:string;type:'paid'|'free';createdAt:string;sender:string;recipient:string;school:string;examYear:string;theme:string;openedAt:string|null;expiresAt:string|null;revoked:boolean;orderId:string|null;paymentStatus:string;amountKes:number|null;receipt:string|null;payer:string|null;refunded:boolean}
function entry(row:any,kind:'paid'|'free'):Entry{
 const o=kind==='paid'?row.success_wish_guest_orders:null
 const c:Card=(row.card && typeof row.card==='object'?row.card:null) || o?.card || {}
 return {id:row.id,type:kind,createdAt:row.created_at,sender:c.sender||'',recipient:c.candidate||'',school:c.school||'',examYear:c.examYear||'',theme:c.theme||'',openedAt:row.opened_at||row.inbox_opened_at||null,expiresAt:row.expires_at||null,revoked:!!row.revoked_at,orderId:o?.id||null,paymentStatus:o?.state||(kind==='free'?'free':'unknown'),amountKes:o?.amount_kes??null,receipt:o?.provider_receipt||null,payer:maskPhone(o?.payer_phone),refunded:!!o?.refunded_at}
}
export async function POST(req:Request){
 if(!await verifiedFounderOperator(req))return reply({error:'Forbidden'},403)
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY
 if(!url||!key)return reply({error:'Ledger unavailable'},503)
 let body:any
 try{body=await req.json()}catch{return reply({error:'Invalid request'},400)}
 const token=typeof body?.token==='string'?body.token.trim():''
 const search=typeof body?.search==='string'?body.search.trim():''
 const before=typeof body?.before==='string'?body.before:''
 if(token && !/^[a-f0-9]{64}$/.test(token))return reply({error:'Invalid private gift token'},400)
 if(search.length>80||before&&(!/^\d{4}-\d\d-\d\dT/.test(before)||!Number.isFinite(Date.parse(before))))return reply({error:'Invalid search'},400)
 const db=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}})
 try{
  const paidBase=()=>db.from('success_wish_guest_gifts').select('id,created_at,opened_at,inbox_opened_at,expires_at,revoked_at,card,success_wish_guest_orders!inner(id,card,state,amount_kes,payer_phone,provider_receipt,refunded_at)')
  const freeBase=()=>db.from('success_wish_free_gifts').select('id,created_at,opened_at,inbox_opened_at,expires_at,revoked_at,card')
  if(token){
   const h=hashSecret('success-wishes:paid-link:'+token)
   const [p,f]=await Promise.all([paidBase().eq('link_hash',h).maybeSingle(),freeBase().eq('link_hash',h).maybeSingle()])
   if(p.error||f.error)throw Error('Lookup failed')
   const records=[...(p.data?[entry(p.data,'paid')]:[]),...(f.data?[entry(f.data,'free')]:[])]
   return reply({records,next:null})
  }
  // Stable order is descending creation time. Cursor uses a strict upper bound.
  const loadPaid=async()=>{
   let q=paidBase().order('created_at',{ascending:false}).limit(100)
   if(before)q=q.lt('created_at',before)
   const {data,error}=await q
   if(error)throw error
   return (data||[]).map(r=>entry(r,'paid'))
  }
  const loadFree=async()=>{
   let q=freeBase().order('created_at',{ascending:false}).limit(100)
   if(before)q=q.lt('created_at',before)
   const {data,error}=await q
   if(error)throw error
   return (data||[]).map(r=>entry(r,'free'))
  }
  // Search is filtered server-side; scan bounded pages to avoid public query injection.
  // The founder can page through the entire ledger; no private tokens are returned.
  const needle=search.toLocaleLowerCase()
  const [paid,free]=await Promise.all([loadPaid(),loadFree()])
  const records=[...paid,...free].filter(r=>!needle||[r.id,r.orderId,r.sender,r.recipient,r.school,r.receipt].some(v=>v?.toLocaleLowerCase().includes(needle))).sort((a,b)=>b.createdAt.localeCompare(a.createdAt)).slice(0,50)
  const all=[...paid,...free].sort((a,b)=>b.createdAt.localeCompare(a.createdAt))
  const last=all[49]
  return reply({records,next:last?.createdAt||null,searchScope:search?'Loaded page only; continue pages to search older records':null})
 }catch{return reply({error:'Ledger records could not be loaded'},503)}
}
