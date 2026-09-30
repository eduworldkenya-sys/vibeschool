'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { LessonPlanSections } from '@/lib/teaching/lessonPlanCodec'

type ClassroomContext = {
  lessonPlanId: string
  occurrenceId: string
  teacherId: string
  schoolId: string
  classId: string
  subjectId: string
  lifecycle: string
  timetableSlotId: string
  occurrenceDate: string
}

type Props = {
  subject: string
  className: string
  topic: string
  sections: LessonPlanSections
  context?: ClassroomContext | null
  initialScratchpad?: string
  onScratchpadChange?: (value: string) => void
  onUseInReflection?: (value: string) => void
  onCaptureEvidence?: () => void
  onFinishLesson?: () => Promise<void> | void
  onClose: () => void
}

type TeachStep = { key: keyof LessonPlanSections; label: string; timed: boolean }

const STEPS: TeachStep[] = [
  { key: 'objectives', label: 'Objectives', timed: false },
  { key: 'introduction', label: 'Introduction', timed: true },
  { key: 'development', label: 'Development', timed: true },
  { key: 'consolidation', label: 'Consolidation', timed: true },
  { key: 'assessmentHook', label: 'Check learning', timed: true },
  { key: 'homework', label: 'Homework', timed: false },
]

function resumeKey(context: ClassroomContext) {
  return ['vibeschool','teach-resume',context.schoolId,context.teacherId,context.occurrenceId,context.lessonPlanId].join('.')
}

function cacheKey(context: ClassroomContext) {
  return ['vibeschool','lesson-package',context.schoolId,context.teacherId,context.occurrenceId,context.lessonPlanId].join('.')
}

