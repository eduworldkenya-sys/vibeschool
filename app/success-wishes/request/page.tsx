'use client'
import Link from 'next/link'
import { useState } from 'react'
import styles from '../Receiver.module.css'
const API='/api/success-wishes/receiver/request'
type Invite={ id:string; phone:string; url:string; expiresInDays:number }
export default function AskForWish(){
  const [phone,setPhone]=useState('')
  const [relation,setRelation]=useState('Parent / Guardian')
  const [note,setNote]=useState("Hello! I'm preparing for my exams. Your encouragement would mean so much to me. Would you send me a VibeSchool Success Wish?")
  const [invite,setInvite]=useState<Invite|null>(null)
  const [error,setError]=useState('')
  const [busy,setBusy]=useState(false)
  async function makeRequest(e:React.FormEvent){
    e.preventDefault();setBusy(true);setError('')
    try{
      const r=await fetch(API,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({phone})})
      const p=await r.json()
      if(!r.ok)throw Error(p.error||'Could not create an invitation.')
      setInvite(p as Invite)
    }catch(e){setError(e instanceof Error?e.message:'Could not create this request.')}finally{setBusy(false)}
  }
  const message=invite?`${note}\n\nSend your wish here: ${invite.url}`:''
  const whatsapp=invite?`https://wa.me/${invite.phone.replace(/\D/g,'')}?text=${encodeURIComponent(message)}`:''
  const sms=invite?`sms:${invite.phone}?body=${encodeURIComponent(message)}`:''
  return <div className={styles.page}><header className={styles.top}><Link href="/success-wishes/inbox" className={styles.brand}>VIBESCHOOL / SUCCESS WISHES</Link><span className={styles.muted}>Ask for a wish</span></header>
    <main className={styles.wrap}><div className={styles.hero}><p className={styles.eyebrow}>A LITTLE ENCOURAGEMENT</p><h1>Ask someone special.</h1><p>Free to ask. KSh 50 for them to send a text wish.</p></div>
      <section className={styles.panel}><h2>Who would you like to invite?</h2>
        <form className={styles.form} onSubmit={makeRequest}>
          <label>Their relationship to you<select value={relation} onChange={e=>setRelation(e.target.value)}>
            <option>Parent / Guardian</option><option>Relative</option><option>Teacher / Mentor</option><option>Friend</option>
          </select></label>
          <label>Their Kenyan phone number<input type="tel" inputMode="tel" autoComplete="off" placeholder="0712 345 678" required value={phone} onChange={e=>{setPhone(e.target.value);setInvite(null)}} /></label>
          <label>Your invitation message<textarea maxLength={600} value={note} onChange={e=>setNote(e.target.value)} /></label>
          {error&&<p className={styles.error} role="alert">{error}</p>}
          <button type="submit" className={styles.primary} disabled={busy}>{busy?'Creating…':'Create my invitation'}</button>
        </form>
      </section>
      {invite&&<section className={styles.panel} aria-live="polite"><h2>Your invitation is ready</h2>
        <p>Share with your {relation.toLowerCase()}. Valid for {invite.expiresInDays} days.</p>
        <div className={styles.actions}><a className={styles.primary} href={whatsapp} target="_blank" rel="noopener noreferrer">Share on WhatsApp</a>
          <a className={styles.secondary} href={sms}>Share by SMS</a>
          <button className={styles.secondary} type="button" onClick={()=>void navigator.clipboard?.writeText(invite.url)}>Copy link</button></div>
        <p className={styles.muted}>Your phone may charge the normal SMS rate. VibeSchool does not send this invitation automatically.</p></section>}
      <div className={styles.links}><Link href="/success-wishes/inbox">Back to my wishes</Link></div>
    </main></div>
}
