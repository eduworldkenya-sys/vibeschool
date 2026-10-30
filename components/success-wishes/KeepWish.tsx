'use client'
import {useState} from 'react'
import Link from 'next/link'
import {learnerName} from '@/lib/success-wishes/receiver-pin-browser'
import ReceiverAccount from './ReceiverAccount'
export default function KeepWish({token,candidate}:{token:string;candidate:string}){
 const [setup,setSetup]=useState(false),[saved,setSaved]=useState(false),[error,setError]=useState(''),[busy,setBusy]=useState(false)
 async function choose(){setBusy(true);setError('');try{const r=await fetch('/api/success-wishes/receiver/account',{cache:'no-store'});if(r.status===401){setSetup(true);return}if(!r.ok)throw Error('Your inbox is temporarily unavailable.');const p=await r.json();if(learnerName(p.recipient.name)!==learnerName(candidate))throw Error('Another learner’s inbox is open. Lock it in My wishes, then open this learner’s inbox.');const a=await fetch('/api/success-wishes/receiver/account',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'attach',token,inboxId:p.recipient.id})});const ap=await a.json();if(!a.ok)throw Error(ap.error);setSaved(true)}catch(e){setError(e instanceof Error?e.message:'Could not save your wish.')}finally{setBusy(false)}}
 if(saved)return <p style={{textAlign:'center'}}><Link href="/success-wishes/inbox">Saved in My wishes →</Link></p>
 return <section style={{textAlign:'center'}}>{error&&<p role="alert">{error}</p>}{setup?<ReceiverAccount initialMode="create" candidate={candidate} giftToken={token} onReady={()=>{setSaved(true);setSetup(false)}}/>:<button type="button" disabled={busy} onClick={()=>void choose()} style={{padding:'14px 22px',borderRadius:12,background:'#e2c572',color:'#17140d',fontWeight:600}}>{busy?'Saving…':'Save to My wishes'}</button>}<p style={{fontSize:12,color:'#aab1bd'}}>Optional. Enjoy your gift now; save it to a private inbox only if you want to.</p></section>
}
