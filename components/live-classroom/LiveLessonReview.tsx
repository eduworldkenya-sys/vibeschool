'use client'

import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { liveToLessonHref } from '@/lib/teaching/liveLessonLinks'
import { liveHomeworkLink } from '@/lib/live/homeworkHandoff'

type BridgeReview = {
  lessonPlanId: string | null
  occurrenceId: string | null
  status: 'active' | 'paused' | 'ended'
  captureAllowed: boolean
  joined: number
  questions: number
  responses: number
  saved: number
  added: number
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Review-only bridge: never interprets Live joins as official attendance or
 * learner responses as scored mastery. Formal completion stays in Lesson Notes. */
export default function LiveLessonReview({
  roomId, roomStatus, preparedPlanId, selectedPlanId, classId, savedPlans, onSelectPlan,
}: {
  roomId: string
  roomStatus: 'active' | 'paused' | 'ended'
  preparedPlanId: string | null
  selectedPlanId: string | null
  classId: string
  savedPlans: Array<{id:string;title:string}>
  onSelectPlan: (id:string)=>void
}) {
  const [review, setReview] = useState<BridgeReview | null>(null)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [retry, setRetry] = useState(0)

  const request = useCallback(async (action: 'bind' | 'review' | 'capture') => {
    const params = new URLSearchParams(window.location.search)
    const suppliedOccurrence = params.get('occurrenceId')
    const occurrenceId = suppliedOccurrence && UUID.test(suppliedOccurrence)
      ? suppliedOccurrence : null
    const { data, error: failure } = await supabase.rpc('vibe_live_lesson_bridge', {
      p_action: action,
      p_session_id: roomId,
      p_lesson_plan_id: action === 'bind' ? preparedPlanId : null,
      p_occurrence_id: action === 'bind' ? occurrenceId : null,
    })
    if (failure) throw new Error(failure.message || 'Could not load Live lesson record.')
    if (!data || typeof data !== 'object' || Array.isArray(data))
      throw new Error('Invalid Live lesson record.')
    const row = data as Partial<BridgeReview>
    if (row.lessonPlanId !== null && (typeof row.lessonPlanId !== 'string' || !UUID.test(row.lessonPlanId)))
      throw new Error('Invalid linked Lesson Plan.')
    if (row.occurrenceId !== null && (typeof row.occurrenceId !== 'string' || !UUID.test(row.occurrenceId)))
      throw new Error('Invalid teaching occurrence.')
    if (typeof row.captureAllowed !== 'boolean') throw new Error('Invalid evidence permission.')
    for (const field of ['joined', 'questions', 'responses', 'saved', 'added'] as const) {
      const count = row[field]
      if (typeof count !== 'number' || !Number.isSafeInteger(count) || count < 0)
        throw new Error('Invalid Live lesson totals.')
    }
    if (!['active', 'paused', 'ended'].includes(row.status ?? ''))
      throw new Error('Invalid Live lesson status.')
    return row as BridgeReview
  }, [roomId, preparedPlanId])

  useEffect(() => {
    let cancelled = false
    setReview(null)
    setError('')
    const action = preparedPlanId ? 'bind' : 'review'
    void request(action).then(result => {
      if (!cancelled) {
        setReview(result)
        if (result.lessonPlanId && !selectedPlanId) onSelectPlan(result.lessonPlanId)
      }
    }).catch(cause => {
      if (!cancelled) setError(cause instanceof Error ? cause.message : 'Could not link Live Lesson.')
    })
    return () => { cancelled = true }
  }, [request, roomStatus, retry, selectedPlanId, onSelectPlan])

  async function saveEvidence() {
    if (roomStatus !== 'ended' || !review?.lessonPlanId || saving) return
    setSaving(true)
    setError('')
    try {
      const result = await request('capture')
      setReview(result)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not save learner responses.')
    } finally {
      setSaving(false)
    }
  }

  // Do not overlay the teaching canvas or shrink its viewport while Live.
  // The explicit end-of-lesson review provides the retry and failure feedback.
  if (roomStatus !== 'ended') return null

  const lessonHref = review?.lessonPlanId
    ? liveToLessonHref({lessonPlanId:review.lessonPlanId,classId,occurrenceId:review.occurrenceId})
    : null

  const homeworkHref=review?liveHomeworkLink(classId,roomId,review.lessonPlanId,review.occurrenceId):null
  return <section aria-label="Live lesson review" style={{
    background:'#fff',color:'#1f2937',padding:'12px 16px',borderBottom:'1px solid #e5e7eb',
    display:'flex',alignItems:'center',justifyContent:'space-between',gap:12,flexWrap:'wrap',
  }}>
    <div style={{display:'grid',gap:3}}>
      <strong style={{fontSize:14}}>Lesson review</strong>
      {review && <span style={{fontSize:12}}>
        {review.joined} joined · {review.questions} questions · {review.responses} responses · {review.saved} saved as evidence
      </span>}
      <small>Live joins are not official attendance. Responses have no automatic score or mastery.</small>
      {error && <span role="alert" style={{color:'#b91c1c',fontSize:12}}>{error}</span>}
    </div>
    {!review?.lessonPlanId&&<label style={{fontSize:13,display:'flex',alignItems:'center',gap:8}}>
      Link saved plan
      <select aria-label="Link saved Lesson Plan to ended Live session"
        value={preparedPlanId??''} onChange={e=>onSelectPlan(e.target.value)}>
        <option value="">Choose Lesson Plan</option>
        {savedPlans.map(p=><option key={p.id} value={p.id}>{p.title}</option>)}
      </select>
    </label>}
    <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
      {error && <button type="button" onClick={() => setRetry(n => n + 1)}>Retry</button>}
      {homeworkHref&&<a href={homeworkHref} style={{display:'inline-flex',alignItems:'center',padding:'8px 12px',border:'1px solid #142e23',borderRadius:4,fontSize:13,fontWeight:700,color:'#142e23'}}>Set homework from this lesson</a>}
      {review?.lessonPlanId && review.responses > 0 && review.captureAllowed && <button
        type="button" disabled={saving} onClick={() => void saveEvidence()}>
        {saving ? 'Saving…' : 'Save responses as evidence'}
      </button>}
      {review?.lessonPlanId && review.responses > 0 && !review.captureAllowed &&
        <small>Start or finish the linked teaching occurrence in Lesson Plan before saving evidence.</small>}
      {lessonHref && <a href={lessonHref} style={{
        display:'inline-flex',alignItems:'center',padding:'8px 12px',background:'#142e23',
        color:'#fff',borderRadius:4,fontSize:13,textDecoration:'none',fontWeight:700,
      }}>Review and finish Lesson Plan</a>}
      {!review?.lessonPlanId && !error && <small>No saved Lesson Plan is linked to this session.</small>}
    </div>
  </section>
}