export default function LessonTeachMode({
  subject, className, topic, sections, context, initialScratchpad = '',
  onScratchpadChange, onUseInReflection, onCaptureEvidence, onFinishLesson, onClose,
}: Props) {
  const router = useRouter()
  const [stepIndex, setStepIndex] = useState(0)
  const [scratchpad, setScratchpad] = useState(initialScratchpad)
  const [online, setOnline] = useState(true)
  const [finishing, setFinishing] = useState(false)
  const [finishError, setFinishError] = useState<string | null>(null)

  const available = useMemo(
    () => STEPS.filter(step => (sections[step.key] ?? '').trim().length > 0),
    [sections],
  )
  const safeIndex = Math.min(stepIndex, Math.max(available.length - 1, 0))
  const step = available[safeIndex]

  useEffect(() => {
    if (typeof window === 'undefined') return
    setOnline(window.navigator.onLine)
    const yes = () => setOnline(true)
    const no = () => setOnline(false)
    window.addEventListener('online', yes)
    window.addEventListener('offline', no)
    return () => {
      window.removeEventListener('online', yes)
      window.removeEventListener('offline', no)
    }
  }, [])

  useEffect(() => {
    if (!context || typeof window === 'undefined') return
    try {
      const raw = window.localStorage.getItem(resumeKey(context))
      if (!raw) return
      const saved = JSON.parse(raw) as { stepIndex?: number; scratchpad?: string; lessonPlanId?: string; occurrenceId?: string }
      if (saved.lessonPlanId !== context.lessonPlanId || saved.occurrenceId !== context.occurrenceId) {
        window.localStorage.removeItem(resumeKey(context))
        return
      }
      if (typeof saved.stepIndex === 'number') setStepIndex(Math.max(0, Math.min(saved.stepIndex, available.length - 1)))
      if (typeof saved.scratchpad === 'string') {
        setScratchpad(saved.scratchpad)
        onScratchpadChange?.(saved.scratchpad)
      }
    } catch {
      window.localStorage.removeItem(resumeKey(context))
    }
  }, [context, available.length, onScratchpadChange])

  useEffect(() => {
    if (!context || typeof window === 'undefined') return
    try {
      window.localStorage.setItem(cacheKey(context), JSON.stringify({
        version: 1,
        identity: context,
        cachedAt: new Date().toISOString(),
        sections,
      }))
    } catch {
      // Device cache is best-effort; canonical server authority remains unchanged.
    }
  }, [context, sections])

  function persist(nextStep: number, note: string) {
    if (!context || typeof window === 'undefined') return
    window.localStorage.setItem(resumeKey(context), JSON.stringify({
      version: 1,
      lessonPlanId: context.lessonPlanId,
      occurrenceId: context.occurrenceId,
      schoolId: context.schoolId,
      teacherId: context.teacherId,
      stepIndex: nextStep,
      scratchpad: note,
      savedAt: new Date().toISOString(),
    }))
  }

  function changeStep(next: number) {
    setStepIndex(next)
    persist(next, scratchpad)
  }

  function changeScratchpad(value: string) {
    setScratchpad(value)
    onScratchpadChange?.(value)
    persist(safeIndex, value)
  }

  function openAction(path: string) {
    if (!context) return
    const q = new URLSearchParams({
      lessonPlanId: context.lessonPlanId,
      occurrenceId: context.occurrenceId,
      classId: context.classId,
      subjectId: context.subjectId,
      timetableSlotId: context.timetableSlotId,
      date: context.occurrenceDate,
    })
    router.push(`${path}?${q.toString()}`)
  }

  async function finish() {
    if (!onFinishLesson || finishing) return
    setFinishing(true)
    setFinishError(null)
    try {
      await onFinishLesson()
      if (context && typeof window !== 'undefined') window.localStorage.removeItem(resumeKey(context))
    } catch (error) {
      setFinishError(error instanceof Error ? error.message : 'Lesson could not be completed.')
    } finally {
      setFinishing(false)
    }
  }

  if (!step) {
    return (
      <div style={{ position:'fixed', inset:0, zIndex:1200, background:'#f8fafc', padding:18 }}>
        <button onClick={onClose}>Close</button>
        <h2>Missing classroom content</h2>
        <p>This lesson has no canonical sections to teach from. Return to the lesson plan and prepare it first.</p>
      </div>
    )
  }

  const actionStyle = { border:'1px solid #cbd5e1', background:'#fff', borderRadius:10, padding:'10px 11px', fontSize:11, fontWeight:800 } as const

  return (
    <div style={{ position:'fixed', inset:0, zIndex:1200, background:'#f8fafc', overflowY:'auto', padding:'12px 12px 96px', fontFamily:"'Plus Jakarta Sans', sans-serif" }}>
      <div style={{ maxWidth:720, margin:'0 auto' }}>
        <header style={{ position:'sticky', top:0, zIndex:2, background:'#f8fafc', padding:'4px 0 10px' }}>
          <div style={{ display:'flex', justifyContent:'space-between', gap:10 }}>
            <div>
              <div style={{ fontSize:10, fontWeight:900, color: online ? '#047857' : '#b45309', textTransform:'uppercase' }}>
                {online ? 'Teach mode' : 'Offline · cached lesson'}
              </div>
              <h1 style={{ fontSize:19, margin:'4px 0' }}>{topic || subject}</h1>
              <div style={{ fontSize:11, color:'#64748b' }}>{subject} · {className}</div>
            </div>
            <button type="button" onClick={onClose} style={actionStyle}>Close</button>
          </div>
        </header>

        <section style={{ background:'#111827', color:'#fff', borderRadius:18, padding:16, marginBottom:12 }}>
          <div style={{ fontSize:10, fontWeight:900, color:'#86efac', textTransform:'uppercase' }}>
            Now teaching · {step.label} · Step {safeIndex + 1} of {available.length}
          </div>
          <div style={{ whiteSpace:'pre-wrap', lineHeight:1.72, fontSize:16, marginTop:10 }}>{sections[step.key]}</div>
        </section>

        {step.key === 'development' && sections.differentiation.trim() && (
          <section style={{ background:'#f5f3ff', border:'1px solid #ddd6fe', borderRadius:14, padding:13, marginBottom:12 }}>
            <div style={{ fontSize:10, fontWeight:900, color:'#5b21b6', textTransform:'uppercase', marginBottom:6 }}>Support · Core · Extension</div>
            <div style={{ whiteSpace:'pre-wrap', lineHeight:1.6, fontSize:13 }}>{sections.differentiation}</div>
          </section>
        )}

        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:12 }}>
          <button type="button" disabled={safeIndex===0} onClick={()=>changeStep(Math.max(0,safeIndex-1))} style={{...actionStyle,opacity: safeIndex === 0 ? 0.45 : 1}}>← Previous</button>
          <button type="button" disabled={safeIndex>=available.length-1} onClick={()=>changeStep(Math.min(available.length-1,safeIndex+1))} style={{...actionStyle,background:'#4338ca',color:'#fff',opacity: safeIndex >= available.length - 1 ? 0.45 : 1}}>Next →</button>
        </div>

        {context ? (
          <section style={{ background:'#fff', border:'1px solid #e2e8f0', borderRadius:16, padding:13, marginBottom:12 }}>
            <div style={{ fontSize:10, fontWeight:900, color:'#475569', textTransform:'uppercase', marginBottom:8 }}>Classroom actions · same occurrence</div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(2,minmax(0,1fr))', gap:8 }}>
              <button style={actionStyle} onClick={() => {
                const q = new URLSearchParams({
                  mode: 'lesson',
                  classId: context.classId,
                  subjectId: context.subjectId,
                  timetableSlotId: context.timetableSlotId,
                  date: context.occurrenceDate,
                })
                router.push(`/teacher/attendance?${q.toString()}`)
              }}>Attendance</button>
              <button style={actionStyle} disabled={!onCaptureEvidence} onClick={()=>onCaptureEvidence?.()}>Evidence</button>
              <button style={actionStyle} onClick={()=>openAction(`/teacher/classhub/${encodeURIComponent(context.classId)}/homework`)}>Homework</button>
              <button style={actionStyle} onClick={()=>openAction('/teacher/assessment/new')}>Assessment</button>
            </div>
          </section>
        ) : (
          <div style={{ padding:12, borderRadius:12, background:'#fff7ed', border:'1px solid #fdba74', fontSize:12, marginBottom:12 }}>
            Open this lesson from Today/Week to use occurrence-bound classroom actions and resume.
          </div>
        )}

        <section style={{ background:'#fff', border:'1px solid #e2e8f0', borderRadius:16, padding:13, marginBottom:12 }}>
          <div style={{ fontSize:11, fontWeight:900 }}>Private scratchpad</div>
          <div style={{ fontSize:10, color:'#64748b', margin:'4px 0 8px' }}>Private and noncanonical. It becomes an official reflection only after you explicitly review and save it.</div>
          <textarea value={scratchpad} onChange={e=>changeScratchpad(e.target.value)} rows={4} style={{ width:'100%', boxSizing:'border-box', border:'1px solid #cbd5e1', borderRadius:10, padding:10, font:'inherit' }} />
          <button type="button" disabled={!scratchpad.trim() || !onUseInReflection} onClick={()=>onUseInReflection?.(scratchpad)} style={{...actionStyle,marginTop:8,opacity: !scratchpad.trim() || !onUseInReflection ? 0.5 : 1}}>Use in reflection →</button>
        </section>

        {finishError && <div role="alert" style={{ color:'#b91c1c', fontSize:12, marginBottom:8 }}>{finishError}</div>}
        {context?.lifecycle === 'completed' ? (
          <div style={{ padding:13, borderRadius:12, background:'#d1fae5', color:'#065f46', fontWeight:800 }}>Lesson already completed</div>
        ) : onFinishLesson ? (
          <button type="button" disabled={finishing} onClick={finish} style={{ width:'100%', border:0, borderRadius:12, padding:13, background:'#059669', color:'#fff', fontWeight:900 }}>
            {finishing ? 'Finishing lesson…' : 'Finish lesson'}
          </button>
        ) : null}
      </div>
    </div>
  )
}
