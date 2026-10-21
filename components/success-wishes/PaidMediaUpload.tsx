'use client'

import {createClient} from '@supabase/supabase-js'
import {FormEvent,useRef,useState} from 'react'
import styles from './SuccessWishes.module.css'

type Kind='voice'|'video'
type VerifyResponse={verified:boolean;senderProof:string}
type Reservation={messageId:string;kind:Kind;path:string;uploadUrl:string;uploadToken?:string;method:'PUT'|'POST'}
type Finalization={ready:boolean;status?:string;message?:string}

async function post<T>(path:string,body:unknown,method:'POST'|'PATCH'='POST'):Promise<T>{
 const response=await fetch(path,{
   method,credentials:'same-origin',cache:'no-store',
   headers:{'Content-Type':'application/json'},
   body:JSON.stringify(body),
 })
 const data:unknown=await response.json().catch(()=>null)
 if(!response.ok){
   const error=data&&typeof data==='object'&&'error' in data?(data as {error:unknown}).error:null
   throw Error(typeof error==='string'?error:'The operation could not be completed.')
 }
 return data as T
}
function nonce():string {
 return Array.from(crypto.getRandomValues(new Uint8Array(32)),v=>v.toString(16).padStart(2,'0')).join('')
}

// This panel only becomes visible after provider/device certification.
// Payment must independently have created a durable *paid* media message;
// entering a reference alone never creates an entitlement or charges money.
export default function PaidMediaUpload(){
 const [reference,setReference]=useState('')
 const [phone,setPhone]=useState('')
 const [challengeSent,setChallengeSent]=useState(false)
 const [code,setCode]=useState('')
 const [proof,setProof]=useState('')
 const [file,setFile]=useState<File|null>(null)
 const [busy,setBusy]=useState(false)
 const [error,setError]=useState('')
 const [message,setMessage]=useState('')
 const [uploaded,setUploaded]=useState(false)
 const [ready,setReady]=useState(false)
 const key=useRef('')
 const [kind,setKind]=useState<Kind>('voice')
 function choose(next:File|null){
   setError('');setFile(null);setUploaded(false);setReady(false);setMessage('')
   if(!next)return
   const mime=next.type
   const voiceMime=['audio/webm','audio/mp4','audio/mpeg','audio/ogg']
   const videoMime=['video/mp4','video/webm','video/quicktime']
   if(kind==='voice'?!voiceMime.includes(mime):!videoMime.includes(mime)){
     setError('Choose a supported '+kind+' file.');return
   }
   if(next.size<1||next.size>(kind==='voice'?25:50)*1024*1024){
     setError('The file exceeds the '+(kind==='voice'?25:50)+' MB limit.');return
   }
   setFile(next)
 }
 async function sendCode(){
   setBusy(true);setError('')
   try{
     await post('/api/success-wishes/verify-sender',{phone})
     setChallengeSent(true);setMessage('Check your phone for the six-digit SMS code.')
   }catch(e){setError(e instanceof Error?e.message:'Phone could not be verified.')}
   finally{setBusy(false)}
 }
 async function verify(){
   setBusy(true);setError('')
   try{
     const response=await post<VerifyResponse>('/api/success-wishes/verify-sender',{phone,code},'PATCH')
     if(!response.verified)throw Error('Phone verification failed.')
     setProof(response.senderProof);setCode('');setMessage('Phone verified.')
   }catch(e){setError(e instanceof Error?e.message:'Phone verification failed.')}
   finally{setBusy(false)}
 }
 async function complete(){
   if(!proof)return
   const result=kind==='voice'
     ?await post<Finalization>('/api/success-wishes/media/voice-verify',{messageId:reference,senderProof:proof})
     :await post<Finalization>('/api/success-wishes/media/finalize',{messageId:reference,senderProof:proof})
   setReady(result.ready)
   setMessage(result.ready?'Your private media is ready for the candidate to accept.'
     :result.message||'Your media is being processed. Check again shortly.')
 }
 async function submit(event:FormEvent<HTMLFormElement>){
   event.preventDefault()
   if(!proof||!file||busy)return
   setBusy(true);setError('');setMessage('')
   if(!key.current)key.current=nonce()
   try{
     if(!uploaded){
       const claim=await post<Reservation>('/api/success-wishes/media/reserve',{
         messageId:reference,requestKey:key.current,senderProof:proof,kind,
         contentType:file.type,bytes:file.size,
       })
       if(claim.kind!==kind||claim.messageId!==reference)throw Error('Upload ownership could not be confirmed.')
       if(kind==='voice'){
         if(!claim.uploadToken)throw Error('Private voice upload capability was not returned.')
         const supabase=createClient(
           process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
           {auth:{persistSession:false,autoRefreshToken:false}},
         )
         const result=await supabase.storage.from('success-wishes-private-voice')
           .uploadToSignedUrl(claim.path,claim.uploadToken,file,{contentType:file.type,upsert:false})
         if(result.error)throw Error('Voice upload failed. Do not start a second payment or reservation.')
       }else{
         const uri=new URL(claim.uploadUrl)
         if(uri.protocol!=='https:'||uri.hostname!=='upload.videodelivery.net'||uri.username||uri.password)
           throw Error('Unsafe video upload destination.')
         const body=new FormData();body.append('file',file)
         const response=await fetch(uri.href,{method:'POST',body,redirect:'error'})
         if(!response.ok)throw Error('Video upload failed. Contact support before retrying.')
       }
       setUploaded(true)
     }
     await complete()
   }catch(e){
     setError(e instanceof Error?e.message:'Private media upload could not complete.')
   }finally{setBusy(false)}
 }
 return <section className={styles.panel} aria-label="Complete an already paid voice or video wish">
   <h2>Complete your paid voice or video wish</h2>
   <p className={styles.hint}>Only use the private reference issued after verified payment. This form does not take payment or identify a candidate.</p>
   <form onSubmit={submit}>
     <label className={styles.field}>Paid message reference
       <input required type="text" value={reference} pattern="[0-9a-fA-F-]{36}" maxLength={36}
         onChange={e=>{setReference(e.target.value.trim());setUploaded(false);setReady(false);key.current=''}}
         autoComplete="off" />
     </label>
     <label className={styles.field}>Your verified sender phone
       <input type="tel" inputMode="tel" required value={phone}
         onChange={e=>{setPhone(e.target.value);setProof('');setChallengeSent(false);setUploaded(false);key.current=''}}
         maxLength={18} autoComplete="tel"/>
     </label>
     {!proof?<div className={styles.row}>
       <button type="button" className={styles.secondary} disabled={busy||!phone} onClick={()=>void sendCode()}>
         {challengeSent?'Resend code':'SMS verification code'}
       </button>
       {challengeSent&&<>
         <label className={styles.field}>Six-digit SMS code
           <input value={code} onChange={e=>setCode(e.target.value)} maxLength={6}
             inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}"/>
         </label>
         <button type="button" className={styles.secondary} disabled={busy||!/^[0-9]{6}$/.test(code)} onClick={()=>void verify()}>Verify</button>
       </>}
     </div>:<p role="status">Phone verified for this browser session.</p>}
     <div className={styles.kinds} role="group" aria-label="Media type">
       {(['voice','video'] as const).map(next=><button type="button" key={next}
         aria-pressed={kind===next} className={kind===next?styles.selectedKind:styles.secondary}
         onClick={()=>{setKind(next);setFile(null);setUploaded(false);key.current=''}}>
         {next==='voice'?'Voice':'Video'}
       </button>)}
     </div>
     <label className={styles.field}>Private {kind} file
       <input type="file" accept={kind==='voice'?'audio/webm,audio/mp4,audio/mpeg,audio/ogg':'video/mp4,video/webm,video/quicktime'}
         onChange={e=>choose(e.target.files?.[0]||null)} disabled={uploaded}/>
     </label>
     <p className={styles.hint}>Maximum 60 seconds. Actual duration and file format are independently verified after upload.</p>
     {error&&<p role="alert" className={styles.error}>{error}</p>}
     {message&&<p role="status" className={styles.status}>{message}</p>}
     <button type="submit" className={styles.primary} disabled={!file||!proof||busy||ready}>
       {busy?'Checking private media…':uploaded?'Check media processing':'Upload private media'}
     </button>
   </form>
 </section>
}
