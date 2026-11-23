'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { hqSupabase } from '@/lib/hq/supabase'
import { HQPage } from '@/components/hq/HQShell'

type MiniReview = {
  id: string
  title: string
  subject: string
  tags: string[]
  quiz_question: string | null
  quiz_options: string[]
  quiz_correct: number | null
  quiz_explanation: string | null
  creator_label: string
  creator_id: string
  body: string
  cover_path: string | null
  cover_preview_url: string | null
  created_at: string
  status: string
}
type CommentReview = {
  id: string
  mini_id: string
  author_id: string
  body: string
  created_at: string
  status: string
}
type Report = {
  mini_id: string
  reason: string
  description: string | null
  created_at: string
}
type Queue = { minis: MiniReview[]; comments: CommentReview[]; reports: Report[] }
type Selection = { target: 'mini' | 'comment'; id: string }
const colors = { border:'#d6dde8', text:'#172a40', subtle:'#6b7786', bg:'#f9fbfd', primary:'#244a77' }
const button = {
  minHeight:44, background:'#fff', border:'1px solid #d6dde8', borderRadius:8,
  padding:'10px 14px', fontSize:13, fontWeight:700, color:'#172a40', cursor:'pointer',
} as const

export default function MiniModerationPage() {
  const [queue,setQueue] = useState<Queue>({ minis:[],comments:[],reports:[] })
  const [selection,setSelection] = useState<Selection | null>(null)
  const [loading,setLoading] = useState(true)
  const [busy,setBusy] = useState(false)
  const [error,setError] = useState('')
  const [notice,setNotice] = useState('')
  const [reason,setReason] = useState('')
  const [quality,setQuality] = useState(65)

  const sessionToken = async () => {
    const { data:{ session }, error:authError } = await hqSupabase.auth.getSession()
    if (authError || !session?.access_token) throw Error('HQ authentication required.')
    return session.access_token
  }

  const load = useCallback(async () => {
    setLoading(true);setError('')
    try {
      const token = await sessionToken()
      const result = await fetch('/api/hq/minis/review', {
        headers: { Authorization:'Bearer '+token },cache:'no-store',
      })
      const json: unknown = await result.json()
      if (!result.ok) throw Error(
        typeof json==='object' && json!==null && 'error' in json && typeof json.error==='string'
          ? json.error : 'Mini moderation service unavailable.')
      const rows = json as Queue
      if (!Array.isArray(rows.minis) || !Array.isArray(rows.comments) || !Array.isArray(rows.reports))
        throw Error('Unexpected moderation response.')
      setQueue(rows)
    } catch (cause) {setError(cause instanceof Error?cause.message:'Unable to load moderation queue.')}
    finally {setLoading(false)}
  },[])

  useEffect(() => {void load()},[load])

  const active = useMemo(() => selection?.target==='mini'
    ? queue.minis.find(item=>item.id===selection.id)
    : queue.comments.find(item=>item.id===selection?.id),
    [selection,queue])

  async function decide(decision: 'approved'|'rejected'|'hidden') {
    if (!selection || !active || busy) return
    if (decision!=='approved' && reason.trim().length<8) {
      setError('Provide a specific reason of at least eight characters.')
      return
    }
    setBusy(true);setError('');setNotice('')
    try {
      const token = await sessionToken()
      const result = await fetch('/api/hq/minis/review', {
        method:'PATCH',
        headers: { Authorization:'Bearer '+token,'Content-Type':'application/json' },
        body:JSON.stringify({ id:selection.id,target:selection.target,
          decision,reason:reason.trim()||null,quality }),
        cache:'no-store',
      })
      const json: unknown = await result.json()
      if (!result.ok) throw Error(
        typeof json==='object' && json!==null && 'error' in json && typeof json.error==='string'
          ? json.error : 'Review could not be recorded.')
      setNotice('Review recorded and audited.')
      setSelection(null);setReason('')
      await load()
    } catch (cause) {setError(cause instanceof Error?cause.message:'Unable to record the decision.')}
    finally {setBusy(false)}
  }

  return <HQPage title="Mini Lessons review" description="Review educational accuracy, ownership, rights and safety before public release.">
    <div style={{display:'grid',gap:16,padding:'14px 0 40px',color:colors.text,maxWidth:1050,background:'#fff',borderRadius:12,padding:20}}>
      <div style={{display:'flex',gap:9,flexWrap:'wrap',alignItems:'center',justifyContent:'space-between'}}>
        <span style={{fontSize:13,color:colors.subtle}}>{queue.minis.length} pending Minis · {queue.comments.length} comments · {queue.reports.length} reports</span>
        <button type="button" style={button} onClick={()=>void load()} disabled={loading||busy}>Refresh queue</button>
      </div>
      {error && <p role="alert" style={{color:'#991b1b',fontSize:13}}>{error}</p>}
      {notice && <p role="status" style={{color:'#166534',fontSize:13}}>{notice}</p>}
      {loading ? <p role="status">Loading review queue…</p> : <>
        <section aria-label="Reported Mini Lessons">
          <h2 style={{fontSize:19}}>Reports requiring attention</h2>
          {queue.reports.length ? queue.reports.map((report,i)=>
            <p key={report.mini_id+':'+i} style={{border:'1px solid '+colors.border,borderRadius:8,padding:10}}>
              <strong>{report.reason}</strong> · Mini ID {report.mini_id}
              {report.description ? ' · '+report.description : ''}
            </p>) : <p style={{color:colors.subtle,fontSize:13}}>No reports.</p>}
        </section>
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(280px,1fr))',gap:18}}>
          <section aria-label="Submitted Mini Lessons">
            <h2 style={{fontSize:19}}>Pending Mini Lessons</h2>
            {queue.minis.length?queue.minis.map(item=>
              <button type="button" key={item.id} onClick={()=>{setSelection({target:'mini',id:item.id});setReason('')}}
                style={{...button,width:'100%',marginBottom:9,textAlign:'left',
                  borderColor:selection?.id===item.id?colors.primary:colors.border}}>
                <strong style={{display:'block'}}>{item.title}</strong>
                <small>{item.tags.map(tag=>'#'+tag).join(' ')} · @{item.creator_label}</small>
              </button>) : <p style={{color:colors.subtle}}>No pending Minis.</p>}
          </section>
          <section aria-label="Submitted comments">
            <h2 style={{fontSize:19}}>Pending comments</h2>
            {queue.comments.length?queue.comments.map(item=>
              <button type="button" key={item.id} onClick={()=>{setSelection({target:'comment',id:item.id});setReason('')}}
                style={{...button,width:'100%',marginBottom:9,textAlign:'left',
                  borderColor:selection?.id===item.id?colors.primary:colors.border}}>
                <strong style={{display:'block'}}>{item.body.slice(0,140)}</strong>
                <small>Mini {item.mini_id}</small>
              </button>) : <p style={{color:colors.subtle}}>No pending comments.</p>}
          </section>
        </div>
        {active && <section aria-labelledby="mini-review-heading"
          style={{background:colors.bg,border:'1px solid '+colors.border,borderRadius:14,padding:20}}>
          <h2 id="mini-review-heading" style={{fontSize:21}}>Review {selection?.target}</h2>
          {'title' in active && <><h3>{active.title}</h3>
            <p style={{fontSize:12,color:colors.subtle}}>@{active.creator_label} · {active.tags.map(tag=>'#'+tag).join(' ')}</p>
            {active.cover_preview_url
              ? <img src={active.cover_preview_url} alt={'Submitted photo for '+active.title}
                style={{maxWidth:'100%',maxHeight:350,objectFit:'contain',borderRadius:8}}/>
              : <p style={{color:'#92400e'}}>Cover unavailable. Do not approve without reviewing it.</p>}
          </>}
          <p style={{whiteSpace:'pre-wrap',lineHeight:1.75,fontSize:14}}>{active.body}</p>
          {'quiz_question' in active && active.quiz_question && <div style={{border:'1px solid '+colors.border,padding:12,borderRadius:8}}><strong>Quick question: {active.quiz_question}</strong>
            <ol>{active.quiz_options.map((answer,index)=><li key={index}>{answer} {index===active.quiz_correct?'(correct)':''}</li>)}</ol>
            <p>Explanation: {active.quiz_explanation}</p></div>}
          {selection?.target==='mini' && <label style={{display:'block',fontSize:13,marginTop:16}}>
            Educational quality (0–100)
            <input type="number" min={0} max={100} value={quality} onChange={e=>setQuality(Number(e.target.value))}
              style={{display:'block',padding:10,marginTop:6,maxWidth:120,border:'1px solid '+colors.border}} />
          </label>}
          <label style={{display:'block',fontSize:13,marginTop:15}}>
            Review notes (required for rejection or hiding)
            <textarea value={reason} onChange={e=>setReason(e.target.value)} maxLength={500} rows={3}
              placeholder="Explain what should be corrected"
              style={{display:'block',width:'100%',maxWidth:620,border:'1px solid '+colors.border,
                padding:11,borderRadius:8,marginTop:7,color:colors.text}}/>
          </label>
          <div style={{display:'flex',gap:10,flexWrap:'wrap',marginTop:17}}>
            <button type="button" style={{...button,background:colors.primary,color:'#fff'}} disabled={busy}
              onClick={()=>void decide('approved')}>Approve</button>
            <button type="button" style={button} disabled={busy} onClick={()=>void decide('rejected')}>Reject</button>
            <button type="button" style={button} disabled={busy} onClick={()=>{setSelection(null);setReason('')}}>Cancel</button>
          </div>
          <p style={{fontSize:12,color:colors.subtle}}>Reviewing your own submission is not permitted. Decisions are audited.</p>
        </section>}
      </>}
    </div>
  </HQPage>
}
