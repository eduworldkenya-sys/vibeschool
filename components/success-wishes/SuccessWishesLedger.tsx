'use client'
import {useState} from 'react'
import {HQPanel,HQ_THEME,hqButtonStyle} from '@/components/hq/HQShell'
import {hqSupabase} from '@/lib/hq/supabase'
type RecordRow={id:string;type:'paid'|'free';createdAt:string;sender:string;recipient:string;school:string;examYear:string;openedAt:string|null;expiresAt:string|null;revoked:boolean;orderId:string|null;paymentStatus:string;amountKes:number|null;receipt:string|null;payer:string|null;refunded:boolean}
const date=(v:string|null)=>v?new Date(v).toLocaleString('en-KE',{timeZone:'Africa/Nairobi',dateStyle:'medium',timeStyle:'short'}):'—'
export default function SuccessWishesLedger(){
 const [search,setSearch]=useState(''),[token,setToken]=useState(''),[rows,setRows]=useState<RecordRow[]>([]),[cursor,setCursor]=useState<string|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState(''),[scope,setScope]=useState<string|null>(null),[loaded,setLoaded]=useState(false)
 async function load(more=false){
  if(busy)return
  setBusy(true);setError('')
  try{
   const {data,error:authError}=await hqSupabase.auth.getSession()
   if(authError||!data.session?.access_token)throw Error('Sign in to HQ first.')
   const resp=await fetch('/api/hq/success-wishes-ledger',{method:'POST',cache:'no-store',headers:{Authorization:'Bearer '+data.session.access_token,'Content-Type':'application/json'},body:JSON.stringify({search,token:token.trim(),before:more?cursor:null})})
   const result=await resp.json()
   if(!resp.ok)throw Error(result.error||'Ledger unavailable')
   setRows(old=>more?[...old,...result.records]:result.records)
   setCursor(result.next);setScope(result.searchScope||null);setLoaded(true)
  }catch(e){setError(e instanceof Error?e.message:'Ledger unavailable')}finally{setBusy(false)}
 }
 return <HQPanel title="Success Cards · Individual ledger" description="Founder-only lookup. No raw private tokens, card messages or full phone numbers are displayed.">
  <form onSubmit={e=>{e.preventDefault();void load(false)}} style={{display:'grid',gap:10}}>
   <label>Search sender, recipient, order, card or receipt
    <input value={search} onChange={e=>setSearch(e.target.value)} maxLength={80} placeholder="Name or reference" style={{width:'100%',minHeight:42,background:HQ_THEME.panelSoft,color:HQ_THEME.text,border:'1px solid '+HQ_THEME.border,borderRadius:8,padding:10}}/>
   </label>
   <label>Private gift link token (founder investigation only)
    <input value={token} onChange={e=>setToken(e.target.value)} type="password" autoComplete="off" placeholder="Paste 64-character token, optional" style={{width:'100%',minHeight:42,background:HQ_THEME.panelSoft,color:HQ_THEME.text,border:'1px solid '+HQ_THEME.border,borderRadius:8,padding:10}}/>
   </label>
   <button type="submit" disabled={busy} style={hqButtonStyle}>{busy?'Loading…':'Find cards'}</button>
  </form>
  {error&&<p role="alert" style={{color:HQ_THEME.red}}>{error}</p>}
  {scope&&<p style={{color:HQ_THEME.muted,fontSize:12}}>{scope}</p>}
  {loaded&&<><p style={{color:HQ_THEME.muted,fontSize:12}}>{rows.length} matching records loaded. Names are entered by senders and are not verified identities.</p>
  <div style={{overflowX:'auto'}}><table style={{width:'100%',borderCollapse:'collapse',fontSize:13,textAlign:'left'}}>
  <thead><tr>{['Created','Recipient','Sender','Type','Payment','Opened','Reference'].map(t=><th key={t} scope="col" style={{padding:8}}>{t}</th>)}</tr></thead>
  <tbody>{rows.map(r=><tr key={r.type+r.id} style={{borderTop:'1px solid '+HQ_THEME.border}}>
   <td style={{padding:8}}>{date(r.createdAt)}</td><td style={{padding:8}}>{r.recipient||'—'}{r.school?<small style={{display:'block'}}>{r.school}</small>:null}</td><td style={{padding:8}}>{r.sender||'—'}</td>
   <td style={{padding:8}}>{r.type}</td><td style={{padding:8}}>{r.refunded?'refunded':r.paymentStatus}{r.amountKes!==null?' · KSh '+r.amountKes:''}{r.receipt?<small style={{display:'block'}}>Receipt: {r.receipt}</small>:null}{r.payer?<small style={{display:'block'}}>Payer: {r.payer}</small>:null}</td>
   <td style={{padding:8}}>{date(r.openedAt)}</td><td style={{padding:8,fontFamily:'monospace'}} title={r.id}>{r.id.slice(0,8)}…{r.revoked?' (revoked)':''}</td>
  </tr>)}</tbody></table></div>
  {rows.length===0&&<p>No cards found in this lookup.</p>}
  {cursor&&!token&&<button type="button" disabled={busy} style={hqButtonStyle} onClick={()=>void load(true)}>Load older cards</button>}
  </>}
 </HQPanel>
}
