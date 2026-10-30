'use client'
import {useEffect,useState} from 'react'
import {hqSupabase} from '@/lib/hq/supabase'
import {HQPage,HQPanel} from '@/components/hq/HQShell'
type Row={id:string;orderId:string|null;kind:string;status:string;paid:boolean;createdAt:string;claimed:boolean;opened:boolean;receiverId:string|null;deliveryRecipientId?:string|null;recipient:string;sender:string;deliveryAddress:string;receipt:string}
type Ledger={summary:{orders:number;paidOrders:number;verifiedRevenueKes:number;cards:number;claimed:number;opened:number;receiverAccounts:number};rows:Row[];notice:string}
export default function SuccessWishesLedger(){
 const [search,setSearch]=useState('')
 const [data,setData]=useState<Ledger|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(true)
 useEffect(()=>{let live=true;(async()=>{try{const {data:auth}=await hqSupabase.auth.getSession();if(!auth.session)throw Error('Sign in to HQ.');const response=await fetch('/api/hq/success-wishes/ledger',{headers:{Authorization:'Bearer '+auth.session.access_token},cache:'no-store'});const result=await response.json();if(!response.ok)throw Error(result.error||'Could not load ledger.');if(live)setData(result)}catch(e){if(live)setError(e instanceof Error?e.message:'Could not load ledger.')}finally{if(live)setBusy(false)}})();return()=>{live=false}},[])
 const needle=search.trim().toLowerCase()
 const rows=data?.rows.filter(r=>!needle||[r.id,r.orderId,r.receiverId,r.deliveryRecipientId,r.recipient,r.sender,r.deliveryAddress,r.receipt].some(v=>v?.toLowerCase().includes(needle)))||[]
 return <HQPage title="Success Wishes ledger"><HQPanel>
  {busy&&<p role="status">Loading ledger…</p>}
  {error&&<p role="alert">{error}</p>}
  {data&&<><div style={{display:'flex',gap:16,flexWrap:'wrap'}}>{Object.entries(data.summary).map(([label,value])=><div key={label} style={{padding:12,border:'1px solid #64748b',borderRadius:10}}><strong>{value}</strong><div>{label.replace(/([A-Z])/g,' $1')}</div></div>)}</div>
  <p>{data.notice}</p><label>Find a card<input type="search" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Name, number, order or receipt" style={{display:'block',padding:12,width:'min(100%,440px)',marginBottom:16}}/></label><div style={{overflowX:'auto'}}><table style={{width:'100%',textAlign:'left'}}><thead><tr><th>Card</th><th>Recipient</th><th>Sender</th><th>Delivery address</th><th>Type</th><th>Order</th><th>Payment</th><th>Claimed</th><th>Opened</th><th>Created</th></tr></thead><tbody>{rows.map(r=><tr key={r.kind+r.id}><td>{r.id.slice(0,8)}</td><td>{r.recipient}<small style={{display:'block'}}>{r.deliveryRecipientId||r.receiverId}</small></td><td>{r.sender}</td><td>{r.deliveryAddress||'Link only'}</td><td>{r.kind}</td><td>{r.orderId?.slice(0,8)||'—'}</td><td>{r.paid?'Verified':r.status}<small style={{display:'block'}}>{r.receipt}</small></td><td>{r.claimed?'Yes':'No'}</td><td>{r.opened?'Yes':'No'}</td><td>{new Date(r.createdAt).toLocaleDateString('en-KE')}</td></tr>)}</tbody></table></div></>}
 </HQPanel></HQPage>
}
