'use client'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import styles from '../Receiver.module.css'

type Card = { id:string; theme:string; sender:string|null; opened:boolean; createdAt:string }
type Inbox = { recipient:{ name:string; school:string }; count:number; unopened:number; cards:Card[] }
const API='/api/success-wishes/receiver/inbox'
export default function SuccessWishesInboxPage(){
  const router=useRouter()
  const [data,setData]=useState<Inbox|null>(null)
  const [error,setError]=useState('')
  const [busy,setBusy]=useState<string|null>(null)
  const [filter,setFilter]=useState<'all'|'unopened'>('all')
  useEffect(()=>{
    let active=true
    fetch(API,{cache:'no-store'}).then(async r=>{const p=await r.json();if(!r.ok)throw Error(p.error||'Verify your phone to open this inbox.');return p as Inbox})
      .then(p=>{if(active)setData(p)}).catch(e=>{if(active)setError(e.message)})
    return()=>{active=false}
  },[])
  async function openCard(id:string){
    setBusy(id);setError('')
    try{
      const r=await fetch(API,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({cardId:id})})
      const p=await r.json()
      if(!r.ok)throw Error(p.error||'Could not open this card.')
      router.push('/success-wishes/invitation')
    }catch(e){setError(e instanceof Error?e.message:'Could not open this card.')}finally{setBusy(null)}
  }
  async function signOut(){
    setBusy('signout')
    try{
      const r=await fetch(API,{method:'DELETE'})
      if(!r.ok)throw Error('Could not sign out.')
      router.replace('/success-wishes/recover')
    }catch(e){setError(e instanceof Error?e.message:'Could not sign out.');setBusy(null)}
  }
  const cards=(data?.cards||[]).filter(c=>filter==='all'||!c.opened)
  return <div className={styles.page}>
    <header className={styles.top}><Link href="/success-wishes" className={styles.brand}>VIBESCHOOL / SUCCESS WISHES</Link><span className={styles.muted}>Private inbox</span></header>
    <main className={styles.wrap}>
      <section className={styles.hero}><p className={styles.eyebrow}>MADE FOR YOU</p><h1>My Success Wishes</h1>
        <p>{data?`Every kind word, saved for ${data.recipient.name}.`:'All your personal encouragement in one place.'}</p>
      </section>
      {error && <div className={styles.panel} role="alert"><p className={styles.error}>{error}</p>
        {!data&&<div className={styles.actions}><Link className={styles.primary} href="/success-wishes/recover">Find My Wishes</Link><Link href="/success-wishes/invitation" className={styles.secondary}>Open card link</Link></div>}
      </div>}
      {!data&&!error&&<div className={styles.panel} role="status">Opening your private inbox…</div>}
      {data&&<>
        <div className={styles.stats}><div className={styles.stat}><strong>{data.count}</strong><span>Received wishes</span></div>
          <div className={styles.stat}><strong>{data.unopened}</strong><span>Unopened surprises</span></div></div>
        {data.recipient.school&&<p className={styles.muted}>{data.recipient.school}</p>}
        <nav className={styles.actions}><Link className={styles.primary} href="/success-wishes/request">Ask for a Wish</Link>
          <Link className={styles.secondary} href="/success-wishes/recover">Recovery options</Link></nav>
        <div className={styles.tabs}><button className={styles.tab} aria-pressed={filter==='all'} onClick={()=>setFilter('all')}>All ({data.count})</button>
          <button className={styles.tab} aria-pressed={filter==='unopened'} onClick={()=>setFilter('unopened')}>Unopened ({data.unopened})</button></div>
        {cards.length?<div className={styles.gifts}>{cards.map(card=><button key={card.id} type="button" className={styles.gift}
          disabled={busy!==null} onClick={()=>void openCard(card.id)} aria-label={`Open ${card.opened?'previously opened':'unopened'} private wish`}>
          <span>VIBESCHOOL · SUCCESS WISHES</span><b aria-hidden="true">✉</b>
          <strong>{card.opened?'A message to remember':'Someone special has a wish for you'}</strong>
          <small>{card.sender||'Someone special'} · {card.opened?'Opened':'Unopened'} · {new Date(card.createdAt).toLocaleDateString('en-KE')}</small>
        </button>)}</div>:<div className={styles.panel}><h2>{filter==='unopened'?'You have opened every wish':'Your inbox is ready'}</h2>
          <p>{filter==='unopened'?'Switch to All to revisit your cards.':'When someone sends a paid Success Wish to your verified identity, it will appear here.'}</p></div>}
        <div className={styles.links}><button className={styles.secondary} type="button" onClick={()=>void signOut()} disabled={busy!==null}>Sign out</button>
          <Link href="/success-wishes">Send a Wish</Link></div>
      </>}
    </main>
  </div>
}
