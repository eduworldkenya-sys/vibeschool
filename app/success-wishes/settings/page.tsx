'use client'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import styles from '../Receiver.module.css'
type Gift = { id:string; sender:string|null; opened:boolean; createdAt:string }
type Rights = {id:string;kind:string;status:string;created_at:string}
const manage='/api/success-wishes/receiver/safety'
export default function SuccessWishSafety(){
  const [cards,setCards]=useState<Gift[]>([])
  const [requests,setRequests]=useState<Rights[]>([])
  const [selected,setSelected]=useState('')
  const [reason,setReason]=useState('')
  const [status,setStatus]=useState('')
  const [error,setError]=useState('')
  const [busy,setBusy]=useState(false)
  useEffect(()=>{
    let mounted=true
    void Promise.all([
      fetch('/api/success-wishes/receiver/inbox',{cache:'no-store'}).then(async r=>{const p=await r.json();if(!r.ok)throw Error(p.error||'Please verify your inbox.');return p}),
      fetch(manage,{cache:'no-store'}).then(async r=>{const p=await r.json();if(!r.ok)throw Error(p.error||'Please verify your inbox.');return p})
    ]).then(([inbox,rights])=>{
      if(!mounted)return
      setCards(inbox.cards||[])
      setRequests(rights.requests||[])
    }).catch(e=>{if(mounted)setError(e instanceof Error?e.message:'Unable to load your settings.')})
    return()=>{mounted=false}
  },[])
  async function act(action:'hide'|'report'|'delete_data'|'access_data'){
    setBusy(true);setError('');setStatus('')
    try{
      const r=await fetch(manage,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,cardId:selected,reason})})
      const p=await r.json()
      if(!r.ok)throw Error(p.error||'Could not save your request.')
      setStatus(p.message||'Your choice was saved.')
      if(action==='hide')setCards(list=>list.filter(c=>c.id!==selected))
      if(action==='hide'||action==='report'){setSelected('');setReason('')}
      if(action==='delete_data'||action==='access_data'){
        const q=await fetch(manage,{cache:'no-store'});if(q.ok)setRequests((await q.json()).requests||[])
      }
    }catch(e){setError(e instanceof Error?e.message:'Could not save your request.')}finally{setBusy(false)}
  }
  return <div className={styles.page}><header className={styles.top}><Link href="/success-wishes/inbox" className={styles.brand}>VIBESCHOOL / SUCCESS WISHES</Link><span className={styles.muted}>Safety &amp; privacy</span></header>
    <main className={styles.wrap}><div className={styles.hero}><p className={styles.eyebrow}>YOUR PRIVATE SPACE</p><h1>Keep your wishes safe.</h1><p>Only the verified receiver can manage their private inbox. You can report unwanted content, hide a wish or request a review of your data.</p></div>
      {error&&<p className={styles.error} role="alert">{error}</p>}
      {status&&<div className={styles.notice} role="status">{status}</div>}
      <section className={styles.panel}><h2>Manage a wish</h2><p>Choose a card without opening it. The sender’s identity stays a surprise until the card is opened.</p>
        <div className={styles.form}><label>Choose a received card<select value={selected} onChange={e=>setSelected(e.target.value)}>
          <option value="">Select a wish…</option>{cards.map((c,i)=><option key={c.id} value={c.id}>{c.opened?(c.sender||'Opened wish'):'Unopened surprise'} · {new Date(c.createdAt).toLocaleDateString('en-KE')} · #{i+1}</option>)}
        </select></label><label>Why are you reporting this wish? (optional until you report)<textarea maxLength={500} value={reason} onChange={e=>setReason(e.target.value)} placeholder="Describe unwanted or inappropriate content…"/></label>
        <div className={styles.actions}><button disabled={busy||!selected} className={styles.secondary} type="button" onClick={()=>void act('hide')}>Hide from inbox</button>
          <button disabled={busy||!selected||reason.trim().length<10} className={styles.primary} type="button" onClick={()=>void act('report')}>Submit private report</button></div></div>
      </section>
      <section className={styles.panel}><h2>Your data and privacy</h2><p>Request a review of your stored information or its deletion. These requests are reviewed and do not immediately erase payment or legal records.</p>
        <div className={styles.actions}><button disabled={busy} className={styles.secondary} type="button" onClick={()=>void act('access_data')}>Request my data</button>
          <button disabled={busy} className={styles.secondary} type="button" onClick={()=>{if(window.confirm('Request deletion of your Success Wishes data?'))void act('delete_data')}}>Request deletion</button></div>
        {requests.length>0&&<div className={styles.notice}><strong>Recent requests</strong>{requests.map(r=><p key={r.id}>{r.kind==='deletion'?'Data deletion':'Data access'} · {r.status} · {new Date(r.created_at).toLocaleDateString('en-KE')}</p>)}</div>}
      </section><div className={styles.links}><Link href="/success-wishes/inbox">Return to My Success Wishes</Link><Link href="/success-wishes/recover">Recovery options</Link></div>
    </main></div>
}
