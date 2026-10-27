'use client'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import ReceiverGift from '@/components/success-wishes/ReceiverGift'
import styles from '../Receiver.module.css'
export default function OpenSuccessWishCode(){
  const router=useRouter()
  const [code,setCode]=useState('')
  const [busy,setBusy]=useState(false)
  const [error,setError]=useState('')
  async function claim(event:React.FormEvent){
    event.preventDefault();setBusy(true);setError('')
    try{
      const r=await fetch('/api/success-wishes/receiver/card',{
        method:'POST',headers:{'Content-Type':'application/json'},cache:'no-store',
        body:JSON.stringify({code:code.trim().toUpperCase()})})
      const data=await r.json()
      if(!r.ok)throw Error(data.error||'The card access code is invalid.')
      router.push('/success-wishes/invitation?card=' + data.card.id)
    }catch(e){setError(e instanceof Error?e.message:'Unable to open this private card.')}finally{setBusy(false)}
  }
  return <div className={styles.page}><header className={styles.top}><Link href="/success-wishes" className={styles.brand}>VIBESCHOOL / SUCCESS WISHES</Link><span className={styles.muted}>Private access</span></header>
    <main className={styles.wrap}><div className={styles.hero}><p className={styles.eyebrow}>YOUR PRIVATE GIFT</p><h1>A wish is waiting.</h1><p>A little encouragement, ready to unwrap.</p></div>
      <div className={styles.entryGrid}><ReceiverGift label="Your private gift"/><section className={styles.panel}><h2>Open your gift</h2>
        <form className={styles.form} onSubmit={claim}>
          <label>Card access code<input autoComplete="off" maxLength={40} required value={code} onChange={e=>setCode(e.target.value)} placeholder="Paste your card access code"/></label>
          {error&&<p className={styles.error} role="alert">{error}</p>}
          <button type="submit" disabled={busy} className={styles.primary}>{busy?'Checking…':'Open my card'}</button>
        </form><details className={styles.help}><summary>Where is my code?</summary><p>Use the card access code in your SMS or ask the sender. It opens one card; verify your phone separately for your inbox. Sign out on shared phones.</p></details></section></div>
      <div className={styles.links}><Link href="/success-wishes/recover">Find My Wishes</Link></div>
    </main></div>
}
