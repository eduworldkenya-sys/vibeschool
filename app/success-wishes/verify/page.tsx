'use client'
import Link from 'next/link'
import { useState } from 'react'
import styles from '../Receiver.module.css'
const API='/api/success-wishes/receiver/verify'
export default function VerifyWishReceiver(){
  const [challengeId,setChallengeId]=useState('')
  const [otp,setOtp]=useState('')
  const [secret,setSecret]=useState<string|null>(null)
  const [done,setDone]=useState(false)
  const [busy,setBusy]=useState(false)
  const [error,setError]=useState('')
  async function request(method:'POST'|'PATCH',body:object){
    setBusy(true);setError('')
    try{
      const response=await fetch(API,{method,headers:{'Content-Type':'application/json'},body:JSON.stringify(body)})
      const data=await response.json()
      if(!response.ok)throw Error(data.error||'Unable to verify your phone.')
      if(method==='POST')setChallengeId(data.challengeId)
      else{setSecret(data.recoveryCode||null);setDone(true)}
    }catch(e){setError(e instanceof Error?e.message:'Unable to verify your phone.')}finally{setBusy(false)}
  }
  return <div className={styles.page}><header className={styles.top}><Link href="/success-wishes" className={styles.brand}>VIBESCHOOL / SUCCESS WISHES</Link><span className={styles.muted}>Secure inbox setup</span></header>
    <main className={styles.wrap}><div className={styles.hero}><p className={styles.eyebrow}>KEEP EVERY WISH</p><h1>Save your surprises.</h1>
      <p>Verify the phone associated with your private card to unlock your personal inbox. A phone alone cannot identify a student.</p></div>
      <section className={styles.panel}>{done?<><h2>Your private inbox is ready</h2>
        {secret?<div className={styles.notice}><strong>Save your student recovery code now.</strong><p>Keep this separate from your card access code. To restore your inbox later you will need this code and an SMS verification on the registered phone.</p><code className={styles.code}>{secret}</code>
          <button type="button" className={styles.secondary} onClick={()=>void navigator.clipboard?.writeText(secret)}>Copy recovery code</button></div>
          :<p>Your existing student recovery code remains active. Keep it private.</p>}
        <div className={styles.actions}><Link href="/success-wishes/inbox" className={styles.primary}>Open My Success Wishes</Link></div></>
      :<><h2>{challengeId?'Enter your six-digit code':'Verify your receiver phone'}</h2>
        <p>{challengeId?'Check the SMS sent to your registered phone. The code expires in five minutes.':'Start from a working private card link; we will send a verification code to the phone associated with that card.'}</p>
        {!challengeId?<button type="button" disabled={busy} className={styles.primary} onClick={()=>void request('POST',{})}>{busy?'Sending…':'Send verification SMS'}</button>
        :<form className={styles.form} onSubmit={e=>{e.preventDefault();void request('PATCH',{challengeId,code:otp})}}>
          <label>SMS verification code<input autoComplete="one-time-code" inputMode="numeric" maxLength={6} required pattern="[0-9]{6}" value={otp} onChange={e=>setOtp(e.target.value.replace(/\D/g,'').slice(0,6))} placeholder="000000"/></label>
          <button className={styles.primary} type="submit" disabled={busy||otp.length!==6}>{busy?'Verifying…':'Verify and open inbox'}</button></form>}
        {error&&<p className={styles.error} role="alert">{error}</p>}</>}
      </section><div className={styles.links}><Link href="/success-wishes/invitation">Back to your card</Link><Link href="/success-wishes/recover">Already have a recovery code?</Link></div>
    </main></div>
}
