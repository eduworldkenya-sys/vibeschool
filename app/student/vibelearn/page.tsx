'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import VibeLearnShellWrapper from '@/components/student/VibeLearnShellWrapper'
import { getVibeLearnWorkstation, type VibeLearnWorkstation } from '@/lib/student/vibelearn'

export default function StudentVibeLearnPage() {
  const router = useRouter()
  const [brief, setBrief] = useState<VibeLearnWorkstation | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [libraryOpen, setLibraryOpen] = useState(false)

  useEffect(() => {
    let cancelled = false
    getVibeLearnWorkstation()
      .then(value => { if (!cancelled) setBrief(value) })
      .catch(reason => { if (!cancelled) setError(reason instanceof Error ? reason.message : 'Could not open VibeLearn.') })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [])

  if (libraryOpen) {
    return <VibeLearnShellWrapper isOpen={true} onClose={() => setLibraryOpen(false)} />
  }

  return (
    <main style={shell}>
      <div style={{ maxWidth: 900, margin: '0 auto' }}>
        <section style={hero}>
          <div style={eyebrow}>VibeLearn Workstation</div>
          <h1 style={{ margin: '8px 0 6px', fontSize: 28 }}>Learn. Practise. Revise. Master.</h1>
          <p style={{ margin: 0, color: '#cbd5e1', lineHeight: 1.6 }}>
            Your class library, textbook desk, exam practice and teacher-assigned learning in one place.
          </p>
          {brief?.className && <div style={{ marginTop: 12, fontSize: 12, color: '#a5b4fc' }}>{brief.className}</div>}
        </section>

        {loading ? <section style={card}>Preparing your learning workspace…</section>
          : error ? <section style={{ ...card, color: '#b91c1c' }}>{error}</section>
          : brief && <>
            <section style={card}>
              <div style={sectionHeader}>
                <div><div style={eyebrowDark}>Continue learning</div><h2 style={title}>Your study desk</h2></div>
                <button style={secondaryButton} onClick={() => setLibraryOpen(true)}>Open library</button>
              </div>
              {brief.continueLearning.length === 0 ? (
                <div style={emptyBox}>
                  <strong>No book in progress yet</strong>
                  <p style={muted}>Open the library, choose a textbook or resource, and your progress will return here.</p>
                  <button style={primaryButton} onClick={() => setLibraryOpen(true)}>Browse learning resources</button>
                </div>
              ) : (
                <div style={grid}>
                  {brief.continueLearning.slice(0, 4).map(item => (
                    <button key={`${item.publicationId}-${item.chapterId ?? 'book'}`} style={actionCard} onClick={() => router.push(item.actionUrl)}>
                      <span style={cardIcon}>📘</span>
                      <strong>{item.title}</strong>
                      <span style={muted}>{item.chapterTitle ?? 'Continue reading'}</span>
                      <span style={progressTrack}><span style={{ ...progressFill, width: `${Math.max(0, Math.min(100, item.progressPercent))}%` }} /></span>
                      <span style={linkText}>{item.progressPercent}% complete · Continue →</span>
                    </button>
                  ))}
                </div>
              )}
            </section>

            <section style={card}>
              <div style={sectionHeader}>
                <div><div style={eyebrowDark}>Exam engine</div><h2 style={title}>Practise by subject</h2></div>
                <button style={secondaryButton} onClick={() => router.push('/student/assessment')}>Assessment hub</button>
              </div>
              {brief.practiceBySubject.length === 0 ? <p style={muted}>Practice questions will appear when the exam bank is ready for your subjects.</p>
                : <div style={grid}>
                  {brief.practiceBySubject.map(item => (
                    <button key={item.subject} style={actionCard} onClick={() => router.push(item.actionUrl)}>
                      <span style={cardIcon}>🧠</span>
                      <strong>{item.subject}</strong>
                      <span style={muted}>{item.questionCount} verified questions available</span>
                      <span style={linkText}>Start practice →</span>
                    </button>
                  ))}
                </div>}
            </section>

            <section style={card}>
              <div style={eyebrowDark}>Teacher-assigned learning</div>
              <h2 style={title}>Your class work</h2>
              {brief.assignedAssessments.length === 0 ? <p style={muted}>Assigned quizzes, tests and revision activities will appear here.</p>
                : <div style={{ display: 'grid', gap: 10 }}>
                  {brief.assignedAssessments.map(item => (
                    <button key={item.assignmentId} style={rowButton} onClick={() => router.push(item.actionUrl)}>
                      <div><strong>{item.title}</strong><div style={muted}>{item.subjectName ?? 'General'} · {item.assessmentType.replaceAll('_', ' ')}</div></div>
                      <span style={linkText}>Open →</span>
                    </button>
                  ))}
                </div>}
            </section>

            <section style={card}>
              <div style={eyebrowDark}>Subjects</div>
              <h2 style={title}>Your mini learning library</h2>
              {brief.subjects.length === 0 ? <p style={muted}>Subjects will appear after your class and content library are linked.</p>
                : <div style={grid}>
                  {brief.subjects.map(subject => (
                    <button key={subject.id} style={subjectCard} onClick={() => setLibraryOpen(true)}>
                      <strong>{subject.name}</strong>
                      <span style={muted}>{subject.resourceCount} learning resources</span>
                    </button>
                  ))}
                </div>}
            </section>

            <section style={{ ...card, borderColor: '#ddd6fe', background: '#faf5ff' }}>
              <div style={eyebrowDark}>VibeTwin tutor policy</div>
              <h2 style={title}>AI is support, not the lesson</h2>
              <p style={{ ...muted, lineHeight: 1.6 }}>
                Twin stays off by default. Use it only when you explicitly need a hint, simpler explanation, worked example, translation or mistake explanation. It is blocked during timed assessments.
              </p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
                {brief.tutorPolicy.allowedActions.map(action => <span key={action} style={pill}>{action.replaceAll('_', ' ')}</span>)}
              </div>
              <div style={{ marginTop: 12, fontSize: 12, color: '#6d28d9', fontWeight: 700 }}>Target AI share: {brief.tutorPolicy.aiShareTargetPercent}%</div>
            </section>
          </>}
      </div>
    </main>
  )
}

const shell: React.CSSProperties = { minHeight: '100vh', background: '#f8fafc', padding: '18px 14px 90px', color: '#0f172a', fontFamily: "'Plus Jakarta Sans', sans-serif" }
const hero: React.CSSProperties = { background: 'linear-gradient(135deg,#0f172a,#1e1b4b)', color: '#fff', borderRadius: 22, padding: 22, marginBottom: 14 }
const card: React.CSSProperties = { background: '#fff', border: '1px solid #e2e8f0', borderRadius: 18, padding: 16, marginBottom: 12 }
const eyebrow: React.CSSProperties = { fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 1.2, color: '#a5b4fc' }
const eyebrowDark: React.CSSProperties = { fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 1.1, color: '#4f46e5' }
const title: React.CSSProperties = { margin: '5px 0 12px', fontSize: 19 }
const muted: React.CSSProperties = { fontSize: 12, color: '#64748b', margin: 0 }
const sectionHeader: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }
const grid: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 10 }
const actionCard: React.CSSProperties = { border: '1px solid #e2e8f0', background: '#fff', borderRadius: 14, padding: 14, textAlign: 'left', display: 'grid', gap: 7, cursor: 'pointer', fontFamily: 'inherit' }
const subjectCard: React.CSSProperties = { ...actionCard, background: '#f8fafc' }
const rowButton: React.CSSProperties = { width: '100%', border: '1px solid #e2e8f0', borderRadius: 12, padding: 13, background: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit' }
const cardIcon: React.CSSProperties = { fontSize: 22 }
const primaryButton: React.CSSProperties = { border: 'none', background: '#4f46e5', color: '#fff', borderRadius: 12, padding: '11px 14px', fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit' }
const secondaryButton: React.CSSProperties = { border: '1px solid #c7d2fe', background: '#eef2ff', color: '#4338ca', borderRadius: 10, padding: '8px 11px', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }
const emptyBox: React.CSSProperties = { border: '1px dashed #cbd5e1', borderRadius: 14, padding: 16 }
const progressTrack: React.CSSProperties = { display: 'block', height: 6, borderRadius: 999, background: '#e2e8f0', overflow: 'hidden' }
const progressFill: React.CSSProperties = { display: 'block', height: '100%', background: '#4f46e5' }
const linkText: React.CSSProperties = { color: '#4338ca', fontSize: 12, fontWeight: 800 }
const pill: React.CSSProperties = { fontSize: 11, color: '#6d28d9', background: '#ede9fe', borderRadius: 999, padding: '5px 9px', fontWeight: 700 }
