"use client";

import { Suspense, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import LessonTeachMode, { type LessonCompletionReview } from '@/components/teacher/LessonTeachMode'
import { evaluateLessonReadiness } from '@/lib/teaching/lessonReadiness'
import { parseLessonPlanBody } from '@/lib/teaching/lessonPlanCodec'

type Draft = {
  id: string; teacher_id: string; school_id: string; class_id: string | null;
  subject_id: string; scheme_id: string | null; title: string | null;
  topic: string | null; body: string | null; status: string;
}
type LessonPlan = { id: string; title: string | null; body: string | null; topic: string | null }
type Occurrence = {
  id: string; unscheduled_plan_id: string; occurrence_date: string;
  school_id: string; teacher_id: string; class_id: string; subject_id: string;
  timetable_slot_id: null; lifecycle: string;
}
type Active = { occurrence: Occurrence; plan: LessonPlan }

function TeachUnscheduledContent() {
  const params = useSearchParams()
  const draftId = params.get('draftId')
  const [draft, setDraft] = useState<Draft | null>(null)
  const [className, setClassName] = useState('Assigned class')
  const [subjectName, setSubjectName] = useState('Subject')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [active, setActive] = useState<Active | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [completed, setCompleted] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function load() {
      if (!draftId) { setError('Select an actual prepared lesson first.'); setLoading(false); return }
      try {
        const { data: { user }, error: authError } = await supabase.auth.getUser()
        if (authError) throw authError
        if (!user) throw new Error('Sign in as the teacher who prepared this lesson.')
        const { data, error: draftError } = await supabase.from('lesson_plan_drafts')
          .select('id,teacher_id,school_id,class_id,subject_id,scheme_id,title,topic,body,status')
          .eq('id', draftId).eq('teacher_id', user.id).neq('status', 'archived').maybeSingle()
        if (draftError) throw draftError
        if (!data) throw new Error('This prepared lesson is unavailable. Open it from your own Lesson Plans.')
        const typed = data as Draft
        if (cancelled) return
        setDraft(typed)
        if (typed.class_id) {
          const [cls, subject] = await Promise.all([
            supabase.from('classes').select('name,stream').eq('id',typed.class_id).maybeSingle(),
            supabase.from('subjects').select('name').eq('id',typed.subject_id).maybeSingle(),
          ])
          if (cancelled) return
          if (cls.data) setClassName([cls.data.name,cls.data.stream].filter(Boolean).join(' '))
          if (subject.data) setSubjectName(subject.data.name)
        }
      } catch (cause) {
        if (!cancelled) setError(cause instanceof Error ? cause.message : 'Could not load lesson preparation.')
      } finally { if (!cancelled) setLoading(false) }
    }
    void load()
    return () => { cancelled = true }
  }, [draftId])

  const readiness = useMemo(()=>evaluateLessonReadiness(draft?.body ?? ''),[draft?.body])
  const sections = useMemo(()=>parseLessonPlanBody(active?.plan.body ?? ''),[active?.plan.body])

  async function start() {
    if (!draft || !readiness.ready || busy) return
    setBusy(true)
    setError(null)
    try {
      const { data: occurrence, error: startError } = await supabase.rpc('start_unscheduled_teaching', {
        p_draft_id: draft.id,
      })
      if (startError) throw startError
      if (!occurrence?.id || !occurrence.unscheduled_plan_id) throw new Error('Teaching session was not returned.')
      const { data: plan, error: planError } = await supabase.from('lesson_plans')
        .select('id,title,topic,body')
        .eq('id',occurrence.unscheduled_plan_id).eq('teacher_id',draft.teacher_id).maybeSingle()
      if (planError) throw planError
      if (!plan || !parseLessonPlanBody(plan.body ?? '')) {
        throw new Error('The saved plan needs canonical teaching sections before it can be opened.')
      }
      setCompleted(occurrence.lifecycle === 'completed')
      setActive({ occurrence: occurrence as Occurrence, plan })
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to start this unscheduled lesson.')
    } finally { setBusy(false) }
  }

  async function finish(review: LessonCompletionReview) {
    if (!active) return
    if (!review.attendanceUnavailableReason?.trim() || !review.noEvidenceReason?.trim()) {
      throw new Error('Explain why attendance and learner evidence are unavailable for this unscheduled lesson.')
    }
    const { data, error: completeError } = await supabase.rpc('complete_unscheduled_teaching', {
      p_occurrence_id: active.occurrence.id,
      p_coverage: review.coverage,
      p_what_taught: review.whatWasTaught,
      p_reflection: review.reflection,
      p_attendance_reason: review.attendanceUnavailableReason,
      p_evidence_reason: review.noEvidenceReason,
      p_next_steps: review.nextSteps,
    })
    if (completeError) throw completeError
    if (!data || data.lifecycle !== 'completed') throw new Error('Lesson completion could not be confirmed.')
    setActive(current => current ? { ...current, occurrence: { ...current.occurrence, lifecycle: 'completed' } } : current)
    setCompleted(true)
  }

  const back = <Link href="/teacher/lessonplan/prepare" style={{display:'inline-block',padding:'10px 0',fontWeight:750,color:'#175b43'}}>Back to prepared lessons</Link>
  if (loading) return <main style={{padding:24}}><p role="status">Loading the saved lesson…</p></main>
  if (active && sections) return <LessonTeachMode
    subject={subjectName} className={className} topic={active.plan.topic || active.plan.title || 'Prepared lesson'}
    sections={sections}
    context={{
      lessonPlanId: active.plan.id, occurrenceId: active.occurrence.id,
      teacherId: active.occurrence.teacher_id, schoolId: active.occurrence.school_id,
      classId: active.occurrence.class_id, subjectId: active.occurrence.subject_id,
      timetableSlotId: '', occurrenceDate: active.occurrence.occurrence_date,
      lifecycle: active.occurrence.lifecycle, unscheduled: true,
    }}
    loadCompletionFacts={async()=>({emptyRoster:false,attendanceSaved:false,evidenceSaved:false})}
    onFinishLesson={finish}
    onClose={()=>setActive(null)}
  />
  return <main style={{maxWidth:820,margin:'0 auto',padding:'20px 16px 100px',color:'#173f32'}}>
    {back}
    <h1 style={{fontSize:26,margin:'10px 0'}}>Teach without timetable</h1>
    <p style={{fontSize:13,lineHeight:1.6}}>A real teaching occurrence will be recorded for this exact prepared lesson today. It will not create a weekly timetable slot, attendance, or learner mastery.</p>
    {error && <p role="alert" style={{color:'#991b1b',background:'#fff1f2',padding:12,borderRadius:9}}>{error}</p>}
    {draft && <section style={{background:'#fff',padding:18,border:'1px solid #dce8de',borderRadius:14}}>
      <h2 style={{fontSize:18,margin:'0 0 8px'}}>{draft.title || draft.topic || 'Prepared lesson'}</h2>
      <p style={{fontSize:13,color:'#526e60'}}>{className} · {subjectName}</p>
      {!draft.class_id || !draft.scheme_id ?
        <p role="status">Select an assigned class and a verified Scheme learning outcome before teaching.</p> :
        !readiness.ready ? <>
          <p role="status">The plan needs review before teaching:</p>
          <ul>{readiness.reasons.map(reason=><li key={reason} style={{fontSize:13}}>{reason}</li>)}</ul>
        </> : <p style={{fontSize:13,color:'#0f766e'}}>The prepared content passes the lesson readiness checks. The server will verify the Scheme learning outcome and teaching assignment again.</p>}
      {completed ? <p role="status" style={{fontWeight:750,color:'#047857'}}>This teaching occurrence has been completed.</p> : null}
      <button type="button" disabled={!draft.class_id || !draft.scheme_id || !readiness.ready || busy || completed}
        onClick={()=>void start()} style={{minHeight:44,padding:'10px 17px',background:'#175b43',color:'#fff',border:0,borderRadius:10,opacity:!readiness.ready||busy||completed?0.55:1,fontWeight:750}}>
        {busy ? 'Opening lesson…' : 'Start teaching this lesson'}
      </button>
    </section>}
  </main>
}

export default function UnscheduledTeachingPage() {
  return <Suspense fallback={<main style={{padding:24}}>Loading lesson…</main>}><TeachUnscheduledContent/></Suspense>
}
