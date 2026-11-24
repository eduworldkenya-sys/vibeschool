'use client'

import { useCallback, useEffect, useState } from 'react'
import { currentMiniUser, publishMiniSafely, MiniSubmissionSavedError } from '@/lib/minis/actions'
import { fetchMiniRequestAnswers, loadMiniCovers, type MiniPost } from '@/lib/minis/data'
import { changeRequestSupport, fetchMiniRequests, fetchMiniRequestSupports,
  fetchMyMiniRequests, submitMiniRequest, reportMiniRequest, type MiniPublicRequest, type MiniOwnRequest } from '@/lib/minis/requests'
import styles from './MiniExplore.module.css'

type Props = {
  mode?: 'feed' | 'compose'
  query?: string
  onBack?: () => void
  onExplain: (request: MiniPublicRequest) => void
}
export function MiniLiveRequests({ mode='feed', query='', onBack, onExplain }: Props) {
  const [requests,setRequests] = useState<MiniPublicRequest[]>([])
  const [supports,setSupports] = useState<Set<string>>(new Set())
  const [selected,setSelected] = useState<MiniPublicRequest|null>(null)
  const [answers,setAnswers] = useState<MiniPost[]>([])
  const [covers,setCovers] = useState<Record<string,string>>({})
  const [mine,setMine] = useState<MiniOwnRequest[]|null>(null)
  const [savedRequestId,setSavedRequestId] = useState<string|null>(null)
  const [question,setQuestion] = useState(query)
  const [tags,setTags] = useState('')
  const [viewer,setViewer] = useState<string|null>(null)
  const [busy,setBusy] = useState(false)
  const [reportReason,setReportReason] = useState<'unsafe'|'spam'|'harassment'|'personal_information'|'other'>('unsafe')
  const [error,setError] = useState('')
  const [notice,setNotice] = useState('')
  const [loading,setLoading] = useState(true)

  const refresh = useCallback(async () => {
    const id = await currentMiniUser()
    const [list,own] = await Promise.all([
      fetchMiniRequests(), id ? fetchMiniRequestSupports(id) : Promise.resolve(new Set<string>()),
    ])
    setRequests(list);setViewer(id);setSupports(own)
  }, [])
  useEffect(() => {
    let active=true
    void refresh().catch(() => {if(active) setError('Unable to load student requests.')})
      .finally(()=>{if(active)setLoading(false)})
    return ()=>{active=false}
  },[refresh])
  useEffect(()=>{if(query) setQuestion(query)},[query])

  async function support(request: MiniPublicRequest) {
    if(busy)return
    if(!viewer) {window.location.assign('/login?redirect=%2Fexplore');return}
    const adding=!supports.has(request.id)
    setBusy(true);setError('')
    try {
      await changeRequestSupport(request.id,adding)
      setSupports(prev=>{const next=new Set(prev);if(adding)next.add(request.id);else next.delete(request.id);return next})
      setRequests(prev=>prev.map(p=>p.id===request.id?{...p,supporters:p.supporters+(adding?1:-1)}:p))
    }catch(e){setError(e instanceof Error?e.message:'Unable to support request.')}
    finally{setBusy(false)}
  }
  async function open(request: MiniPublicRequest) {
    setSelected(request);setMine(null);setAnswers([]);setCovers({});setError('')
    try {
      const list=await fetchMiniRequestAnswers(request.id)
      setAnswers(list)
      setCovers(await loadMiniCovers(list))
    }catch{setError('Explanations are temporarily unavailable.')}
  }
  async function report(request:MiniPublicRequest){
    if(!viewer){window.location.assign('/login?redirect=%2Fexplore');return}
    if(busy)return
    setBusy(true);setError('')
    try{
      await reportMiniRequest(request.id,reportReason)
      setNotice('Report received. Unsafe requests can be hidden automatically after independent reports.')
      setSelected(null)
      await refresh()
    }catch(e){setError(e instanceof Error?e.message:'Unable to report request.')}
    finally{setBusy(false)}
  }
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if(busy)return
    if(!viewer){window.location.assign('/login?redirect=%2Fexplore');return}
    setBusy(true);setError('');setNotice('')
    try {
      if(savedRequestId)await publishMiniSafely('request',savedRequestId)
      else await submitMiniRequest(question,tags)
      setSavedRequestId(null);setQuestion('');setTags('')
      setNotice('Your request is public after passing an automatic safety check. No HQ approval needed.')
      try{await refresh()}catch{setNotice('Your request is public. Refresh Explore to see it.')}
    }catch(e){if(e instanceof MiniSubmissionSavedError)setSavedRequestId(e.submissionId);setError(e instanceof Error?e.message:'Unable to submit request.')}
    finally{setBusy(false)}
  }
  async function retryRequest(id:string){
    if(!viewer||busy)return
    setBusy(true);setError('');setNotice('')
    try{await publishMiniSafely('request',id);setNotice('Your request is public.')}
    catch(e){setError(e instanceof Error?e.message:'Unable to retry safety check.')}
    finally{try{setMine(await fetchMyMiniRequests())}catch{setError(old=>old||'Unable to refresh request status.')}setBusy(false)}
  }
  async function openMine() {
    if(!viewer){window.location.assign('/login?redirect=%2Fexplore');return}
    setError('');setBusy(true)
    try{setMine(await fetchMyMiniRequests());setSelected(null)}
    catch{setError('Unable to load your requests.')}
    finally{setBusy(false)}
  }

  if(mode==='compose') return <section className={styles.form}>
    <button type="button" className={styles.back} onClick={onBack}>← Explore</button>
    <span className={styles.eyebrow}>REQUEST A MINI LESSON</span>
    <h1>What would you like explained?</h1>
    <p className={styles.subline}>One clear question and relevant hashtags. No photo needed.</p>
    <form className={styles.requestForm} onSubmit={event=>void submit(event)}>
      <label htmlFor="mini-request-question" className={styles.label}>Question</label>
      <textarea id="mini-request-question" className={styles.editor} required minLength={12} maxLength={240}
        value={question} disabled={!!savedRequestId} onChange={event=>setQuestion(event.target.value)}
        placeholder="How can I solve simultaneous equations step by step?"/>
      <label htmlFor="mini-request-tags" className={styles.label}>Hashtags</label>
      <input id="mini-request-tags" className={styles.field} required maxLength={160} disabled={!!savedRequestId} value={tags}
        onChange={event=>setTags(event.target.value)} placeholder="#Mathematics #Grade9"/>
      <button type="submit" className={styles.primary} disabled={busy||question.trim().length<12||!tags.trim()}>
        {busy?'Checking safety…':savedRequestId?'Retry safety check':'Post request'}</button>
    </form>
    {savedRequestId&&<button type="button" className={styles.secondary} onClick={onBack}>Return to Explore · My requests</button>}
    {(error||notice)&&<p role={error?'alert':'status'} className={styles.formNote}>{error||notice}</p>}
    <p className={styles.previewNote}>Never include your name, phone number, contacts or school identity. Requests pass an automatic safety check before public discovery.</p>
  </section>

  if(mine) return <section className={styles.requestDetail}>
    <button type="button" className={styles.back} onClick={()=>setMine(null)}>← Requests</button>
    <h2>My requests</h2>
    {mine.length?mine.map(p=><div key={p.id} className={styles.comment}>
      <strong>{p.question}</strong>
      <span>{p.status==='approved'?'Public':p.status==='pending'?'Safety check pending':p.status} · {p.explanations} approved explanations</span>
      {p.status==='pending'&&<button type="button" disabled={busy} onClick={()=>void retryRequest(p.id)}>Retry safety check</button>}
    </div>):<p>No requests yet.</p>}
    {error&&<p role="alert">{error}</p>}
    {notice&&<p role="status">{notice}</p>}
  </section>

  if(selected) return <section className={styles.requestDetail}>
    <button type="button" className={styles.back} onClick={()=>setSelected(null)}>← Requests</button>
    <span className={styles.requestEyebrow}>Student request · {selected.explanations?'Answered':'Open to explain'}</span>
    <h2>{selected.question}</h2>
    <div className={styles.tagRow}>{selected.tags.map(t=><span key={t} className={styles.tagButton}>#{t}</span>)}</div>
    <div className={styles.requestActions}>
      <button type="button" disabled={busy} aria-pressed={supports.has(selected.id)} onClick={()=>void support(selected)}>
        {supports.has(selected.id)?'✓ Me too':'+ Me too'}</button>
      <button type="button" className={styles.primary} onClick={()=>onExplain(selected)}>Explain this</button>
    </div>
    <div className={styles.requestActions}>
      <label htmlFor="mini-request-report-reason">Report this request</label>
      <select id="mini-request-report-reason" className={styles.field}
        value={reportReason} onChange={event=>setReportReason(event.target.value as typeof reportReason)}>
        <option value="unsafe">Unsafe</option><option value="spam">Spam</option>
        <option value="harassment">Harassment</option>
        <option value="personal_information">Personal information</option>
        <option value="other">Other</option>
      </select>
      <button type="button" disabled={busy} onClick={()=>void report(selected)}>Report request</button>
    </div>
    <h3>{answers.length} {answers.length===1?'explanation':'explanations'}</h3>
    {answers.map(post=><article key={post.id} className={styles.localReply}>
      {covers[post.id]&&<img src={covers[post.id]} alt={'Photo for '+post.title}/>}
      <h3>{post.title}</h3><p>{post.body}</p>
      <a href={'/explore?mini='+encodeURIComponent(post.id)}>Open Mini Lesson</a>
    </article>)}
    {!answers.length&&<p className={styles.subline}>No published explanations yet. Eligible creators can help.</p>}
    {error&&<p role="alert">{error}</p>}
  </section>

  const q=query.trim().toLowerCase()
  const visible=requests.filter(r=>!q||[r.question,...r.tags].join(' ').toLowerCase().includes(q))
  return <section aria-label="Mini Lesson requests" className={styles.requestFeed}>
    <div className={styles.resultsLabel}><strong>Requests to explain</strong>
      <div className={styles.requestActions}>{viewer&&<button type="button" onClick={()=>void openMine()}>My requests</button>}</div>
    </div>
    {error&&<p role="alert" className={styles.formNote}>{error}</p>}
    {notice&&<p role="status" className={styles.formNote}>{notice}</p>}
    {loading?<p className={styles.subline}>Loading requests…</p>:!visible.length
      ? <p className={styles.subline}>No matching requests yet. Start one with + Create.</p>
      : <div className={styles.grid}>
        {visible.map(r=><article key={r.id} className={styles.requestCard}>
          <span className={styles.requestEyebrow}>Student request · {r.explanations?'Answered':'Open'}</span>
          <button type="button" className={styles.requestTitle} onClick={()=>void open(r)}>{r.question}</button>
          <div className={styles.tagRow}>{r.tags.map(t=><span key={t} className={styles.tagButton}>#{t}</span>)}</div>
          <div className={styles.requestMeta}>{r.supporters} interested · {r.explanations} explanations</div>
          <div className={styles.requestActions}>
            <button type="button" disabled={busy} aria-pressed={supports.has(r.id)} onClick={()=>void support(r)}>
              {supports.has(r.id)?'✓ Me too':'+ Me too'}</button>
            <button type="button" onClick={()=>void open(r)}>View explanations</button>
            <button type="button" onClick={()=>onExplain(r)}>Explain</button>
          </div>
        </article>)}
      </div>}
  </section>
}
