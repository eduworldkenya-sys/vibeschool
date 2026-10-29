'use client'
import {useState} from 'react'

/** Reclaims only by possession of the original private capability plus an unlocked receiver PIN session.
 * Names, school and shared phone numbers are never used to discover or reassign private gifts. */
export default function ClaimExistingWish({inboxId,onClaimed}:{inboxId:string;onClaimed:()=>void}){
 const [input,setInput]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false)
 function tokenFrom(raw:string){
   const value=raw.trim()
   if(/^[a-f0-9]{64}$/i.test(value))return value.toLowerCase()
   try{
     const parsed=new URL(value)
     if(parsed.origin!==location.origin || parsed.pathname!=='/success-wishes/gift')return null
     const token=new URLSearchParams(parsed.hash.slice(1)).get('token')
     return token&&/^[a-f0-9]{64}$/i.test(token)?token.toLowerCase():null
   }catch{return null}
 }
 async function claim(e:React.FormEvent){
   e.preventDefault();if(busy)return;setError('')
   const token=tokenFrom(input)
   if(!token){setError('Paste the private Success Card link shared with you.');return}
   setBusy(true)
   try{
     const res=await fetch('/api/success-wishes/receiver/account',{
       method:'POST',headers:{'Content-Type':'application/json'},cache:'no-store',
       body:JSON.stringify({action:'attach',inboxId,token}),
     })
     const data=await res.json()
     if(!res.ok)throw new Error(data.error||'This card could not be saved.')
     setInput('');onClaimed()
   }catch(reason){setError(reason instanceof Error?reason.message:'Could not save card.')}
   finally{setBusy(false)}
 }
 return <details style={{margin:'16px 0',padding:'14px',border:'1px solid rgba(148,163,184,.25)',borderRadius:12}}>
   <summary style={{cursor:'pointer',fontWeight:600}}>Already received a card? Save it here</summary>
   <p style={{fontSize:13,margin:'12px 0'}}>Paste its private WhatsApp link. We will save it to this inbox after verifying the card belongs to this learner. No payment needed.</p>
   <form onSubmit={e=>void claim(e)} style={{display:'grid',gap:10}}>
     <label htmlFor="claim-wish-link">Private gift link</label>
     <input id="claim-wish-link" value={input} onChange={e=>setInput(e.target.value)}
       autoComplete="off" placeholder="Paste private gift link" required
       style={{width:'100%',padding:12,borderRadius:8,border:'1px solid #64748b',background:'transparent',color:'inherit'}}/>
     <button type="submit" disabled={busy} style={{padding:12,borderRadius:8,background:'#e2c572',color:'#17140d',fontWeight:600}}>
       {busy?'Saving…':'Save to My wishes'}
     </button>
   </form>
   {error&&<p role="alert" style={{color:'#fca5a5'}}>{error}</p>}
   <p style={{fontSize:12,marginTop:10}}>Lost the private link? Ask the sender to reopen their purchase and share your card again.</p>
 </details>
}
