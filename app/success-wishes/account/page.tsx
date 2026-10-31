'use client'

import {useEffect,useState} from 'react'
import Link from 'next/link'
import {ArrowRight,ChevronDown,ChevronRight,Gift,HelpCircle,KeyRound,ShieldCheck,Users} from 'lucide-react'
import {broadcastKeepsakeChange} from '@/lib/success-wishes/receiver-pin-browser'
import styles from './page.module.css'

type Recipient={id:string;name:string;school?:string|null}
type Access='loading'|'signed-in'|'guest'|'unavailable'
type AccountState={access:Access;recipient:Recipient|null;count:number|null;deviceCount:number|null;notice:string}

export default function ReceiverAccountHub(){
 const [state,setState]=useState<AccountState>({access:'loading',recipient:null,count:null,deviceCount:null,notice:''})
 const [switching,setSwitching]=useState(false)
 const [actionError,setActionError]=useState('')
 useEffect(()=>{
  const controller=new AbortController()
  async function load(){
   const options={cache:'no-store' as const,signal:controller.signal}
   const [account,saved]=await Promise.allSettled([
    fetch('/api/success-wishes/receiver/account',options),
    fetch('/api/success-wishes/receiver/remembered',options)
   ])
   if(controller.signal.aborted)return
   let access:Access='unavailable',recipient:Recipient|null=null
   let count:number|null=null,deviceCount:number|null=null
   let notice=''
   if(account.status==='fulfilled'){
    if(account.value.ok){
     try{
      const payload=await account.value.json()
      if(payload.recipient?.id&&typeof payload.recipient.name==='string'){
       recipient=payload.recipient
       access='signed-in'
       const collection=await fetch('/api/success-wishes/receiver/collection',options)
       if(collection.ok){const data=await collection.json();count=Array.isArray(data.cards)?data.cards.length:null}
      }
     }catch{notice='Some account details are unavailable.'}
    }else if(account.value.status===401){access='guest'}
    else notice='Account access could not be checked.'
   }else{notice='Account access could not be checked.'}
   if(saved.status==='fulfilled'&&saved.value.ok){
    try{const data=await saved.value.json();if(Array.isArray(data.cards))deviceCount=data.cards.length}catch{/* Saved gifts can still be opened through their original links. */}
   }
   if(!controller.signal.aborted)setState({access,recipient,count,deviceCount,notice})
  }
  void load()
  return()=>controller.abort()
 },[])
 async function switchReceiver(){
  if(switching||state.access!=='signed-in')return
  if(!window.confirm('Switch receiver? This signs out of this device and clears saved gift access here. Keep private gift links before continuing.'))return
  setSwitching(true);setActionError('')
  try{
   const response=await fetch('/api/success-wishes/receiver/account',{method:'DELETE',cache:'no-store'})
   if(!response.ok)throw Error('Could not sign out safely. Please try again.')
   broadcastKeepsakeChange()
   window.location.assign('/success-wishes/open')
  }catch(error){
   setActionError(error instanceof Error?error.message:'Could not switch receiver.')
   setSwitching(false)
  }
 }
 const protectedInbox=state.access==='signed-in'
 const giftCount=protectedInbox?state.count:state.deviceCount
 const countLabel=giftCount===null?'View your collection':giftCount===0?'Your collection is ready':giftCount===1?'1 wish waiting for you':`${giftCount} wishes to enjoy`
 return <main className={styles.page}>
  <div className={styles.inner}>
   <header className={styles.header}>
    <p className={styles.kicker}>SUCCESS WISHES</p>
    <h1>My account</h1>
   </header>
   <section className={styles.giftSection} aria-label="Your gifts">
    <div className={styles.giftIntro}>
     <span className={styles.giftMark} aria-hidden="true"><Gift size={22}/></span>
     <div>
      <p className={styles.overline}>YOUR WISHES</p>
      <h2>{protectedInbox&&state.recipient?`For ${state.recipient.name}`:'Made for you'}</h2>
      <p className={styles.giftCount}>{state.access==='loading'?'Finding your wishes…':countLabel}</p>
     </div>
    </div>
    {protectedInbox&&state.recipient?.school&&<p className={styles.school}>{state.recipient.school}</p>}
    <Link href="/success-wishes/inbox" className={styles.primary}>View my gifts <ArrowRight size={17} aria-hidden="true"/></Link>
    <Link href="/success-wishes/request" className={styles.secondary}>Request a wish</Link>
   </section>
   {state.access==='guest'&&<p className={styles.guestHint}>No account needed to open a gift. Your private link works on its own.</p>}
   {state.access==='unavailable'&&<p role="status" className={styles.hint}>Account details are unavailable. Gifts saved on this device may still be opened.</p>}
   {state.notice&&state.access!=='unavailable'&&<p role="status" className={styles.hint}>{state.notice}</p>}
   <details className={styles.management}>
    <summary><span>Account & privacy</span><ChevronDown size={18} aria-hidden="true"/></summary>
    <div className={styles.links}>
     {!protectedInbox&&<Link href="/success-wishes/open"><KeyRound size={18}/><span>Open a PIN inbox</span><ChevronRight size={17}/></Link>}
     {protectedInbox&&<Link href="/success-wishes/recover"><KeyRound size={18}/><span>PIN & recovery</span><ChevronRight size={17}/></Link>}
     <Link href="/success-wishes/settings"><ShieldCheck size={18}/><span>Privacy & safety</span><ChevronRight size={17}/></Link>
     <Link href="/contact"><HelpCircle size={18}/><span>Get support</span><ChevronRight size={17}/></Link>
     {protectedInbox&&<button type="button" disabled={switching} onClick={()=>void switchReceiver()}><Users size={18}/><span>{switching?'Switching…':'Switch receiver'}</span><ChevronRight size={17}/></button>}
    </div>
   </details>
   {actionError&&<p role="alert" className={styles.error}>{actionError}</p>}
  </div>
 </main>
}
