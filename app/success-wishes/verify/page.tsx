'use client'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import styles from '../Receiver.module.css'
const API='/api/success-wishes/receiver/verify'
export default function VerifyWishReceiver(){
  const [challengeId,setChallengeId]=useState('')
  const [cardId,setCardId]=useState('')
  const [setupToken,setSetupToken]=useState('')
  const [consentRole,setConsentRole]=useState<'adult'|'guardian'|'verified'|''>('')
  const [acknowledged,setAcknowledged]=useState(false)
  useEffect(()=>{
    setCardId(new URLSearchParams(window.location.search).get('card')||'')
    const token=new URLSearchParams(window.location.hash.slice(1)).get('setup')||''
    if(/^[a-f0-9]{64}$/.test(token))setSetupToken(token)
  },[])
  const [otp,setOtp]=useState('')
  const [secret,setSecret]=useState<string|null>(null)
  const [done,setDone]=useState(false)
  const [busy,setBusy]=useState(false)
  const [error,setError]=useState('')
  async function request(method:'POST'|'PATCH',body:object){
    setBusy(true);setError('')
    try{
      const response=await fetch(API,{method,headers:{'Content-Type':'application/json'},body:JSON.stringify(setupToken?{...body,setupToken}:body)})
      const data=await response.json()
      if(!response.ok)throw Error(data.error||'Unable to verify your phone.')
      if(method==='POST'){setChallengeId(data.challengeId);setConsentRole(data.consentRole)}
      else{setSecret(data.recoveryCode||null);setDone(true)}
    }catch(e){setError(e instanceof Error?e.message:'Unable to verify your phone.')}finally{setBusy(false)}
  }
  return <div className={styles.page}><header className={styles.top}><Link href="/success-wishes" className={styles.brand}>VIBESCHOOL / SUCCESS WISHES</Link><span className={styles.muted}>Secure inbox setup</span></header>
    <main className={styles.wrap}><div className={styles.hero}><p className={styles.eyebrow}>KEEP EVERY WISH</p><h1>Save your surprises.</h1>
      <p>{setupToken?'Verify your registered phone before anyone pays. Then open your inbox to create a private wish request link.':'Verify the phone associated with this private gift. If the recipient is under 18, their already registered parent or guardian must give consent before the envelope can open.'}</p></div>
      <section className={styles.panel}>{done?<><h2>Your private inbox is ready</h2>
        {secret?<div className={styles.notice}><strong>Save your private recovery code now.</strong><p>Keep this separate from your card access code. To restore your inbox later you will need this code and an SMS verification on the registered phone.</p><code className={styles.code}>{secret}</code>
          <button type="button" className={styles.secondary} onClick={()=>void navigator.clipboard?.writeText(secret)}>Copy recovery code</button></div>
          :<p>Your existing student recovery code remains active. Keep it private.</p>}
        <div className={styles.actions}><Link href="/success-wishes/inbox" className={styles.primary}>Open My Success Wishes</Link>
          {cardId&&<Link href={'/success-wishes/invitation?card='+encodeURIComponent(cardId)} className={styles.secondary}>Open my card</Link>}</div></>
      :<><h2>{challengeId?'Complete private verification':'Verify the intended receiver'}</h2>
        <p>{challengeId?(consentRole==='guardian'?'The parent or guardian must check their registered phone for the six-digit code. It expires in five minutes.':'Check the registered phone for the six-digit code. It expires in five minutes.'):'Start from your private gift or recipient setup link. VibeSchool uses the previously provisioned adult or guardian identity, never a new phone number entered here.'}</p>
        {!challengeId?<button type="button" disabled={busy||(!cardId&&!setupToken)} className={styles.primary} onClick={()=>void request('POST',{cardId})}>{busy?'Sending…':'Send verification SMS'}</button>
        :<form className={styles.form} onSubmit={e=>{e.preventDefault();void request('PATCH',{cardId,challengeId,code:otp,consentRole,consentAcknowledged:consentRole==='verified'||acknowledged})}}>
          <label>SMS verification code<input autoComplete="one-time-code" inputMode="numeric" maxLength={6} required pattern="[0-9]{6}" value={otp} onChange={e=>setOtp(e.target.value.replace(/\D/g,'').slice(0,6))} placeholder="000000"/></label>
          {consentRole==='adult'&&<label className={styles.consentCheck}><input type="checkbox" checked={acknowledged} onChange={e=>setAcknowledged(e.target.checked)}/> I confirm I am at least 18, control the verified phone and agree to receive and privately store these wishes.</label>}
          {consentRole==='guardian'&&<label className={styles.consentCheck}><input type="checkbox" checked={acknowledged} onChange={e=>setAcknowledged(e.target.checked)}/> I confirm I am the authorised parent or guardian for this student and consent to their receiving and storing these private wishes.</label>}
          <button className={styles.primary} type="submit" disabled={busy||otp.length!==6||(consentRole!=='verified'&&!acknowledged)}>{busy?'Verifying…':'Verify and open inbox'}</button></form>}
        {!cardId&&!setupToken&&<p className={styles.error}>Open your private card link or enter its access code before starting verification.</p>}
        {challengeId&&<button type="button" className={styles.secondary} disabled={busy} onClick={()=>{setChallengeId('');setOtp('');setAcknowledged(false)}}>Request a new code</button>}
        {error&&<p className={styles.error} role="alert">{error}</p>}</>}
      </section><div className={styles.links}><Link href={cardId?'/success-wishes/invitation?card='+encodeURIComponent(cardId):'/success-wishes/open'}>Back to your card</Link><Link href="/success-wishes/recover">Already have a recovery code?</Link></div>
    </main></div>
}
