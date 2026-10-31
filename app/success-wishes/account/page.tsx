'use client'

import {useEffect,useState} from 'react'
import {broadcastKeepsakeChange} from '@/lib/success-wishes/receiver-pin-browser'
import Link from 'next/link'
import {UserRound,KeyRound,ShieldCheck,Users,Inbox,HelpCircle,ArrowRight,LockKeyhole} from 'lucide-react'

type Account={recipient:{id:string;name:string;school:string;phone:string;examYear:string}}
type Collection={cards?:unknown[];recipient?:{name:string}}
const actions=[
 {href:'/success-wishes/inbox',label:'My wishes',description:'View the cards you can access',icon:Inbox},
 {href:'/success-wishes/recover',label:'PIN & recovery',description:'Change your PIN or recover access',icon:KeyRound},
 {href:'/success-wishes/settings',label:'Privacy & safety',description:'Manage consent, reports and data requests',icon:ShieldCheck},
 {href:'/contact',label:'Get support',description:'Help with lost access or account questions',icon:HelpCircle},
]
export default function ReceiverAccountHub(){
 const [account,setAccount]=useState<Account|null>(null)
 const [collection,setCollection]=useState<Collection|null>(null)
 const [rememberedCount,setRememberedCount]=useState(0)
 const [checking,setChecking]=useState(true)
 const [error,setError]=useState('')
 const [switching,setSwitching]=useState(false)
 async function switchReceiver(){
  if(switching)return
  setSwitching(true);setError('')
  try{
   const r=await fetch('/api/success-wishes/receiver/account',{method:'DELETE',cache:'no-store'})
   if(!r.ok)throw Error('Could not safely lock this inbox. Try again.')
   broadcastKeepsakeChange()
   window.location.assign('/success-wishes/open')
  }catch(e){setError(e instanceof Error?e.message:'Could not switch receiver.');setSwitching(false)}
 }
 useEffect(()=>{
  const controller=new AbortController()
  async function load(){
   try{
    const r=await fetch('/api/success-wishes/receiver/account',{cache:'no-store',signal:controller.signal})
    if(r.ok){const data:Account=await r.json();if(!controller.signal.aborted)setAccount(data)}
    else if(r.status!==401)throw Error('Account details are temporarily unavailable.')
    const c=await fetch('/api/success-wishes/receiver/collection',{cache:'no-store',signal:controller.signal})
    if(c.ok){const data:Collection=await c.json();if(!controller.signal.aborted)setCollection(data)}
    const saved=await fetch('/api/success-wishes/receiver/remembered',{cache:'no-store',signal:controller.signal})
    if(saved.ok){const data=await saved.json();if(!controller.signal.aborted)setRememberedCount(Array.isArray(data.cards)?data.cards.length:0)}
   }catch(e){if(!controller.signal.aborted)setError(e instanceof Error?e.message:'Could not check this account.')}
   finally{if(!controller.signal.aborted)setChecking(false)}
  }
  void load()
  return()=>controller.abort()
 },[])
 const person=account?.recipient
 return <main className="receiver-account-hub mx-auto w-full max-w-3xl px-4 py-8 pb-24 text-slate-100 sm:px-6 sm:py-12">
  <div className="account-heading mb-7 flex items-center gap-3"><span className="flex h-12 w-12 items-center justify-center rounded-full border border-amber-300/30 bg-amber-200/10 text-amber-200"><UserRound size={24}/></span><div><p className="text-xs uppercase tracking-widest text-amber-200">Success Wishes</p><h1 className="text-3xl font-semibold">My account</h1></div></div>
  {checking?<p role="status" className="text-slate-300">Checking account access…</p>:<>
   {error&&<p role="alert" className="mb-4 rounded-xl border border-red-500/40 p-3 text-red-200">{error}</p>}
   <section aria-label="Receiver account details" className="account-summary rounded-2xl border border-slate-700 bg-slate-900/70 p-5 sm:p-6">
    {person?<><div className="mb-4 flex items-center gap-2 text-sm text-emerald-300"><LockKeyhole size={16}/>PIN-protected inbox</div>
     <dl className="grid gap-4 text-sm sm:grid-cols-2">
      <div><dt className="text-slate-400">Receiver</dt><dd className="mt-1 font-semibold text-lg">{person.name}</dd></div>
      <div><dt className="text-slate-400">Phone (delivery address)</dt><dd className="mt-1">{person.phone||'Not provided'}</dd></div>
      <div><dt className="text-slate-400">School</dt><dd className="mt-1">{person.school||'Not provided'}</dd></div>
      <div><dt className="text-slate-400">Exam year</dt><dd className="mt-1">{person.examYear||'Not provided'}</dd></div>
     </dl><p className="mt-4 text-xs text-slate-400">The phone number is a delivery address, not proof that this person owns the phone. Only this unlocked inbox is shown.</p>
    </>:<><div className="mb-2 flex items-center gap-2 text-sm text-amber-200"><UserRound size={16}/>No PIN inbox signed in</div>
     <h2 className="text-xl font-semibold">{collection?.recipient?.name ? 'Wishes for '+collection.recipient.name : rememberedCount ? `${rememberedCount} ${rememberedCount===1?'wish':'wishes'} saved on this device` : 'Your receiver account'}</h2>
     <p className="mt-2 text-sm leading-6 text-slate-300">You can read cards saved on this device without creating an account. To keep wishes in a PIN-protected inbox, sign in or create one.</p>
     <Link className="mt-4 inline-flex items-center gap-2 rounded-lg border border-amber-200/40 px-4 py-3 font-semibold text-amber-200" href="/success-wishes/open">Open or create an inbox <ArrowRight size={16}/></Link>
    </>}
   </section>
   <h2 className="account-section-heading mb-3 mt-8 text-xl font-semibold">Account & access</h2>
   <button type="button" disabled={switching} onClick={()=>void switchReceiver()} className="account-switch mb-3 flex min-h-16 w-full items-center gap-4 rounded-xl border border-slate-700 bg-slate-900/60 px-4 text-left hover:bg-slate-800 disabled:opacity-60"><Users size={20} className="text-amber-200"/><span className="flex-1"><strong className="block text-sm">Switch receiver</strong><span className="block text-xs text-slate-400">Lock this session, then unlock another learner</span></span><ArrowRight size={17}/></button>
   <nav aria-label="Account management" className="account-links overflow-hidden rounded-2xl border border-slate-700 bg-slate-900/60">
    {actions.map(({href,label,description,icon:Icon})=><Link key={href} href={href} className="account-link flex min-h-20 items-center gap-4 border-b border-slate-700/70 px-4 py-3 transition-colors hover:bg-slate-800 focus-visible:bg-slate-800 last:border-0"><Icon className="shrink-0 text-amber-200" size={20}/><span className="flex-1"><strong className="block text-sm">{label}</strong><span className="mt-1 block text-xs leading-5 text-slate-400">{description}</span></span><ArrowRight size={17} className="shrink-0 text-slate-400"/></Link>)}
   </nav>
   <p className="account-footnote mt-5 text-xs leading-5 text-slate-400">Shared phone? Each learner opens their own protected collection. This page does not discover accounts from a phone number or merge recipients.</p>
  </>}
 </main>
}
