'use client'
import {useEffect,useMemo,useState} from 'react'
import {hqSupabase} from '@/lib/hq/supabase'
import {Check,ChevronRight,Copy,RefreshCw,ShieldCheck} from 'lucide-react'
import styles from './page.module.css'

type Candidate={id:string;name:string;school:string;examYear:string;maskedPhone:string}
type Review={id:string;exam_year:string;status:string;created_at:string;candidates:Candidate[]}

export default function RecoveryApprovals(){
 const [loading,setLoading]=useState(true)
 const [requests,setRequests]=useState<Review[]>([])
 const [error,setError]=useState('')
 const [selected,setSelected]=useState('')
 const [receiverId,setReceiverId]=useState('')
 const [evidence,setEvidence]=useState('')
 const [verified,setVerified]=useState(false)
 const [link,setLink]=useState('')
 const [copied,setCopied]=useState(false)
 const [busy,setBusy]=useState(false)
 const chosen=useMemo(()=>requests.find(r=>r.id===selected),[requests,selected])
 const candidate=chosen?.candidates.find(c=>c.id===receiverId)
 async function call(method:string,body?:unknown){
  const {data:{session}}=await hqSupabase.auth.getSession()
  if(!session)throw Error('Sign in to HQ again.')
  const response=await fetch('/api/hq/support/pin-recovery',{
   method,headers:{Authorization:'Bearer '+session.access_token,...(body?{'Content-Type':'application/json'}:{})},
   body:body?JSON.stringify(body):undefined,cache:'no-store'
  })
  const data=await response.json()
  if(!response.ok)throw Error(data.error||'Request failed')
  return data
 }
 async function refresh(){
  setLoading(true);setError('')
  try{
   const data=await call('GET')
   const list:Review[]=Array.isArray(data.requests)?data.requests:[]
   setRequests(list)
   if(selected&&!list.some(r=>r.id===selected))setSelected('')
  }catch(e){setError(e instanceof Error?e.message:'Could not load requests')}
  finally{setLoading(false)}
 }
 useEffect(()=>{void refresh()},[])
 function selectRequest(r:Review){
  setSelected(r.id);setReceiverId(r.candidates.length===1?r.candidates[0].id:'')
  setEvidence('');setVerified(false);setLink('');setCopied(false);setError('')
 }
 async function decide(action:'approve'|'reject'){
  if(!chosen||busy)return
  if(action==='approve'&&(!candidate||!verified||evidence.trim().length<20))return
  if(action==='reject'&&!window.confirm('Reject this recovery request? No PIN access will change.'))return
  setBusy(true);setError('');setLink('')
  try{
   const data=await call('POST',{
    action,requestId:chosen.id,receiverId:action==='approve'?candidate?.id:undefined,
    evidence:action==='approve'?evidence.trim():undefined,
    confirmedVerified:action==='approve'&&verified
   })
   if(data.recoveryUrl)setLink(data.recoveryUrl)
   await refresh()
  }catch(e){setError(e instanceof Error?e.message:'Could not finish')}
  finally{setBusy(false)}
 }
 async function copy(){
  if(!link)return
  try{await navigator.clipboard.writeText(link);setCopied(true)}
  catch{setError('Copy unavailable. Select and copy the private link manually.')}
 }
 return <main className={styles.page}>
  <header className={styles.header}>
   <p className={styles.eyebrow}>SUCCESS WISHES · HQ</p>
   <h1>PIN recovery</h1>
   <p>Match the correct inbox, verify the person, then issue their private reset link.</p>
  </header>
  {error&&<p className={styles.error} role="alert">{error}</p>}
  {link&&<section className={styles.result} aria-label="Approved private recovery link">
   <div className={styles.resultHead}><Check size={19}/><strong>Reset link generated</strong></div>
   <p>Send this privately to the independently verified recipient. It allows resetting the PIN of their existing inbox.</p>
   <textarea aria-label="Private PIN reset link" value={link} readOnly rows={3}/>
   <button type="button" onClick={()=>void copy()} className={styles.copy}><Copy size={17}/>{copied?'Copied':'Copy private link'}</button>
  </section>}
  <div className={styles.listHeader}>
   <h2>Recovery requests</h2>
   <button type="button" onClick={()=>void refresh()} disabled={loading||busy} className={styles.refresh}><RefreshCw size={16}/>{loading?'Loading…':'Refresh'}</button>
  </div>
  {!loading&&!error&&!requests.length&&<p role="status" className={styles.empty}>No pending recovery requests.</p>}
  <div className={styles.requestList}>
   {requests.map(r=><button key={r.id} type="button" onClick={()=>selectRequest(r)}
    aria-pressed={selected===r.id} className={styles.request}>
    <span><strong>{r.candidates.length===1?r.candidates[0].name:'Recovery request'}</strong>
     <small>{new Date(r.created_at).toLocaleDateString('en-KE',{day:'numeric',month:'short',year:'numeric'})} · {r.exam_year} · {r.status}</small>
     <small>{r.candidates.length===0?'No matching PIN inbox found':r.candidates.length===1?'1 possible inbox — unverified':r.candidates.length+' possible inboxes — verify which one'}</small>
    </span><ChevronRight size={18} aria-hidden="true"/>
   </button>)}
  </div>
  {chosen&&<section className={styles.review} aria-label="Review selected recovery request">
   <div className={styles.reviewHeader}><h2>Verify recipient</h2><span>Request {chosen.id.slice(0,8)}</span></div>
   {chosen.candidates.length===0?<p role="status" className={styles.warning}>No PIN-protected inbox matches this request's name, delivery number and exam year. Do not approve it. Ask support to investigate the original account details.</p>:
    <>
     <p className={styles.helper}>Matching details are suggestions, <strong>not proof of identity</strong>. Independently confirm the recipient or guardian before approving.</p>
     <fieldset className={styles.options}>
      <legend>{chosen.candidates.length>1?'Choose the verified inbox':'Possible matching inbox'}</legend>
      {chosen.candidates.map(c=><label key={c.id} className={styles.option}>
       <input type="radio" name="matching-inbox" checked={receiverId===c.id} onChange={()=>{setReceiverId(c.id);setVerified(false)}}/>
       <span><strong>{c.name}</strong><small>{c.school} · Exam {c.examYear}</small><small>Delivery number ending {c.maskedPhone.slice(-4)}</small></span>
      </label>)}
     </fieldset>
     {candidate&&<div className={styles.verify}>
      <label htmlFor="recovery-evidence" className={styles.fieldLabel}>How was identity independently verified?</label>
      <textarea id="recovery-evidence" rows={3} value={evidence} onChange={e=>setEvidence(e.target.value)}
       placeholder="Record the verification method and reference (at least 20 characters). Avoid saving PINs or reset links."/>
      <label className={styles.confirm}><input type="checkbox" checked={verified} onChange={e=>setVerified(e.target.checked)}/><span>I verified the correct recipient or guardian and confirmed this is their existing inbox.</span></label>
     </div>}
    </>
   }
   <div className={styles.actions}>
    <button type="button" className={styles.approve} onClick={()=>void decide('approve')} disabled={busy||!candidate||!verified||evidence.trim().length<20}>
     <ShieldCheck size={18}/>{busy?'Processing…':'Approve & generate reset link'}
    </button>
    <button type="button" className={styles.reject} disabled={busy} onClick={()=>void decide('reject')}>Reject request</button>
   </div>
  </section>}
 </main>
}
