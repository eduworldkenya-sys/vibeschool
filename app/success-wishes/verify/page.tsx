'use client'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import styles from '../Receiver.module.css'
const API='/api/success-wishes/receiver/verify'
export default function VerifyWishReceiver(){
  const [challengeId,setChallengeId]=useState('')
  const [cardId,setCardId]=useState('')
  const [consentRole,setConsentRole]=useState<'adult'|'guardian'|'verified'|''>('')
  const [acknowledged,setAcknowledged]=useState(false)
  const [replaceLostRecoveryCode,setReplaceLostRecoveryCode]=useState(false)
  useEffect(()=>{setCardId(new URLSearchParams(window.location.search).get('card')||'')},[])
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
      if(method==='POST'){setChallengeId(data.challengeId);setConsentRole(data.consentRole)}
      else{setSecret(data.recoveryCode||null);setDone(true)}
    }catch(e){setError(e instanceof Error?e.message:'Unable to verify your phone.')}finally{setBusy(false)}
  }
  return <div className={styles.page}><header className={styles.top}><Link href="/success-wishes" className={styles.brand}>VIBESCHOOL / SUCCESS WISHES</Link><span className={styles.muted}>Secure inbox setup</span></header>
    <main className={styles.wrap}><div className={styles.hero}><p className={styles.eyebrow}>KEEP EVERY WISH</p><h1>Your gift. Safely yours.</h1>
      <p>Verify your registered phone to open your wish.</p></div>
      <section className={styles.panel}>{done?<><h2>Your private inbox is ready</h2>
        {secret?<div className={styles.notice}><strong>Save your student recovery code now.</strong><p>Keep this private. Inbox recovery needs this code and an SMS check.</p><code className={styles.code}>{secret}</code>
          <button type="button" className={styles.secondary} onClick={()=>void navigator.clipboard?.writeText(secret)}>Copy recovery code</button></div>
          :<p>Your existing student recovery code remains active. If you lost it, verify this card again and select “I lost my recovery code”.</p>}
        <div className={styles.actions}><Link href="/success-wishes/inbox" className={styles.primary}>Open my inbox</Link>
          {cardId&&<Link href={'/success-wishes/invitation?card='+encodeURIComponent(cardId)} className={styles.secondary}>Open my card</Link>}</div></>
      :<><h2>{challengeId?'Enter your SMS code':'One quick check'}</h2>
        <p>{challengeId?(consentRole==='guardian'?'Ask your guardian for the six-digit SMS code. Valid for five minutes.':'Enter the six-digit SMS code. Valid for five minutes.'):'We’ll send a code to the registered adult or guardian phone.'}</p>
        {!challengeId?<button type="button" disabled={busy||!cardId} className={styles.primary} onClick={()=>void request('POST',{cardId})}>{busy?'Sending…':'Send my code'}</button>
        :<form className={styles.form} onSubmit={e=>{e.preventDefault();void request('PATCH',{cardId,challengeId,code:otp,consentRole,consentAcknowledged:consentRole==='verified'||acknowledged,replaceLostRecoveryCode})}}>
          <label>SMS verification code<input autoComplete="one-time-code" inputMode="numeric" maxLength={6} required pattern="[0-9]{6}" value={otp} onChange={e=>setOtp(e.target.value.replace(/\D/g,'').slice(0,6))} placeholder="000000"/></label>
          {consentRole==='adult'&&<label className={styles.consentCheck}><input type="checkbox" checked={acknowledged} onChange={e=>setAcknowledged(e.target.checked)}/> I confirm I am at least 18, control the verified phone and agree to receive and privately store these wishes.</label>}
          {consentRole==='guardian'&&<label className={styles.consentCheck}><input type="checkbox" checked={acknowledged} onChange={e=>setAcknowledged(e.target.checked)}/> I confirm I am the authorised parent or guardian for this student and consent to their receiving and storing these private wishes.</label>}
          <label className={styles.consentCheck}><input type="checkbox" checked={replaceLostRecoveryCode} onChange={e=>setReplaceLostRecoveryCode(e.target.checked)}/> I lost my recovery code. Replace it after verification; my old recovery code will stop working.</label>
          <button className={styles.primary} type="submit" disabled={busy||otp.length!==6||(consentRole!=='verified'&&!acknowledged)}>{busy?'Verifying…':'Verify & open inbox'}</button></form>}
        {!cardId&&<p className={styles.error}>Open your private card link or enter its access code before starting verification.</p>}
        {challengeId&&<button type="button" className={styles.secondary} disabled={busy} onClick={()=>{setChallengeId('');setOtp('');setAcknowledged(false)}}>Request a new code</button>}
        {error&&<p className={styles.error} role="alert">{error}</p>}</>}
      </section><div className={styles.links}><Link href={cardId?'/success-wishes/invitation?card='+encodeURIComponent(cardId):'/success-wishes/open'}>Back to your card</Link><Link href="/success-wishes/recover">Already have a recovery code?</Link></div>
    </main></div>
}
