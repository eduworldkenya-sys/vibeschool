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

export type LessonCoverageOutcome = 'covered' | 'partial' | 'reteach'

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
  linkedResources?: Array<{ id: string; title: string; available: boolean }>
  onOpenResource?: (id: string) => void
  onFinishLesson?: (outcome: LessonCoverageOutcome, whatWasTaught: string) => Promise<void> | void
  onClose: () => void
}

type TeachStep = { key: keyof LessonPlanSections; label: string; timed: boolean }
type PackView = 'notes' | 'resources' | 'assessment' | 'homework'

const STEPS: TeachStep[] = [
  { key: 'objectives', label: 'Objectives', timed: false },
  { key: 'introduction', label: 'Introduction', timed: true },
  { key: 'development', label: 'Development', timed: true },
  { key: 'consolidation', label: 'Consolidation', timed: true },
  { key: 'assessmentHook', label: 'Check learning', timed: true },
  { key: 'homework', label: 'Homework', timed: false },
]

const TIMED_STEPS = STEPS.filter(step => step.timed)

function parsePositiveMinutes(value: string | undefined): number | null {
  if (!value) return null
  const minutes = Number(value)
  return Number.isFinite(minutes) && minutes > 0 ? minutes : null
}

function totalMinutes(sections: LessonPlanSections): number | null {
  const explicit = sections.assessmentHook.match(/Total lesson time:\s*(\d+)\/(\d+)\s*min/i)
  const explicitTotal = parsePositiveMinutes(explicit?.[1])
  const explicitDenominator = parsePositiveMinutes(explicit?.[2])
  if (explicitTotal !== null && explicitDenominator !== null && explicitTotal === explicitDenominator) return explicitTotal
  const rangeEnds = TIMED_STEPS.flatMap(({ key }) => {
    const match = sections[key].match(/Timing:\s*\d+\s*[–-]\s*(\d+)\s*min/i)
    const end = parsePositiveMinutes(match?.[1])
    return end === null ? [] : [end]
  })
  return rangeEnds.length > 0 ? Math.max(...rangeEnds) : null
}

function resumeKey(context: ClassroomContext) {
  return ['vibeschool','teach-resume',context.schoolId,context.teacherId,context.occurrenceId,context.lessonPlanId].join('.')
}

function cacheKey(context: ClassroomContext) {
  return ['vibeschool','lesson-package',context.schoolId,context.teacherId,context.occurrenceId,context.lessonPlanId].join('.')
}

