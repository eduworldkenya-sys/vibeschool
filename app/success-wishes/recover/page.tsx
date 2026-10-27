'use client'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import styles from '../Receiver.module.css'
const API='/api/success-wishes/receiver/recover'
export default function RecoverWishes(){
  const router=useRouter()
  const [phone,setPhone]=useState('')
  const [recoveryCode,setRecoveryCode]=useState('')
  const [challengeId,setChallengeId]=useState('')
  const [otp,setOtp]=useState('')
  const [error,setError]=useState('')
  const [busy,setBusy]=useState(false)
  async function submit(method:'POST'|'PATCH'){
    setBusy(true);setError('')
    try{
      const r=await fetch(API,{method,headers:{'Content-Type':'application/json'},
        body:JSON.stringify({phone,recoveryCode:recoveryCode.trim().toUpperCase(),challengeId,code:otp})})
      const p=await r.json()
      if(!r.ok)throw Error(p.error||'Unable to recover this inbox.')
      if(method==='POST')setChallengeId(p.challengeId)
      else router.replace('/success-wishes/inbox')
    }catch(e){setError(e instanceof Error?e.message:'Unable to recover this inbox.')}finally{setBusy(false)}
  }
  return <div className={styles.page}><header className={styles.top}><Link className={styles.brand} href="/success-wishes">VIBESCHOOL / SUCCESS WISHES</Link><span className={styles.muted}>Private recovery</span></header>
    <main className={styles.wrap}><div className={styles.hero}><p className={styles.eyebrow}>WELCOME BACK</p><h1>Find My Wishes.</h1>
      <p>Lost your original card link? Use your registered phone and your personal student recovery code to restore your own inbox.</p></div>
      <section className={styles.panel}><h2>{challengeId?'Verify your phone':'Recover your inbox'}</h2>
        <form className={styles.form} onSubmit={e=>{e.preventDefault();void submit(challengeId?'PATCH':'POST')}}>
          {!challengeId?<><label>Registered Kenyan phone number<input type="tel" autoComplete="tel" inputMode="tel" required placeholder="0712 345 678" value={phone} onChange={e=>setPhone(e.target.value)} /></label>
            <label>Student recovery code<input type="text" autoComplete="off" required maxLength={32} placeholder="32-character recovery code" value={recoveryCode} onChange={e=>setRecoveryCode(e.target.value)} /></label></>
          :<><p>Check your SMS for the six-digit verification code. It expires after five minutes.</p>
            <label>SMS verification code<input type="text" inputMode="numeric" autoComplete="one-time-code" maxLength={6} pattern="[0-9]{6}" value={otp} onChange={e=>setOtp(e.target.value.replace(/\D/g,'').slice(0,6))} required/></label></>}
          {error&&<p className={styles.error} role="alert">{error}</p>}
          <button type="submit" className={styles.primary} disabled={busy||(!!challengeId&&otp.length!==6)}>{busy?'Please wait…':challengeId?'Open My Success Wishes':'Send verification SMS'}</button>
        </form>
        <p>Each student has a different recovery code, even when a parent’s phone is shared. Names or admission numbers are not sufficient for recovery.</p>
      </section>
      <div className={styles.links}><Link href="/success-wishes/open">I have a card access code</Link><Link href="/contact">Lost your phone or recovery code? Contact support</Link></div>
    </main></div>
}
