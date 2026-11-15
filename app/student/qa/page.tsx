'use client'

import { useEffect, useState, type CSSProperties } from 'react'
import Link from 'next/link'
import { useStudent } from '@/lib/student-context'

const SCHOOL_GRADES = Array.from({ length: 12 }, (_, i) => `Grade ${i + 1}`)
const FORM_GRADES = ['Form 1', 'Form 2', 'Form 3', 'Form 4']
const GRADES = [...SCHOOL_GRADES, ...FORM_GRADES]
const storageKey = (studentId: string) => `vibeschool:qa-grade:${studentId}`

/** Owner-granted preview of public grade resources and learner-owned practice only.
 * No simulated school/teacher enrollment and no private assignment bypass. */
export default function UniversalQaLearnerPage() {
  const { identity, loading, error } = useStudent()
  const [grade, setGrade] = useState('Grade 4')
  useEffect(() => {
    if (!identity?.universalTest) return
    try {
      const saved = window.localStorage.getItem(storageKey(identity.studentId))
      if (saved && GRADES.includes(saved)) setGrade(saved)
    } catch { /* Optional device preference is not authority. */ }
  }, [identity?.studentId, identity?.universalTest])
  function choose(next: string) {
    if (!GRADES.includes(next)) return
    setGrade(next)
    if (!identity) return
    try { window.localStorage.setItem(storageKey(identity.studentId), next) } catch { /* Still usable. */ }
  }

  if (loading) return <main role="status">Opening learner test mode…</main>
  if (!identity?.universalTest) return <main role="alert" style={{padding:16}}>{error || 'This account does not have Universal QA access.'}</main>

  const learnUrl = `/learn?grade=${encodeURIComponent(grade)}`
  const practiceUrl = `/student/vibelearn/topic-practice?grade=${encodeURIComponent(grade)}`
  const action: CSSProperties = {
    display:'flex',alignItems:'center',justifyContent:'space-between',gap:12,
    minHeight:58,padding:'14px 16px',borderRadius:13,textDecoration:'none',
    background:'var(--vs-card)',color:'var(--vs-text)',border:'1px solid var(--vs-border)',fontWeight:750,
  }

  return <main style={{maxWidth:720,margin:'0 auto',display:'grid',gap:14}}>
    <header style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:10}}>
      <div><div style={{fontSize:11,fontWeight:800,color:'var(--vs-muted)'}}>VIBESCHOOL QA</div>
        <h1 style={{fontSize:23,margin:'4px 0'}}>All levels</h1></div>
      <span style={{fontSize:11,fontWeight:800,padding:'7px 10px',borderRadius:9,background:'var(--vs-accent-soft)',color:'var(--vs-accent)'}}>TEST ONLY</span>
    </header>
    <label style={{display:'grid',gap:7,fontSize:12,fontWeight:800}} htmlFor="qa-grade">
      Choose learning level
      <select id="qa-grade" value={grade} onChange={event=>choose(event.target.value)}
        style={{minHeight:50,padding:'10px 12px',borderRadius:12,border:'1px solid var(--vs-border)',background:'var(--vs-card)',color:'var(--vs-text)',fontSize:15,fontWeight:700}}>
        {GRADES.map(item=><option key={item} value={item}>{item}</option>)}
      </select>
    </label>
    <nav aria-label={`Explore ${grade}`} style={{display:'grid',gap:10}}>
      <Link href={learnUrl} style={action}>Lessons and subjects <span aria-hidden="true">→</span></Link>
      <Link href={practiceUrl} style={action}>Topic practice <span aria-hidden="true">→</span></Link>
      <Link href="/student/vibelearn/exams" style={action}>My assigned exams <span aria-hidden="true">→</span></Link>
      <Link href="/student" style={action}>My learner home <span aria-hidden="true">→</span></Link>
      <Link href="/student/college" style={action}>CPA / college <span aria-hidden="true">→</span></Link>
    </nav>
    <p style={{fontSize:12,color:'var(--vs-muted)',lineHeight:1.5}}>
      This selector changes the grade used to browse published learning content and eligible practice.
      It does not change your actual school, class, teacher, exam assignments or learner records.
      Unreleased material and private teacher records remain restricted.
    </p>
  </main>
}