export default function LessonTeachMode({
  subject, className, topic, sections, context, initialScratchpad = '',
  onScratchpadChange, onUseInReflection, onCaptureEvidence, onFinishLesson, onClose, linkedResources = [], onOpenResource,
}: Props) {
  const router = useRouter()
  const total = useMemo(() => totalMinutes(sections), [sections])
  const [stepIndex, setStepIndex] = useState(0)
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const [packView, setPackView] = useState<PackView>('notes')
  const [scratchpad, setScratchpad] = useState(initialScratchpad)
  const [online, setOnline] = useState(true)
  const [finishing, setFinishing] = useState(false)
  const [finishError, setFinishError] = useState<string | null>(null)
  const [finishOpen, setFinishOpen] = useState(false)
  const [coverageOutcome, setCoverageOutcome] = useState<LessonCoverageOutcome>('covered')
  const [whatWasTaught, setWhatWasTaught] = useState('')

  const available = useMemo(
    () => STEPS.filter(step => (sections[step.key] ?? '').trim().length > 0),
    [sections],
  )
  const safeIndex = Math.min(stepIndex, Math.max(available.length - 1, 0))
  const remainingSeconds = total === null ? null : Math.max(0, total * 60 - elapsedSeconds)
  const remainingMinutes = remainingSeconds === null ? null : Math.floor(remainingSeconds / 60)
  const remainingRemainder = remainingSeconds === null ? null : String(remainingSeconds % 60).padStart(2, '0')
  const step = available[safeIndex]

  useEffect(() => {
    if (total === null) return undefined
    const timer = window.setInterval(() => setElapsedSeconds(value => value + 1), 1000)
    return () => window.clearInterval(timer)
  }, [total])

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
      const saved = JSON.parse(raw) as { stepIndex?: number; elapsedSeconds?: number; scratchpad?: string; lessonPlanId?: string; occurrenceId?: string }
      if (saved.lessonPlanId !== context.lessonPlanId || saved.occurrenceId !== context.occurrenceId) {
        window.localStorage.removeItem(resumeKey(context))
        return
      }
      if (typeof saved.stepIndex === 'number') setStepIndex(Math.max(0, Math.min(saved.stepIndex, available.length - 1)))
      if (typeof saved.elapsedSeconds === 'number' && saved.elapsedSeconds >= 0) setElapsedSeconds(saved.elapsedSeconds)
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
        subject,
        className,
        topic,
        sections,
      }))
    } catch {
      // Device cache is best-effort; canonical server authority remains unchanged.
    }
  }, [context, subject, className, topic, sections])

  function persist(nextStep: number, note: string) {
    if (!context || typeof window === 'undefined') return
    window.localStorage.setItem(resumeKey(context), JSON.stringify({
      version: 1,
      lessonPlanId: context.lessonPlanId,
      occurrenceId: context.occurrenceId,
      schoolId: context.schoolId,
      teacherId: context.teacherId,
      stepIndex: nextStep,
      elapsedSeconds,
      scratchpad: note,
      savedAt: new Date().toISOString(),
    }))
  }

  useEffect(() => {
    if (!context || typeof window === 'undefined' || elapsedSeconds === 0 || elapsedSeconds % 30 !== 0) return
    persist(stepIndex, scratchpad)
  }, [context, stepIndex, scratchpad, elapsedSeconds])

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
    if (!whatWasTaught.trim()) {
      setFinishError('Record what was actually taught before finishing the lesson.')
      return
    }
    setFinishing(true)
    setFinishError(null)
    try {
      await onFinishLesson(coverageOutcome, whatWasTaught.trim())
      if (context && typeof window !== 'undefined') window.localStorage.removeItem(resumeKey(context))
      setFinishOpen(false)
    } catch (error) {
      setFinishError(error instanceof Error ? error.message : 'Lesson could not be completed.')
    } finally {
      setFinishing(false)
    }
  }

  if (!step) {
    return (
      <div style={{ position:'fixed', inset:0, zIndex:1200, background:"var(--teacher-canvas, #f5f6f2)", padding:18 }}>
        <button onClick={onClose}>Close</button>
        <h2>Missing classroom content</h2>
        <p>This lesson has no canonical sections to teach from. Return to the lesson plan and prepare it first.</p>
      </div>
    )
  }

  function blockBetween(source: string, heading: string, nextHeadings: string[]): string {
    const start = source.indexOf(heading)
    if (start < 0) return ''
    const bodyStart = start + heading.length
    const ends = nextHeadings.map(next => source.indexOf(next, bodyStart)).filter(index => index >= 0)
    const end = ends.length > 0 ? Math.min(...ends) : source.length
    return source.slice(bodyStart, end).replace(/^[:\s]+/, '').trim()
  }

  const teachingPoints = blockBetween(sections.development, 'Teaching points / teacher notes', ['Learner activities', 'Check-for-understanding questions and expected answers', 'Misconceptions to watch'])
  const learnerActivities = blockBetween(sections.development, 'Learner activities', ['Check-for-understanding questions and expected answers', 'Misconceptions to watch'])
  const questionsAndAnswers = blockBetween(sections.development, 'Check-for-understanding questions and expected answers', ['Misconceptions to watch'])
  const misconceptions = blockBetween(sections.development, 'Misconceptions to watch', [])
  const actionStyle = { border:'1px solid #cbd5e1', background:'#fff', borderRadius:10, padding:'10px 11px', fontSize:11, fontWeight:800 } as const

  return (
    <div style={{ position:'fixed', inset:0, zIndex:1200, background:"var(--teacher-canvas, #f5f6f2)", overflowY:'auto', padding:'12px 12px 96px', fontFamily:"inherit" }}>
      <div className="studio-teach-shell">
        <header style={{ position:'sticky', top:0, zIndex:2, background:"var(--teacher-canvas, #f5f6f2)", padding:'4px 0 10px' }}>
          <div style={{ display:'flex', justifyContent:'space-between', gap:10 }}>
            <div>
              <div style={{ fontSize:11, fontWeight:750, color: online ? '#047857' : '#b45309', textTransform:'uppercase' }}>
                {online ? 'Teach Now · Prepared Teaching Pack' : 'Offline · cached Prepared Teaching Pack'}
              </div>
              <h1 style={{ fontSize:19, margin:'4px 0' }}>{topic || subject}</h1>
              <div style={{ fontSize:11, color:'#64748b' }}>{subject} · {className}</div>
            </div>
            <button type="button" onClick={onClose} style={actionStyle}>Close</button>
          </div>
        </header>

        {total === null ? (
          <div style={{ background:'#fff7ed', border:'1px solid #fdba74', color:'#9a3412', borderRadius:12, padding:12, marginBottom:12, fontSize:12, fontWeight:700 }}>
            This saved plan has no authoritative timing metadata. The timer is disabled rather than assuming a 40-minute period.
          </div>
        ) : (
          <div style={{ background:"var(--teacher-ink, #1c2923)", color:'#fff', borderRadius:14, padding:12, marginBottom:12 }}>
            <div style={{ fontSize:11, opacity:.75, textTransform:'uppercase', fontWeight:800 }}>Lesson remaining · Total lesson time: {total} min</div>
            <div style={{ fontSize:24, fontWeight:750, marginTop:3 }}>{remainingMinutes}:{remainingRemainder}</div>
          </div>
        )}

        <nav aria-label="Lesson phases" style={{ display:'flex', gap:8, overflowX:'auto', padding:'4px 0 12px' }}>
          {available.map((phase, index) => (
            <button key={phase.key} type="button" aria-pressed={safeIndex === index} onClick={() => changeStep(index)} style={{...actionStyle, flexShrink:0, minHeight:44, background:safeIndex === index ? 'var(--teacher-accent, #6352bd)' : '#fff', color:safeIndex === index ? '#fff' : 'var(--teacher-ink, #29273c)'}}>{phase.label}</button>
          ))}
        </nav>

        <section className="studio-teach-board" style={{ background:"var(--teacher-ink, #1c2923)", color:'#fff', borderRadius:18, padding:16, marginBottom:12 }}>
          <div style={{ fontSize:11, fontWeight:750, color:'#d0c5e8', textTransform:'uppercase' }}>
            Now teaching · {step.label} · Step {safeIndex + 1} of {available.length}
          </div>
          <div style={{ whiteSpace:'pre-wrap', lineHeight:1.72, fontSize:16, marginTop:10 }}>{sections[step.key]}</div>
        </section>

        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:12 }}>
          <button type="button" disabled={safeIndex===0} onClick={()=>changeStep(Math.max(0,safeIndex-1))} style={{...actionStyle,opacity: safeIndex === 0 ? 0.45 : 1}}>← Previous</button>
          <button type="button" disabled={safeIndex>=available.length-1} onClick={()=>changeStep(Math.min(available.length-1,safeIndex+1))} style={{...actionStyle,background:'var(--teacher-accent, #6352bd)',color:'#fff',opacity: safeIndex >= available.length - 1 ? 0.45 : 1}}>Next →</button>
        </div>

        <details className="studio-teach-support"><summary>Teaching notes, resources & differentiation</summary>
        <section aria-label="Prepared lesson materials" style={{ background:'#fff', border:'1px solid #c7d2fe', borderRadius:16, padding:13, marginBottom:12 }}>
          <div style={{ fontSize:11, fontWeight:750, color:'#3730a3', textTransform:'uppercase' }}>Ready beside you</div>
          <div style={{ fontSize:12, color:'#64748b', margin:'3px 0 9px' }}>{sections.resources.trim() ? 'Resources ready' : 'Resources missing'} · {sections.differentiation.trim() ? 'Differentiation ready' : 'Differentiation missing'} · Prepared Teaching Pack</div>
          <div style={{ display:'flex', gap:7, overflowX:'auto', marginBottom:9 }}>
            {([
              ['notes','Notes'],['resources','Resources'],['assessment','Check learning'],['homework','Homework'],
            ] as Array<[PackView,string]>).map(([value,label]) => (
              <button key={value} type="button" onClick={()=>setPackView(value)} style={{...actionStyle,whiteSpace:'nowrap',borderColor:packView===value?'var(--teacher-accent, #6352bd)':'#cbd5e1',background:packView===value?'var(--teacher-accent-soft, #eeeafa)':'#fff'}}>{label}</button>
            ))}
          </div>
          <div style={{ whiteSpace:'pre-wrap', lineHeight:1.65, fontSize:13, background:"var(--teacher-canvas, #f5f6f2)", borderRadius:10, padding:10 }}>
            {packView === 'notes' && [sections.introduction, sections.development, sections.consolidation].filter(Boolean).join('\n\n')}
            {packView === 'resources' && <>{sections.resources}{linkedResources.length > 0 && <div className="studio-teach-resource-links">{linkedResources.map(resource => <button key={resource.id} type="button" disabled={!resource.available || !onOpenResource} onClick={() => onOpenResource?.(resource.id)}>{resource.title} {resource.available ? '↗' : '· Reader unavailable'}</button>)}</div>}</>}
            {packView === 'assessment' && sections.assessmentHook}
            {packView === 'homework' && <><div>{sections.homework}</div><div style={{ marginTop:8, fontSize:11, fontWeight:750, color:'var(--teacher-accent, #6352bd)' }}>View · Edit · Assign · Share</div></>}
          </div>
        </section>

        {step.key === 'development' && sections.differentiation.trim() && (
          <section style={{ background:'#f5f3ff', border:'1px solid #ddd6fe', borderRadius:14, padding:13, marginBottom:12 }}>
            <div style={{ fontSize:11, fontWeight:750, color:'#5b21b6', textTransform:'uppercase', marginBottom:6 }}>Support · Core · Extension</div>
            <div style={{ whiteSpace:'pre-wrap', lineHeight:1.6, fontSize:13 }}>{sections.differentiation}</div>
          </section>
        )}

        {step.key === 'development' && (
          <section style={{ display:'grid', gap:8, marginBottom:12 }}>
            <div style={{ fontSize:11, fontWeight:750, color:'#475569', textTransform:'uppercase' }}>Teaching companion · canonical lesson content</div>
            {teachingPoints && <article style={{ background:'#fff', border:'1px solid #e2e8f0', borderRadius:14, padding:13 }}><strong>Board / explanation / examples</strong><div style={{ whiteSpace:'pre-wrap', marginTop:6, lineHeight:1.6, fontSize:13 }}>{teachingPoints}</div></article>}
            {learnerActivities && <article style={{ background:'#fff', border:'1px solid #e2e8f0', borderRadius:14, padding:13 }}><strong>Teacher prompts & learner activity</strong><div style={{ whiteSpace:'pre-wrap', marginTop:6, lineHeight:1.6, fontSize:13 }}>{learnerActivities}</div></article>}
            {questionsAndAnswers && <article style={{ background:'#ecfeff', border:'1px solid #a5f3fc', borderRadius:14, padding:13 }}><strong>Questions · expected answers / evidence</strong><div style={{ whiteSpace:'pre-wrap', marginTop:6, lineHeight:1.6, fontSize:13 }}>{questionsAndAnswers}</div></article>}
            {misconceptions && <article style={{ background:'#fff7ed', border:'1px solid #fed7aa', borderRadius:14, padding:13 }}><strong>Misconception → correction → re-check</strong><div style={{ whiteSpace:'pre-wrap', marginTop:6, lineHeight:1.6, fontSize:13 }}>{misconceptions}</div><div style={{ marginTop:7, fontSize:12 }}>Re-check with the prepared question or the Scheme assessment method before moving on.</div></article>}
            <article style={{ background:'#f0fdf4', border:'1px solid #bbf7d0', borderRadius:14, padding:13 }}><strong>Formative checkpoint</strong><div style={{ whiteSpace:'pre-wrap', marginTop:6, lineHeight:1.6, fontSize:13 }}>{sections.assessmentHook}</div></article>
          </section>
        )}

        </details>
        {context ? (
          <section style={{ background:'#fff', border:'1px solid #e2e8f0', borderRadius:16, padding:13, marginBottom:12 }}>
            <div style={{ fontSize:11, fontWeight:750, color:'#475569', textTransform:'uppercase', marginBottom:8 }}>Classroom actions · same occurrence</div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(2,minmax(0,1fr))', gap:8 }}>
              <button style={actionStyle} onClick={() => {
                const q = new URLSearchParams({
                  mode: 'lesson',
                  classId: context.classId,
                  subjectId: context.subjectId,
                  timetableSlotId: context.timetableSlotId,
                  date: context.occurrenceDate,
                  lessonPlanId: context.lessonPlanId,
                  occurrenceId: context.occurrenceId,
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
          <div style={{ fontSize:11, fontWeight:750 }}>Private scratchpad</div>
          <div style={{ fontSize:11, color:'#64748b', margin:'4px 0 8px' }}>Private and noncanonical. It becomes an official reflection only after you explicitly review and save it.</div>
          <textarea value={scratchpad} onChange={e=>changeScratchpad(e.target.value)} rows={4} style={{ width:'100%', boxSizing:'border-box', border:'1px solid #cbd5e1', borderRadius:10, padding:10, font:'inherit' }} />
          <button type="button" disabled={!scratchpad.trim() || !onUseInReflection} onClick={()=>onUseInReflection?.(scratchpad)} style={{...actionStyle,marginTop:8,opacity: !scratchpad.trim() || !onUseInReflection ? 0.5 : 1}}>Use in reflection →</button>
        </section>

        {finishError && <div role="alert" style={{ color:'#b91c1c', fontSize:12, marginBottom:8 }}>{finishError}</div>}
        {context?.lifecycle === 'completed' ? (
          <div style={{ padding:13, borderRadius:12, background:"var(--teacher-green-soft, #e9f4ed)", color:'#065f46', fontWeight:800 }}>Lesson already completed</div>
        ) : onFinishLesson ? (
          <>
            {!finishOpen ? (
              <button type="button" disabled={finishing} onClick={()=>setFinishOpen(true)} style={{ width:'100%', border:0, borderRadius:12, padding:13, background:"var(--teacher-green, #087451)", color:'#fff', fontWeight:750 }}>Finish lesson</button>
            ) : (
              <section style={{ background:'#fff', border:'1px solid #bbf7d0', borderRadius:16, padding:13 }}>
                <div style={{ fontSize:12, fontWeight:750 }}>How did coverage end?</div>
                <div style={{ fontSize:11, color:'#64748b', margin:'4px 0 10px' }}>This records teaching coverage only. It never marks learner mastery.</div>
                <div style={{ display:'grid', gap:7 }}>
                  {([
                    ['covered','Completed · content covered'],
                    ['partial','Partially covered'],
                    ['reteach','Reteach required'],
                  ] as Array<[LessonCoverageOutcome,string]>).map(([value,label]) => (
                    <button key={value} type="button" onClick={()=>setCoverageOutcome(value)} style={{...actionStyle,textAlign:'left',borderColor:coverageOutcome===value?'#059669':'#cbd5e1',background:coverageOutcome===value?'#ecfdf5':'#fff'}}>{label}</button>
                  ))}
                </div>
                <label style={{ display:'block', fontSize:11, fontWeight:800, marginTop:10 }}>What was actually taught?</label>
                <textarea value={whatWasTaught} onChange={e=>setWhatWasTaught(e.target.value)} rows={3} placeholder="Briefly record the content actually covered in this occurrence." style={{ width:'100%', boxSizing:'border-box', border:'1px solid #cbd5e1', borderRadius:10, padding:10, marginTop:5, font:'inherit' }} />
                <div style={{ display:'grid', gridTemplateColumns:'1fr 2fr', gap:8, marginTop:9 }}>
                  <button type="button" disabled={finishing} onClick={()=>setFinishOpen(false)} style={actionStyle}>Cancel</button>
                  <button type="button" disabled={finishing || !online || !whatWasTaught.trim()} onClick={finish} style={{...actionStyle,background:"var(--teacher-green, #087451)",color:'#fff',opacity:finishing || !online || !whatWasTaught.trim()?0.55:1}}>{finishing?'Finishing lesson…':online?'Confirm finish':'Reconnect to finish safely'}</button>
                </div>
              </section>
            )}
          </>
        ) : null}
      </div>
    </div>
  )
}
