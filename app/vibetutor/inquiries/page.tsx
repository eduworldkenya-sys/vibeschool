'use client'
import {useCallback,useEffect,useState} from 'react'
import Link from 'next/link'
import {getSupabaseClient,supabase} from '@/lib/supabase'
import styles from '@/components/vibetutor/VibeTutor.module.css'
type Request = {id:string;learner_label:string;public_preview:boolean;status:string}
type Interest = {id:string;request_id:string;tutor_id:string;message:string;guardian_reply:string|null;status:string;created_at:string}
type Tutor = {profile_id:string;display_name:string}
export default function VibeTutorInquiries() {
  const [signedIn,setSignedIn]=useState<boolean|null>(null)
  const [requests,setRequests]=useState<Request[]>([])
  const [interests,setInterests]=useState<Interest[]>([])
  const [names,setNames]=useState<Record<string,string>>({})
  const [replies,setReplies]=useState<Record<string,string>>({})
  const [loading,setLoading]=useState(true)
  const [error,setError]=useState('')
  const [saving,setSaving]=useState<string|null>(null)
  const refresh=useCallback(async()=>{
    setError('');setLoading(true)
    try{
      const client=getSupabaseClient()
      const {data:{user},error:authError}=await client.auth.getUser()
      if(authError && authError.name!=='AuthSessionMissingError') throw authError
      if(!user){setSignedIn(false);setRequests([]);setInterests([]);return}
      setSignedIn(true)
      const [req,interest]=await Promise.all([
        client.from('vibetutor_requests').select('id,learner_label,public_preview,status').eq('requester_id',user.id),
        supabase.from('vibetutor_request_interests').select('id,request_id,tutor_id,message,guardian_reply,status,created_at').order('created_at',{ascending:false})
      ])
      if(req.error||interest.error)throw new Error('Could not load enquiries.')
      setRequests((req.data??[]) as Request[]);setInterests((interest.data??[]) as Interest[])
      const ids: string[]=[...new Set<string>(((interest.data??[]) as Interest[]).map(row=>row.tutor_id))]
      if(ids.length){
        const {data:tutors}=await supabase.from('vibetutor_public_tutors').select('profile_id,display_name').in('profile_id',ids)
        setNames(Object.fromEntries(((tutors??[]) as Tutor[]).map(t=>[t.profile_id,t.display_name])))
      }
    }catch {setError('Unable to load your enquiries. Try again.')}
    finally {setLoading(false)}
  },[])
  useEffect(()=>{void refresh()},[refresh])
  async function respond(id:string,status:'accepted'|'declined'){
    setSaving(id);setError('')
    try{
      const {error}=await supabase.rpc('vibetutor_request_interest_reply',{p_interest:id,p_status:status,p_reply:status==='accepted'?(replies[id]??'').trim():''})
      if(error)throw error
      await refresh()
    }catch{setError('Unable to send your response. Check your message and try again.')}
    finally{setSaving(null)}
  }
  async function unpublish(id:string){
    setSaving(id);setError('')
    try{
      const {error}=await getSupabaseClient().from('vibetutor_requests').update({public_preview:false}).eq('id',id)
      if(error)throw error
      await refresh()
    }catch{setError('Could not make your request private. Try again.')}
    finally{setSaving(null)}
  }
  const mine=new Set(requests.map(r=>r.id))
  return <section className={styles.formWrap}><header className={styles.formHead}><h1 className={styles.formTitle}>Tuition enquiries</h1><p className={styles.muted}>Private conversations start here. Contact details are not public.</p></header>
    {signedIn===false ? <p><Link className={styles.modalSignIn} href={'/login?redirect='+encodeURIComponent('/vibetutor/inquiries')}>Sign in to see enquiries</Link></p> : null}
    {loading && <p role="status">Loading…</p>}
    {error && <p role="alert">{error} <button type="button" onClick={()=>void refresh()}>Retry</button></p>}
    {!loading && signedIn && <>
      {requests.filter(r=>r.public_preview && r.status==='open').map(r=><article className={styles.card} key={r.id}><h2 className={styles.cardTitle}>Public request · {r.learner_label || 'Learner'}</h2><p className={styles.muted}>Visible anonymously to visitors. Your name and phone are not shown.</p><button className={styles.btnSecondary} disabled={saving===r.id} type="button" onClick={()=>void unpublish(r.id)}>Stop public sharing</button></article>)}
      <h2 className={styles.cardTitle}>Responses</h2>
      {!interests.length && <p className={styles.muted}>No enquiries yet.</p>}
      {interests.map(i=><article className={styles.card} key={i.id}>
        <h3 className={styles.cardTitle}>{mine.has(i.request_id)?(names[i.tutor_id] || 'Tutor enquiry'):'Your tutor enquiry'}</h3>
        <p className={styles.muted}>Status: {i.status}</p><p className={styles.meta}>{i.message}</p>
        {i.guardian_reply && <p className={styles.meta}>Guardian replied: {i.guardian_reply}</p>}
        {mine.has(i.request_id) && i.status==='pending' && <>
          <label htmlFor={'reply-'+i.id}>Reply privately to this tutor</label>
          <textarea id={'reply-'+i.id} className={styles.input} rows={3} maxLength={500} value={replies[i.id]??''} onChange={e=>setReplies(p=>({...p,[i.id]:e.target.value}))} placeholder="Introduce yourself and agree on safe next steps." />
          <div className={styles.formActions}><button type="button" className={styles.btnSubmit} disabled={saving===i.id||(replies[i.id]??'').trim().length<10} onClick={()=>void respond(i.id,'accepted')}>Reply and accept</button><button type="button" className={styles.btnSecondary} disabled={saving===i.id} onClick={()=>void respond(i.id,'declined')}>Decline</button></div>
        </>}
      </article>)}
      <Link className={styles.btnSecondary} href="/vibetutor/browse?view=students">Browse learners</Link>
    </>}
  </section>
}
