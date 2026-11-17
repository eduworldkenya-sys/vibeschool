'use client'

import { useEffect, useState, type CSSProperties } from 'react'
import Link from 'next/link'
import { useStudent } from '@/lib/student-context'
import { PUBLIC_LEARNING_LEVELS, resolveLearningSelection } from '@/lib/learner/learning-levels'

const CHOICES = PUBLIC_LEARNING_LEVELS.flatMap(group =>
  group.choices.map(choice => ({ key: group.id + ':' + choice, level: group.id, group: group.label, choice }))
)
const STORAGE = 'vibeschool:qa-study-level:v1:'
const selectStyle: CSSProperties = { minHeight: 42, padding: '8px 10px', borderRadius: 10, width: '100%',
  border: '1px solid var(--vs-border)', background: 'var(--vs-card)', color: 'var(--vs-text)', fontSize: 13 }
const actionStyle: CSSProperties = { display: 'flex', alignItems: 'center', justifyContent: 'space-between',
  minHeight: 52, padding: '12px 14px', borderRadius: 12, background: 'var(--vs-card)',
  border: '1px solid var(--vs-border)', color: 'var(--vs-text)', fontWeight: 750, textDecoration: 'none' }

/** Owner-enabled QA preview. Switching levels, teachers or classes is deliberately
 * device-local; it cannot create enrollment, unlock school records or write graded work. */
export default function UniversalQaLearnerPage() {
  const { identity, loading, error } = useStudent()
  const [choiceKey, setChoiceKey] = useState('junior:Grade 9')
  const [scenario, setScenario] = useState<'independent' | 'school-linked'>('independent')
  const [teacher, setTeacher] = useState('Demo Teacher 01')
  const [className, setClassName] = useState('Demo Class A')
  useEffect(() => {
    if (!identity?.universalTest) return
    try {
      const saved = window.localStorage.getItem(STORAGE + identity.studentId)
      if (saved && CHOICES.some(entry => entry.key === saved)) setChoiceKey(saved)
    } catch { /* Local QA preference is optional, never authorization. */ }
  }, [identity?.studentId, identity?.universalTest])

  if (loading) return <main role="status">Opening test levels…</main>
  if (!identity?.universalTest) return <main role="alert" style={{padding:16}}>{error || 'Universal test access is not enabled for this account.'}</main>

  const item = CHOICES.find(entry => entry.key === choiceKey) ?? CHOICES[0]
  const selection = resolveLearningSelection(item.level, item.choice)
  const professional = !!selection?.pathway
  const learnLink = professional ? '/learn/kasneb-cpa' : '/learn?grade=' + encodeURIComponent(selection?.gradeLabel ?? item.choice)
  const labelStyle: CSSProperties = { display: 'grid', gap: 5, fontSize: 12, fontWeight: 750 }
  return <main style={{maxWidth:720,margin:'0 auto',display:'grid',gap:12}}>
    <header style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}>
      <h1 style={{fontSize:22,margin:0}}>All levels</h1>
      <span style={{fontSize:11,fontWeight:800,color:'var(--vs-accent)',background:'var(--vs-accent-soft)',padding:'6px 9px',borderRadius:8}}>QA ONLY</span>
    </header>
    <label style={labelStyle}>Learning level
      <select aria-label="QA learning level" style={selectStyle} value={choiceKey} onChange={event=>{
        const next=event.target.value
        if (!CHOICES.some(entry=>entry.key===next)) return
        setChoiceKey(next)
        try {window.localStorage.setItem(STORAGE + identity.studentId, next)} catch { /* session remains usable */ }
      }}>
        {CHOICES.map(entry=><option key={entry.key} value={entry.key}>{entry.group} — {entry.choice}</option>)}
      </select>
    </label>
    <section aria-label="Demo school context" style={{display:'grid',gap:8}}>
      <div style={{fontSize:12,fontWeight:750,color:'var(--vs-muted)'}}>Demo classroom context (not actual enrollment)</div>
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(130px,1fr))',gap:8}}>
        <label style={labelStyle}>Mode
          <select style={selectStyle} value={scenario} onChange={event=>setScenario(event.target.value==='school-linked'?'school-linked':'independent')}>
            <option value="independent">Independent</option><option value="school-linked">School-linked demo</option>
          </select>
        </label>
        {scenario==='school-linked' && <>
          <label style={labelStyle}>Teacher
            <select style={selectStyle} value={teacher} onChange={event=>setTeacher(event.target.value)}>
              {['Demo Teacher 01','Demo Teacher 02','Demo Teacher 03'].map(value=><option key={value}>{value}</option>)}
            </select>
          </label>
          <label style={labelStyle}>Class
            <select style={selectStyle} value={className} onChange={event=>setClassName(event.target.value)}>
              {['Demo Class A','Demo Class B','Demo Class C'].map(value=><option key={value}>{value}</option>)}
            </select>
          </label>
        </>}
      </div>
    </section>
    <nav aria-label="Universal learner QA actions" style={{display:'grid',gap:8}}>
      <Link style={actionStyle} href={learnLink}>Published lessons <span aria-hidden="true">→</span></Link>
      <Link style={actionStyle} href="/student/vibelearn/exams">My real assigned exams <span aria-hidden="true">→</span></Link>
      <Link style={actionStyle} href="/student">Learner home <span aria-hidden="true">→</span></Link>
    </nav>
    <div role="note" style={{fontSize:11,color:'var(--vs-muted)',lineHeight:1.5}}>
      Test selections change this preview only. Other learners' records, real teacher rosters,
      school membership and exam permissions remain protected. Cross-level graded practice is
      not activated until QA results are isolated.
    </div>
  </main>
}
