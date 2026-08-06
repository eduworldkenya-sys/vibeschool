'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import VibeLearnShellWrapper from '@/components/student/VibeLearnShellWrapper'
import {
  getExamReadinessBrief,
  getVibeLearnWorkstation,
  updateExamReadiness,
  type ExamReadinessBrief,
  type VibeLearnWorkstation,
} from '@/lib/student/vibelearn'

export default function StudentVibeLearnPage() {
  const router = useRouter()
  const [brief, setBrief] = useState<VibeLearnWorkstation | null>(null)
  const [readiness, setReadiness] = useState<ExamReadinessBrief | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [libraryOpen, setLibraryOpen] = useState(false)
  const [editingPlan, setEditingPlan] = useState(false)
  const [savingPlan, setSavingPlan] = useState(false)
  const [examDate, setExamDate] = useState('')
  const [dailyMinutes, setDailyMinutes] = useState(90)
  const [confidence, setConfidence] = useState<number | null>(null)

  async function loadWorkspace() {
    const [workspace, readinessBrief] = await Promise.all([getVibeLearnWorkstation(), getExamReadinessBrief()])
    setBrief(workspace)
    setReadiness(readinessBrief)
    setExamDate(readinessBrief.examDate ?? '')
    setDailyMinutes(readinessBrief.dailyRevisionMinutes)
    setConfidence(readinessBrief.confidenceCheck)
  }

  useEffect(() => {
    let cancelled = false
    Promise.all([getVibeLearnWorkstation(), getExamReadinessBrief()])
      .then(([workspace, readinessBrief]) => {
        if (cancelled) return
        setBrief(workspace)
        setReadiness(readinessBrief)
        setExamDate(readinessBrief.examDate ?? '')
        setDailyMinutes(readinessBrief.dailyRevisionMinutes)
        setConfidence(readinessBrief.confidenceCheck)
      })
      .catch(reason => { if (!cancelled) setError(reason instanceof Error ? reason.message : 'Could not open VibeLearn.') })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [])

  async function saveReadinessPlan() {
    setSavingPlan(true)
    setError('')
    try {
      await updateExamReadiness({ examDate: examDate || null, dailyRevisionMinutes: dailyMinutes, confidenceCheck: confidence })
      await loadWorkspace()
      setEditingPlan(false)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not save your exam plan.')
    } finally {
      setSavingPlan(false)
    }
  }

  if (libraryOpen) return <VibeLearnShellWrapper isOpen={true} onClose={() => setLibraryOpen(false)} />

  return <main style={shell}>
    <div style={{ maxWidth: 900, margin: '0 auto' }}>
      <section style={hero}>
        <div style={eyebrow}>VibeLearn Workstation</div>
        <h1 style={{ margin: '8px 0 6px', fontSize: 28 }}>Learn. Practise. Revise. Master.</h1>
        <p style={{ margin: 0, color: '#cbd5e1', lineHeight: 1.6 }}>Your class library, textbook desk, exam practice and teacher-assigned learning in one place.</p>
        {brief?.className && <div style={{ marginTop: 12, fontSize: 12, color: '#a5b4fc' }}>{brief.className}</div>}
      </section>

      {loading ? <section style={card}>Preparing your learning workspace…</section>
        : error && !brief ? <section style={{ ...card, color: '#b91c1c' }}>{error}</section>
        : brief && <>
          {readiness && <section style={{ ...card, borderColor: '#f59e0b', background: '#fffaf0' }}>
            <div style={sectionHeader}>
              <div>
                <div style={{ ...eyebrowDark, color: '#b45309' }}>Form 4 exam readiness</div>
                <h2 style={{ ...title, marginBottom: 4 }}>{readiness.examName} focus plan</h2>
                <p style={{ ...muted, lineHeight: 1.6 }}>{readiness.psychologyHeadline}</p>
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                <button style={primaryButton} onClick={() => router.push('/student/vibelearn/revision')}>Open Revision OS</button>
                <button style={{ ...secondaryButton, borderColor: '#fcd34d', background: '#fef3c7', color: '#92400e' }} onClick={() => setEditingPlan(value => !value)}>{editingPlan ? 'Close' : 'Set plan'}</button>
              </div>
            </div>

            <div style={{ ...grid, marginTop: 14 }}>
              <Stat label="Days remaining" value={readiness.daysRemaining ?? '—'} detail={readiness.examDate ? `Exam date: ${new Date(`${readiness.examDate}T12:00:00`).toLocaleDateString('en-KE')}` : 'Set your exam date'} />
              <Stat label="Daily revision" value={`${readiness.dailyRevisionMinutes} min`} detail="Focused study target" />
              <Stat label="Target grade" value={readiness.targetGrade ?? 'Not set'} detail="Set from Student Home goals" />
              <Stat label="Assessment evidence" value={readiness.averagePercentage == null ? '—' : `${readiness.averagePercentage}%`} detail={`${readiness.attemptCount} completed attempt${readiness.attemptCount === 1 ? '' : 's'}`} />
            </div>

            {editingPlan && <div style={planEditor}>
              <label style={fieldLabel}>Exam date<input type="date" value={examDate} onChange={event => setExamDate(event.target.value)} style={inputStyle} /></label>
              <label style={fieldLabel}>Daily revision minutes<input type="number" min={15} max={480} value={dailyMinutes} onChange={event => setDailyMinutes(Number(event.target.value) || 15)} style={inputStyle} /></label>
              <div><div style={fieldLabel}>How confident do you feel today?</div><div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', marginTop: 6 }}>{[1,2,3,4,5].map(value => <button key={value} onClick={() => setConfidence(value)} style={{ ...confidenceButton, ...(confidence === value ? confidenceButtonActive : {}) }}>{value}</button>)}</div></div>
              <button style={primaryButton} disabled={savingPlan} onClick={() => void saveReadinessPlan()}>{savingPlan ? 'Saving…' : 'Save exam plan'}</button>
            </div>}

            {error && <div style={{ marginTop: 10, color: '#b91c1c', fontSize: 12 }}>{error}</div>}

            <div style={{ marginTop: 16 }}>
              <div style={eyebrowDark}>What to revise now</div><h3 style={{ margin: '5px 0 10px', fontSize: 16 }}>Your highest-value practice</h3>
              {readiness.revisionPriorities.length === 0 ? <p style={muted}>Form 4 practice priorities will appear when verified exam questions are available.</p> : <div style={{ display: 'grid', gap: 9 }}>
                {readiness.revisionPriorities.slice(0,3).map(item => <button key={`${item.subject}-${item.topic}`} style={rowButton} onClick={() => router.push(`/student/vibelearn/topic?subject=${encodeURIComponent(item.subject)}&topic=${encodeURIComponent(item.topic)}`)}>
                  <div><strong>{item.subject}: {item.topic}</strong><div style={muted}>{item.reason} · {item.availableQuestions} questions</div></div><span style={linkText}>Open topic →</span>
                </button>)}
              </div>}
            </div>

            {readiness.subjectSignals.length > 0 && <div style={{ marginTop: 16 }}><div style={eyebrowDark}>Your evidence</div><h3 style={{ margin: '5px 0 10px', fontSize: 16 }}>Subject signals</h3><div style={grid}>
              {readiness.subjectSignals.slice(0,6).map(subject => <div key={`${subject.subjectId ?? 'general'}-${subject.subjectName}`} style={subjectSignalCard}>
                <strong>{subject.subjectName}</strong><span style={{ ...signalPill, ...(subject.signal === 'needs_attention' ? signalNeedsAttention : subject.signal === 'strong' ? signalStrong : signalDeveloping) }}>{subject.signal.replaceAll('_',' ')}</span><span style={muted}>{subject.averagePercentage}% across {subject.attempts} attempt{subject.attempts === 1 ? '' : 's'}</span>
              </div>)}
            </div></div>}

            <div style={psychologyNote}><strong>{readiness.comparisonRule}</strong><span>{readiness.predictionDisclaimer}</span></div>
          </section>}

          <section style={card}>
            <div style={sectionHeader}><div><div style={eyebrowDark}>Continue learning</div><h2 style={title}>Your study desk</h2></div><button style={secondaryButton} onClick={() => setLibraryOpen(true)}>Open library</button></div>
            {brief.continueLearning.length === 0 ? <div style={emptyBox}><strong>No book in progress yet</strong><p style={muted}>Open the library, choose a textbook or resource, and your progress will return here.</p><button style={primaryButton} onClick={() => setLibraryOpen(true)}>Browse learning resources</button></div> : <div style={grid}>
              {brief.continueLearning.slice(0,4).map(item => <button key={`${item.publicationId}-${item.chapterId ?? 'book'}`} style={actionCard} onClick={() => router.push(item.actionUrl)}><span style={cardIcon}>📘</span><strong>{item.title}</strong><span style={muted}>{item.chapterTitle ?? 'Continue reading'}</span><span style={progressTrack}><span style={{ ...progressFill, width: `${Math.max(0,Math.min(100,item.progressPercent))}%` }} /></span><span style={linkText}>{item.progressPercent}% complete · Continue →</span></button>)}
            </div>}
          </section>

          <section style={card}>
            <div style={sectionHeader}><div><div style={eyebrowDark}>Exam engine</div><h2 style={title}>Practise by subject</h2></div><div style={{ display:'flex', gap:8, flexWrap:'wrap' }}><button style={secondaryButton} onClick={() => router.push('/student/vibelearn/revision')}>Revision OS</button><button style={secondaryButton} onClick={() => router.push('/student/assessment')}>Assessment hub</button></div></div>
            {brief.practiceBySubject.length === 0 ? <p style={muted}>Practice questions will appear when the exam bank is ready for your subjects.</p> : <div style={grid}>{brief.practiceBySubject.map(item => <button key={item.subject} style={actionCard} onClick={() => router.push(item.actionUrl)}><span style={cardIcon}>🧠</span><strong>{item.subject}</strong><span style={muted}>{item.questionCount} verified questions available</span><span style={linkText}>Start practice →</span></button>)}</div>}
          </section>

          <section style={card}><div style={eyebrowDark}>Teacher-assigned learning</div><h2 style={title}>Your class work</h2>{brief.assignedAssessments.length === 0 ? <p style={muted}>Assigned quizzes, tests and revision activities will appear here.</p> : <div style={{ display:'grid', gap:10 }}>{brief.assignedAssessments.map(item => <button key={item.assignmentId} style={rowButton} onClick={() => router.push(item.actionUrl)}><div><strong>{item.title}</strong><div style={muted}>{item.subjectName ?? 'General'} · {item.assessmentType.replaceAll('_',' ')}</div></div><span style={linkText}>Open →</span></button>)}</div>}</section>

          <section style={card}><div style={eyebrowDark}>Subjects</div><h2 style={title}>Your mini learning library</h2>{brief.subjects.length === 0 ? <p style={muted}>Subjects will appear after your class and content library are linked.</p> : <div style={grid}>{brief.subjects.map(subject => <button key={subject.id} style={subjectCard} onClick={() => setLibraryOpen(true)}><strong>{subject.name}</strong><span style={muted}>{subject.resourceCount} learning resources</span></button>)}</div>}</section>

          <section style={{ ...card, borderColor:'#ddd6fe', background:'#faf5ff' }}><div style={eyebrowDark}>VibeTwin tutor policy</div><h2 style={title}>AI is support, not the lesson</h2><p style={{ ...muted, lineHeight:1.6 }}>Twin stays off by default. Use it only when you explicitly need a hint, simpler explanation, worked example, translation or mistake explanation. It is blocked during timed assessments.</p><div style={{ display:'flex', flexWrap:'wrap', gap:8, marginTop:12 }}>{brief.tutorPolicy.allowedActions.map(action => <span key={action} style={pill}>{action.replaceAll('_',' ')}</span>)}</div><div style={{ marginTop:12, fontSize:12, color:'#6d28d9', fontWeight:700 }}>Target AI share: {brief.tutorPolicy.aiShareTargetPercent}%</div></section>
        </>}
    </div>
  </main>
}

function Stat({ label, value, detail }: { label: string; value: string | number; detail: string }) { return <div style={statCard}><span style={statLabel}>{label}</span><strong style={statValue}>{value}</strong><span style={muted}>{detail}</span></div> }

const shell: React.CSSProperties = { minHeight:'100vh', background:'#f8fafc', padding:'18px 14px 90px', color:'#0f172a', fontFamily:"'Plus Jakarta Sans', sans-serif" }
const hero: React.CSSProperties = { background:'linear-gradient(135deg,#0f172a,#1e1b4b)', color:'#fff', borderRadius:22, padding:22, marginBottom:14 }
const card: React.CSSProperties = { background:'#fff', border:'1px solid #e2e8f0', borderRadius:18, padding:16, marginBottom:12 }
const eyebrow: React.CSSProperties = { fontSize:10, fontWeight:800, textTransform:'uppercase', letterSpacing:1.2, color:'#a5b4fc' }
const eyebrowDark: React.CSSProperties = { fontSize:10, fontWeight:800, textTransform:'uppercase', letterSpacing:1.1, color:'#4f46e5' }
const title: React.CSSProperties = { margin:'5px 0 12px', fontSize:19 }
const muted: React.CSSProperties = { fontSize:12, color:'#64748b', margin:0 }
const sectionHeader: React.CSSProperties = { display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:12 }
const grid: React.CSSProperties = { display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(180px,1fr))', gap:10 }
const actionCard: React.CSSProperties = { border:'1px solid #e2e8f0', background:'#fff', borderRadius:14, padding:14, textAlign:'left', display:'grid', gap:7, cursor:'pointer', fontFamily:'inherit' }
const subjectCard: React.CSSProperties = { ...actionCard, background:'#f8fafc' }
const rowButton: React.CSSProperties = { width:'100%', border:'1px solid #e2e8f0', borderRadius:12, padding:13, background:'#fff', display:'flex', justifyContent:'space-between', alignItems:'center', gap:12, textAlign:'left', cursor:'pointer', fontFamily:'inherit' }
const cardIcon: React.CSSProperties = { fontSize:22 }
const primaryButton: React.CSSProperties = { border:'none', background:'#4f46e5', color:'#fff', borderRadius:12, padding:'11px 14px', fontWeight:800, cursor:'pointer', fontFamily:'inherit' }
const secondaryButton: React.CSSProperties = { border:'1px solid #c7d2fe', background:'#eef2ff', color:'#4338ca', borderRadius:10, padding:'8px 11px', fontWeight:700, cursor:'pointer', fontFamily:'inherit' }
const emptyBox: React.CSSProperties = { border:'1px dashed #cbd5e1', borderRadius:14, padding:16 }
const progressTrack: React.CSSProperties = { display:'block', height:6, borderRadius:999, background:'#e2e8f0', overflow:'hidden' }
const progressFill: React.CSSProperties = { display:'block', height:'100%', background:'#4f46e5' }
const linkText: React.CSSProperties = { color:'#4338ca', fontSize:12, fontWeight:800 }
const pill: React.CSSProperties = { fontSize:11, color:'#6d28d9', background:'#ede9fe', borderRadius:999, padding:'5px 9px', fontWeight:700 }
const statCard: React.CSSProperties = { border:'1px solid #fde68a', background:'#fff', borderRadius:14, padding:13, display:'grid', gap:4 }
const statLabel: React.CSSProperties = { fontSize:10, textTransform:'uppercase', letterSpacing:0.8, color:'#92400e', fontWeight:800 }
const statValue: React.CSSProperties = { fontSize:24, color:'#78350f' }
const planEditor: React.CSSProperties = { marginTop:14, border:'1px solid #fde68a', background:'#fff', borderRadius:14, padding:14, display:'grid', gap:12 }
const fieldLabel: React.CSSProperties = { display:'grid', gap:6, fontSize:12, fontWeight:700, color:'#334155' }
const inputStyle: React.CSSProperties = { border:'1px solid #cbd5e1', borderRadius:10, padding:'10px 11px', font:'inherit' }
const confidenceButton: React.CSSProperties = { width:38, height:38, borderRadius:999, border:'1px solid #cbd5e1', background:'#fff', fontWeight:800, cursor:'pointer' }
const confidenceButtonActive: React.CSSProperties = { background:'#f59e0b', color:'#fff', borderColor:'#f59e0b' }
const subjectSignalCard: React.CSSProperties = { border:'1px solid #e2e8f0', borderRadius:12, padding:12, display:'grid', gap:7, background:'#fff' }
const signalPill: React.CSSProperties = { width:'fit-content', borderRadius:999, padding:'4px 8px', fontSize:10, fontWeight:800, textTransform:'uppercase' }
const signalNeedsAttention: React.CSSProperties = { background:'#fee2e2', color:'#991b1b' }
const signalDeveloping: React.CSSProperties = { background:'#fef3c7', color:'#92400e' }
const signalStrong: React.CSSProperties = { background:'#dcfce7', color:'#166534' }
const psychologyNote: React.CSSProperties = { marginTop:16, borderRadius:12, padding:12, background:'#fffbeb', color:'#78350f', display:'grid', gap:5, fontSize:12 }
