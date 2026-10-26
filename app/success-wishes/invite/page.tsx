'use client'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import styles from '../Receiver.module.css'
type Invite={candidate:string;school:string;requestId:string}
export default function WishInvitePage(){
  const [invite,setInvite]=useState<Invite|null>(null)
  const [token,setToken]=useState('')
  const [error,setError]=useState('')
  useEffect(()=>{
    let active=true
    const raw=new URLSearchParams(window.location.hash.slice(1)).get('token')||''
    window.history.replaceState(null,'',window.location.pathname)
    if(!/^[0-9a-f]{64}$/.test(raw)){setError('This request link is missing or invalid.');return}
    setToken(raw)
    fetch('/api/success-wishes/receiver/request',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({token:raw}),cache:'no-store'})
      .then(async response=>{const payload=await response.json();if(!response.ok)throw Error(payload.error||'This request is unavailable.');return payload})
      .then(payload=>{if(active)setInvite(payload)}).catch(e=>{if(active)setError(e.message)})
    return()=>{active=false}
  },[])
  return <div className={styles.page}><header className={styles.top}><Link href="/success-wishes" className={styles.brand}>VIBESCHOOL / SUCCESS WISHES</Link><span className={styles.muted}>Personal request</span></header>
    <main className={styles.wrap}><div className={styles.hero}><p className={styles.eyebrow}>SOMEONE IS THINKING OF YOU</p><h1>A little encouragement can mean a lot.</h1><p>You have been invited to send a meaningful, private Success Wish.</p></div>
    {error&&<div className={styles.panel} role="alert"><h2>Invitation unavailable</h2><p className={styles.error}>{error}</p><Link href="/success-wishes" className={styles.secondary}>Explore Success Wishes</Link></div>}
    {!error&&!invite&&<div className={styles.panel} role="status">Checking your private request…</div>}
    {invite&&<div className={styles.panel}><p className={styles.eyebrow}>A REQUEST FROM</p><h2>{invite.candidate}</h2>
      {invite.school&&<p>{invite.school}</p>}
      <p>Choose one of VibeSchool’s four card designs, add your personal words and review them before paying KSh 50 when checkout is available.</p>
      <div className={styles.actions}><Link className={styles.primary} href={`/success-wishes#request=${token}`}>Create a Success Wish</Link></div>
      <p className={styles.muted}>This request does not give you access to the student’s inbox or other private messages.</p></div>}
    </main></div>
}
