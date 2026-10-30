'use client'
import {useEffect,useState} from 'react'
import {hqSupabase} from '@/lib/hq/supabase'
type Review={id:string;exam_year:string;status:string;created_at:string}
export default function RecoveryApprovals(){
 const [loading,setLoading]=useState(true),[requests,setRequests]=useState<Review[]>([]),[error,setError]=useState(''),[selected,setSelected]=useState(''),[receiverId,setReceiverId]=useState(''),[evidence,setEvidence]=useState(''),[link,setLink]=useState(''),[busy,setBusy]=useState(false)
 async function call(method:string,body?:unknown){
  const {data:{session}}=await hqSupabase.auth.getSession()
  if(!session)throw Error('Sign in to HQ again.')
  const response=await fetch('/api/hq/support/pin-recovery',{method,headers:{Authorization:'Bearer '+session.access_token,...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined,cache:'no-store'})
  const data=await response.json();if(!response.ok)throw Error(data.error||'Request failed');return data
 }
 async function refresh(){setLoading(true);setError('');try{const data=await call('GET');setRequests(data.requests||[])}catch(e){setError(e instanceof Error?e.message:'Could not load requests')}finally{setLoading(false)}}
 useEffect(()=>{void refresh()},[])
 async function decide(action:'approve'|'reject'){setBusy(true);setError('');setLink('');try{
  const data=await call('POST',{action,requestId:selected,receiverId,evidence,confirmedVerified:action==='approve'})
  if(data.recoveryUrl)setLink(data.recoveryUrl)
  await refresh()
 }catch(e){setError(e instanceof Error?e.message:'Could not finish')}finally{setBusy(false)}}
 return <main style={{maxWidth:680,margin:'20px auto',padding:'20px 16px',color:'#f8fafc',fontFamily:'Inter,system-ui,sans-serif',fontSize:14,lineHeight:1.5}}> 
  <h1 style={{fontFamily:'inherit',fontSize:22,fontWeight:700,margin:'0 0 12px'}}> PIN recovery approvals</h1>
  <p style={{fontSize:13,color:'#aebed0',margin:'0 0 16px'}}>Review requests and independently verify identity before approving.</p>
  {error&&<p role="alert">{error}</p>}
  <button disabled={loading} onClick={()=>void refresh()} style={{background:'#1c344c',color:'#f8fafc',border:'1px solid #45617b',borderRadius:9,padding:'10px 14px',fontFamily:'inherit',fontSize:13}}>{loading?'Loading…':'Refresh requests'}</button>{!loading&&!error&&requests.filter(r=>r.status==='pending'||r.status==='reviewing').length===0&&<p role="status" style={{marginTop:20,color:'#aebed0'}}>No pending recovery requests.</p>}
  <div style={{display:'grid',gap:10,marginTop:18}}>{requests.filter(r=>r.status==='pending'||r.status==='reviewing').map(r=><button key={r.id} onClick={()=>{setSelected(r.id);setLink('')}} style={{textAlign:'left',padding:14,border:'1px solid #64748b',borderRadius:10,background:selected===r.id?'#17324c':'#101e2e',color:'inherit'}}>Request {r.id.slice(0,8)} · {r.exam_year} · {r.status} · {new Date(r.created_at).toLocaleDateString()}</button>)}</div>
  {selected&&<section style={{display:'grid',gap:12,marginTop:24}}>
   <h2>Review selected request</h2>
   <label>Verified recipient inbox ID<input value={receiverId} onChange={e=>setReceiverId(e.target.value)} placeholder="Recipient UUID"/></label>
   <label>Independent verification evidence / reference<textarea value={evidence} onChange={e=>setEvidence(e.target.value)} rows={3} placeholder="Record how you verified the guardian or recipient"/></label>
   <p>Only approve when identity and the correct recipient inbox have been verified. The reset link is sensitive; send it privately to the verified person.</p>
   <button disabled={busy||evidence.trim().length<20||!receiverId} onClick={()=>void decide('approve')}>Approve and generate reset link</button>
   <button disabled={busy} onClick={()=>void decide('reject')}>Reject request</button>
  </section>}
  {link&&<section style={{marginTop:20}}><p role="status">Approved. Copy this private link and send it only to the verified recipient. It resets the PIN on the existing inbox.</p><textarea aria-label="Private PIN reset link" value={link} readOnly rows={4}/><button onClick={()=>void navigator.clipboard.writeText(link)}>Copy private link</button></section>}
 </main>
}
