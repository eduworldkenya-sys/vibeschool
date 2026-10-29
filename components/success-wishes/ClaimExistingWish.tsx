'use client'
import {useState} from 'react'
import styles from './ClaimExistingWish.module.css'

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
 return <details className={styles.claim}>
   <summary className={styles.summary}>Already received a card? Save it here</summary>
   <p className={styles.explainer}>Paste its private WhatsApp link. We will save it to this inbox after verifying the card belongs to this learner. No payment needed.</p>
   <form onSubmit={e=>void claim(e)} className={styles.form}>
     <label htmlFor="claim-wish-link">Private gift link</label>
     <input id="claim-wish-link" value={input} onChange={e=>setInput(e.target.value)}
       autoComplete="off" placeholder="Paste private gift link" required
       className={styles.input}/>
     <button type="submit" disabled={busy} className={styles.button}>
       {busy?'Saving…':'Save to My wishes'}
     </button>
   </form>
   {error&&<p role="alert" className={styles.error}>{error}</p>}
   <p className={styles.hint}>Lost the private link? Ask the sender to reopen their purchase and share your card again.</p>
 </details>
}
