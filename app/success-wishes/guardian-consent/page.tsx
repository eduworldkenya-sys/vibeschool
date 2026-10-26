'use client'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import styles from '../Receiver.module.css'

type Recipient = { id:string; name:string }
const api='/api/success-wishes/receiver/guardian-consent'

/**
 * Existing school-linked guardian account is required, but the student
 * does not need an inbox login or recovery code to stop access.
 */
export default function GuardianConsent() {
  const [recipients,setRecipients]=useState<Recipient[]>([])
  const [receiverId,setReceiverId]=useState('')
  const [challengeId,setChallengeId]=useState('')
  const [code,setCode]=useState('')
  const [busy,setBusy]=useState(false)
  const [error,setError]=useState('')
  const [notice,setNotice]=useState('')
  const [revoked,setRevoked]=useState(false)
  useEffect(()=>{
    let active=true
    void fetch(api,{cache:'no-store'}).then(async r=>{
      const body=await r.json()
      if(!r.ok)throw new Error(body.error||'Could not load linked students.')
      return body
    }).then(body=>{if(active)setRecipients(body.recipients||[])})
      .catch(e=>{if(active)setError(e instanceof Error?e.message:'Could not load guardian consent.')})
    return ()=>{active=false}
  },[])
  async function submit(action:'begin'|'confirm'){
    setBusy(true);setError('');setNotice('')
    try {
      const result=await fetch(api,{
        method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({action,receiverId,challengeId,code}),
      })
      const body=await result.json()
      if(!result.ok)throw new Error(body.error||'The consent request could not be completed.')
      if(action==='begin'){
        setChallengeId(body.challengeId)
        setCode('')
        setNotice(body.message||'Enter the code sent to your verified guardian phone.')
      }else{
        setRevoked(true)
        setChallengeId('')
        setCode('')
        setRecipients(all=>all.filter(item=>item.id!==receiverId))
        setNotice(body.message||'Consent withdrawn.')
      }
    }catch(e){setError(e instanceof Error?e.message:'Could not update guardian consent.')}
    finally{setBusy(false)}
  }
  return <div className={styles.page}>
    <header className={styles.top}>
      <Link className={styles.brand} href="/success-wishes">VIBESCHOOL / SUCCESS WISHES</Link>
      <span className={styles.muted}>Guardian consent</span>
    </header>
    <main className={styles.wrap}>
      <div className={styles.hero}>
        <p className={styles.eyebrow}>FOR PARENTS AND GUARDIANS</p>
        <h1>Stop access to a student’s wishes.</h1>
        <p>Already linked to your child’s school record? Sign in with that guardian account to withdraw your consent, even if the student has lost access to their inbox. We send a fresh code to your previously verified phone.</p>
      </div>
      {error&&<p className={styles.error} role="alert">{error}</p>}
      {notice&&<div className={styles.notice} role="status">{notice}</div>}
      {!revoked&&<section className={styles.panel}>
        <h2>Withdraw guardian consent</h2>
        <p>This closes access to all cards in the student’s private inbox. It does not automatically erase records subject to legal retention, and reactivation requires a separate review.</p>
        {recipients.length===0?<p>No active, school-verified students were found for this guardian account. If you need help withdrawing consent, contact VibeSchool support through your school.</p>:<div className={styles.form}>
          <label>Choose student
            <select value={receiverId} onChange={e=>{setReceiverId(e.target.value);setChallengeId('');setCode('');setNotice('')}}>
              <option value="">Select a student</option>
              {recipients.map(r=><option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
          </label>
          {challengeId?<div className={styles.form}>
            <label>Code sent to your verified guardian phone
              <input inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code}
                onChange={e=>setCode(e.target.value.replace(/\D/g,''))} placeholder="6-digit code"/>
            </label>
            <div className={styles.actions}>
              <button type="button" className={styles.secondary} disabled={busy} onClick={()=>void submit('begin')}>Send another code</button>
              <button type="button" className={styles.primary} disabled={busy||!/^[0-9]{6}$/.test(code)}
                onClick={()=>{if(window.confirm('Withdraw guardian consent and stop access to all these wishes?'))void submit('confirm')}}>Confirm withdrawal</button>
            </div>
          </div>:
          <button type="button" className={styles.primary} disabled={busy||!receiverId}
            onClick={()=>void submit('begin')}>Send withdrawal code</button>}
        </div>}
      </section>}
      <div className={styles.links}>
        <Link href="/success-wishes">Back to Success Wishes</Link>
        <Link href="/success-wishes/settings">Student privacy settings</Link>
      </div>
    </main>
  </div>
}
