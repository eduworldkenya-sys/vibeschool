'use client'

import {useEffect,useState} from 'react'
import Link from 'next/link'
import {UserRound,KeyRound,ShieldCheck,Users,Inbox,HelpCircle,ArrowRight,LockKeyhole} from 'lucide-react'

type Account={recipient:{id:string;name:string;school:string;phone:string;examYear:string}}
type Collection={cards?:unknown[];recipient?:{name:string}}
const actions=[
 {href:'/success-wishes/inbox',label:'My wishes',description:'View the cards you can access',icon:Inbox},
 {href:'/success-wishes/open',label:'Open another inbox',description:'Unlock a different learner with their PIN',icon:Users},
 {href:'/success-wishes/recover',label:'PIN & recovery',description:'Change your PIN or recover access',icon:KeyRound},
 {href:'/success-wishes/settings',label:'Privacy & safety',description:'Manage consent, reports and data requests',icon:ShieldCheck},
 {href:'/contact',label:'Get support',description:'Help with lost access or account questions',icon:HelpCircle},
]
export default function ReceiverAccountHub(){
 const [account,setAccount]=useState<Account|null>(null)
 const [collection,setCollection]=useState<Collection|null>(null)
 const [checking,setChecking]=useState(true)
 const [error,setError]=useState('')
 useEffect(()=>{
  const controller=new AbortController()
  async function load(){
   try{
    const r=await fetch('/api/success-wishes/receiver/account',{cache:'no-store',signal:controller.signal})
    if(r.ok){const data:Account=await r.json();if(!controller.signal.aborted)setAccount(data)}
    else if(r.status!==401)throw Error('Account details are temporarily unavailable.')
    const c=await fetch('/api/success-wishes/receiver/collection',{cache:'no-store',signal:controller.signal})
    if(c.ok){const data:Collection=await c.json();if(!controller.signal.aborted)setCollection(data)}
   }catch(e){if(!controller.signal.aborted)setError(e instanceof Error?e.message:'Could not check this account.')}
   finally{if(!controller.signal.aborted)setChecking(false)}
  }
  void load()
  return()=>controller.abort()
 },[])
 const person=account?.recipient
 return <main className="mx-auto w-full max-w-3xl px-4 py-8 pb-24 text-slate-100 sm:px-6 sm:py-12">
  <div className="mb-7 flex items-center gap-3"><span className="flex h-12 w-12 items-center justify-center rounded-full border border-amber-300/30 bg-amber-200/10 text-amber-200"><UserRound size={24}/></span><div><p className="text-xs uppercase tracking-widest text-amber-200">Success Wishes</p><h1 className="text-3xl font-semibold">My account</h1></div></div>
  {checking?<p role="status" className="text-slate-300">Checking account access…</p>:<>
   {error&&<p role="alert" className="mb-4 rounded-xl border border-red-500/40 p-3 text-red-200">{error}</p>}
   <section aria-label="Receiver account details" className="rounded-2xl border border-slate-700 bg-slate-900/70 p-5 sm:p-6">
    {person?<><div className="mb-4 flex items-center gap-2 text-sm text-emerald-300"><LockKeyhole size={16}/>PIN-protected inbox</div>
     <dl className="grid gap-4 text-sm sm:grid-cols-2">
      <div><dt className="text-slate-400">Receiver</dt><dd className="mt-1 font-semibold text-lg">{person.name}</dd></div>
      <div><dt className="text-slate-400">Phone (delivery address)</dt><dd className="mt-1">{person.phone||'Not provided'}</dd></div>
      <div><dt className="text-slate-400">School</dt><dd className="mt-1">{person.school||'Not provided'}</dd></div>
      <div><dt className="text-slate-400">Exam year</dt><dd className="mt-1">{person.examYear||'Not provided'}</dd></div>
     </dl><p className="mt-4 text-xs text-slate-400">The phone number is a delivery address, not proof that this person owns the phone. Only this unlocked inbox is shown.</p>
    </>:<><div className="mb-2 flex items-center gap-2 text-sm text-amber-200"><UserRound size={16}/>No protected account unlocked</div>
     <h2 className="text-xl font-semibold">{collection?.recipient?.name ? 'Wishes for '+collection.recipient.name : 'Your receiver account'}</h2>
     <p className="mt-2 text-sm leading-6 text-slate-300">A card saved on this browser does not automatically create a PIN-protected account. You can continue reading that card without registering. To manage a private collection, open your existing inbox or set one up when saving a wish.</p>
     <Link className="mt-4 inline-flex items-center gap-2 rounded-lg border border-amber-200/40 px-4 py-3 font-semibold text-amber-200" href="/success-wishes/open">Open or create an inbox <ArrowRight size={16}/></Link>
    </>}
   </section>
   <h2 className="mb-3 mt-8 text-xl font-semibold">Account & access</h2>
   <nav aria-label="Account management" className="overflow-hidden rounded-2xl border border-slate-700 bg-slate-900/60">
    {actions.map(({href,label,description,icon:Icon})=><Link key={href} href={href} className="flex min-h-20 items-center gap-4 border-b border-slate-700/70 px-4 py-3 transition-colors hover:bg-slate-800 focus-visible:bg-slate-800 last:border-0"><Icon className="shrink-0 text-amber-200" size={20}/><span className="flex-1"><strong className="block text-sm">{label}</strong><span className="mt-1 block text-xs leading-5 text-slate-400">{description}</span></span><ArrowRight size={17} className="shrink-0 text-slate-400"/></Link>)}
   </nav>
   <p className="mt-5 text-xs leading-5 text-slate-400">Shared phone? Each learner opens their own protected collection. This page does not discover accounts from a phone number or merge recipients.</p>
  </>}
 </main>
}
