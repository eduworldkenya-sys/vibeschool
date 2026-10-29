'use client'
import {useEffect,useRef,useState} from 'react'
import Link from 'next/link'
import {watchKeepsakeChange} from '@/lib/success-wishes/receiver-pin-browser'
import ReceiverAccount from '@/components/success-wishes/ReceiverAccount'
import styles from '@/components/success-wishes/ReceiverAccount.module.css'

type RequestRecord={id:string;invitee_phone_e164:string;created_at:string;expires_at:string;cancelled_at:string|null}
const DEFAULT_NOTE='Your encouragement would mean so much to me. Would you send me a Success Wish?'
const whatsappUrl=(phone:string,message:string)=>'https://wa.me/'+phone.replace(/\D/g,'')+'?text='+encodeURIComponent(message)
export default function RequestWish(){
 const [ready,setReady]=useState(false),[inboxId,setInboxId]=useState(''),[loading,setLoading]=useState(true),[phone,setPhone]=useState(''),[name,setName]=useState(''),[note,setNote]=useState(DEFAULT_NOTE),[url,setUrl]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false),[requests,setRequests]=useState<RequestRecord[]>([]),[cancelling,setCancelling]=useState('')
 const generation=useRef({value:0})
 async function load(){
  const revision=++generation.current.value;setLoading(true);setError('')
  try{
   const r=await fetch('/api/success-wishes/receiver/account',{cache:'no-store'})
   if(revision!==generation.current.value)return
   if(r.status===401){setReady(false);return}
   if(!r.ok)throw Error('Your inbox is temporarily unavailable.')
   const p=await r.json();setName(p.recipient.name);setInboxId(p.recipient.id);setReady(true)
   const history=await fetch('/api/success-wishes/receiver/request',{cache:'no-store'})
   if(revision!==generation.current.value)return
   if(history.ok){const h=await history.json();setRequests(h.requests||[])}
  }catch(e){if(revision===generation.current.value)setError(e instanceof Error?e.message:'Please try again.')}
  finally{if(revision===generation.current.value)setLoading(false)}
 }
 useEffect(()=>{const state=generation.current;void load();const stop=watchKeepsakeChange(()=>{state.value++;setReady(false);setName('');setUrl('');setRequests([]);setLoading(false)});return()=>{state.value++;stop()}},[])
 async function create(e:React.FormEvent){
  e.preventDefault();if(busy)return;setBusy(true);setError('')
  const revision=generation.current.value
  try{
   const r=await fetch('/api/success-wishes/receiver/request',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({phone,inboxId})})
   const p=await r.json();if(!r.ok)throw Error(p.error||'Could not create your request.')
   if(revision!==generation.current.value)return
   setUrl(p.url);setPhone(p.phone)
   const message='Hello, it’s '+name+'. '+note+'\n\nSend your wish here: '+p.url
   window.location.assign(whatsappUrl(p.phone,message))
  }catch(e){if(revision===generation.current.value)setError(e instanceof Error?e.message:'Please try again.')}
  finally{setBusy(false)}
 }
 async function cancel(id:string){
  if(cancelling)return;setCancelling(id);setError('')
  try{
   const r=await fetch('/api/success-wishes/receiver/request',{method:'DELETE',headers:{'Content-Type':'application/json'},body:JSON.stringify({requestId:id})})
   if(!r.ok)throw Error('Could not cancel the request.')
   setRequests(prev=>prev.map(item=>item.id===id?{...item,cancelled_at:new Date().toISOString()}:item))
  }catch(e){setError(e instanceof Error?e.message:'Please try again.')}finally{setCancelling('')}
 }
 const message='Hello, it’s '+name+'. '+note+'\n\nSend your wish here: '+url
 return <main className={styles.requestPage}>
  {loading?<p role="status">Opening your wishes…</p>:!ready?<ReceiverAccount initialMode="create" onReady={()=>void load()}/>:<section className={styles.panel}>
   <h2>Request a wish</h2><p>Invite someone to send you a Success Card.</p>
   <form onSubmit={create} className={styles.form}>
    <label>Their WhatsApp number<input required type="tel" autoComplete="tel" inputMode="tel" value={phone} onChange={e=>{setPhone(e.target.value);setUrl('')}} placeholder="0712 345 678"/></label>
    <label>Your message<textarea required maxLength={600} value={note} onChange={e=>setNote(e.target.value)}/></label>
    <button disabled={busy}>{busy?'Preparing…':'Share via WhatsApp'}</button>
   </form>
   {error&&<p role="alert" className={styles.error}>{error}</p>}
   {url&&<div className={styles.requestResult}><p>Request ready · Valid for 7 days.</p><a href={whatsappUrl(phone,message)} target="_blank" rel="noopener noreferrer">Share via WhatsApp</a><p>WhatsApp opens with your message. Tap Send there to share it.</p></div>}
   {requests.length>0&&<section className={styles.requestHistory} aria-label="My requests"><h3>My requests</h3>{requests.map(item=>{
    const status=item.cancelled_at?'Cancelled':new Date(item.expires_at).getTime()<=Date.now()?'Expired':'Active'
    return <div key={item.id} className={styles.requestRow}><div><strong>{item.invitee_phone_e164}</strong><small>{status} · {new Date(item.created_at).toLocaleDateString('en-KE')}</small></div>{status==='Active'&&<button type="button" className={styles.secondary} disabled={!!cancelling} onClick={()=>void cancel(item.id)}>{cancelling===item.id?'Cancelling…':'Cancel'}</button>}</div>
   })}<p>To share a new link, create another request above.</p></section>}
   <p><Link href="/success-wishes/inbox">My wishes</Link></p>
  </section>}
 </main>
}
