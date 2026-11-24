'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { validLessonId } from '@/lib/teaching/liveLessonLinks'

type LiveSessionSummary = {
  id: string
  title: string
  status: 'active' | 'paused' | 'ended'
  startedAt: string
  occurrenceId: string | null
  joined: number
  responses: number
  saved: number
}

function parseRows(data: unknown): LiveSessionSummary[] {
  if (!Array.isArray(data)) throw new Error('Invalid Live history.')
  return data.map(item => {
    if (!item || typeof item !== 'object') throw new Error('Invalid Live history.')
    const row = item as Partial<LiveSessionSummary>
    if (!validLessonId(row.id) || !['active', 'paused', 'ended'].includes(row.status ?? '') ||
      typeof row.title !== 'string' || typeof row.startedAt !== 'string' ||
      (row.occurrenceId != null && !validLessonId(row.occurrenceId)) ||
      ![row.joined,row.responses,row.saved].every(value=>typeof value==='number'&&Number.isSafeInteger(value)&&value>=0)) {
      throw new Error('Invalid Live history.')
    }
    return row as LiveSessionSummary
  })
}

/** Reverse navigation is teacher-scoped by the SQL RPC; no student identifiers
 * or answers are returned to the browser. Attendance is never inferred. */
export default function LiveLessonHistory({planId,classId}: {planId:string;classId:string}) {
  const [sessions,setSessions] = useState<LiveSessionSummary[]>([])
  const [error,setError] = useState('')
  const [loading,setLoading] = useState(true)
  const [retry,setRetry] = useState(0)

  useEffect(()=>{
    if (!validLessonId(planId) || !validLessonId(classId)) return
    let cancelled=false
    setLoading(true)
    setError('')
    void supabase.rpc('vibe_live_plan_history',{p_lesson_plan_id:planId}).then(({data,error:failure}: {data:unknown;error:{message?:string}|null})=>{
      if (cancelled) return
      if (failure) throw new Error(failure.message||'Live history unavailable.')
      setSessions(parseRows(data))
    }).catch(()=>{
      if (!cancelled) {setSessions([]);setError('Linked Live lessons could not be loaded.')}
    }).finally(()=>{if(!cancelled)setLoading(false)})
    return()=>{cancelled=true}
  },[planId,classId,retry])

  if (loading || (!sessions.length && !error)) return null
  return <section aria-label="Linked Live lessons" style={{
    background:'#fff',border:'1px solid #e5e7eb',borderRadius:6,
    padding:'12px 14px',margin:'12px 0'
  }}>
    <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:8}}>
      <strong style={{fontSize:14}}>Live teaching history</strong>
      <button type="button" onClick={()=>setRetry(x=>x+1)}>Refresh</button>
    </div>
    {error && <p role="alert">{error}</p>}
    {sessions.map(session=>{
      const liveUrl = '/teacher/classhub/'+encodeURIComponent(classId)+'/live?'+new URLSearchParams({
        lessonPlanId:planId,resumeRoom:session.id,
      })
      return <div key={session.id} style={{display:'flex',gap:10,alignItems:'center',flexWrap:'wrap',padding:'9px 0',borderTop:'1px solid #f1f5f9'}}>
        <div style={{flex:1,minWidth:160}}>
          <strong style={{fontSize:13}}>{session.title}</strong>
          <div style={{fontSize:12,color:'#475569'}}>
            {session.status==='ended'?'Ended':session.status==='paused'?'Paused':'Live'} · {session.joined} joined · {session.responses} responses · {session.saved} evidence saved
          </div>
        </div>
        <a href={liveUrl} style={{fontWeight:650,fontSize:13}}>
          {session.status==='ended'?'Review Live':'Resume Live'}
        </a>
      </div>
    })}
    <small>Joining a Live Lesson does not automatically mark school attendance or learner mastery.</small>
  </section>
}
