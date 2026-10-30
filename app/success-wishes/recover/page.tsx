'use client'
import {useEffect,useState} from 'react'
import Link from 'next/link'
import ReceiverAccount from '@/components/success-wishes/ReceiverAccount'
import LegacyReceiverRecovery from '@/components/success-wishes/LegacyReceiverRecovery'
import LostRecoveryLink from '@/components/success-wishes/LostRecoveryLink'
export default function RecoverWishes(){
 const [newPin,setNewPin]=useState(''),[confirmPin,setConfirmPin]=useState(''),[saving,setSaving]=useState(false),[resetError,setResetError]=useState(''),[newLink,setNewLink]=useState('')
 const [legacy,setLegacy]=useState(false),[hasLink,setHasLink]=useState(false),[choice,setChoice]=useState<'start'|'link'|'review'>('start'),[checking,setChecking]=useState(true),[signedIn,setSignedIn]=useState(false)
 useEffect(()=>{
  const query=new URLSearchParams(location.search),fragment=new URLSearchParams(location.hash.slice(1))
  setLegacy(query.get('legacy')==='1')
  if(fragment.has('recovery')){setHasLink(true);setChoice('link')}
  const controller=new AbortController()
  void fetch('/api/success-wishes/receiver/account',{cache:'no-store',signal:controller.signal}).then(r=>{if(!controller.signal.aborted)setSignedIn(r.ok)}).catch(()=>{}).finally(()=>{if(!controller.signal.aborted)setChecking(false)})
  return()=>controller.abort()
 },[])
 return <main style={{padding:'24px 16px 80px',maxWidth:480,margin:'0 auto'}}>
  {legacy?<LegacyReceiverRecovery/>:<>
   <h1 style={{fontSize:25,fontWeight:700,marginBottom:8}}>Forgot your PIN?</h1>
   <p style={{marginBottom:20}}>Your wishes are safe. Choose how to get back to your existing inbox.</p>
   {!checking&&signedIn&&<form onSubmit={async e=>{e.preventDefault();setResetError('');if(!/^\\d{4}$/.test(newPin)||newPin!==confirmPin){setResetError('Enter the same four-digit PIN twice.');return}setSaving(true);try{const res=await fetch('/api/success-wishes/receiver/account',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({action:'reset_signed_in',pin:newPin}),cache:'no-store'});const data=await res.json();if(!res.ok)throw Error(data.error||'Could not reset PIN.');setNewLink(data.recoveryUrl);setNewPin('');setConfirmPin('')}catch(error){setResetError(error instanceof Error?error.message:'Could not reset PIN.')}finally{setSaving(false)}}} style={{display:'grid',gap:12,marginBottom:20}}>
    <strong>This device already has access to your wishes.</strong>
    {newLink?<><p role="status">PIN changed. Your wishes remain in the same inbox. Save your new private recovery link.</p><textarea aria-label="New recovery link" readOnly value={newLink}/><button type="button" onClick={()=>void navigator.clipboard.writeText(newLink)}>Copy recovery link</button><Link href="/success-wishes/inbox">Open my wishes</Link></>:<>
     <p>Choose a new PIN. No SMS or support request needed.</p>
     <label>New 4-digit PIN<input type="password" inputMode="numeric" pattern="[0-9]{4}" maxLength={4} required value={newPin} onChange={e=>setNewPin(e.target.value.replace(/\\D/g,''))}/></label>
     <label>Confirm PIN<input type="password" inputMode="numeric" pattern="[0-9]{4}" maxLength={4} required value={confirmPin} onChange={e=>setConfirmPin(e.target.value.replace(/\\D/g,''))}/></label>
     {resetError&&<p role="alert">{resetError}</p>}
     <button disabled={saving}>{saving?'Changing PIN…':'Change PIN'}</button>
    </>}
   </form>}
   {!checking&&signedIn&&<div style={{padding:16,border:'1px solid #9ca3af',borderRadius:12,marginBottom:16}}>
    <strong>This device is already signed in.</strong>
    <p>You can open your wishes without entering a PIN.</p>
    <Link href="/success-wishes/inbox">Open my wishes</Link>
   </div>}
   {choice==='start'&&<div style={{display:'grid',gap:12}}>
    <button type="button" onClick={()=>setChoice('link')}>I saved my recovery link</button>
    <button type="button" onClick={()=>setChoice('review')}>Try another way</button>
    <Link href="/success-wishes/inbox">Back to My wishes</Link>
   </div>}
   {choice==='link'&&<><ReceiverAccount initialMode="recover"/>{!hasLink&&<button type="button" onClick={()=>setChoice('review')}>I don't have my recovery link</button>}</>}
   {choice==='review'&&<><LostRecoveryLink/><button type="button" onClick={()=>setChoice('start')}>Other recovery options</button></>}
  </>}
 </main>
}
