'use client'

import { useRouter } from 'next/navigation'
import { BookOpen, ArrowRight, GraduationCap } from 'lucide-react'
import { useStudent } from '@/lib/student-context'

/** Independent learners share Student OS navigation without claiming school-owned evidence. */
export default function IndependentLearnHome() {
  const router = useRouter()
  const { identity } = useStudent()
  return <section style={{ maxWidth: 880, margin: '0 auto', padding: '10px 0 30px', color: '#17213b' }}>
    <div style={{ marginBottom: 18 }}>
      <p style={{ color: '#5145e8', fontSize: 12, fontWeight: 800, margin: '0 0 6px' }}>VIBESCHOOL LEARN</p>
      <h1 style={{ fontSize: 28, margin: '0 0 6px' }}>Learn</h1>
      <p style={{ fontSize: 14, color: '#64748b', margin: 0 }}>{identity?.className || 'Your level'} · Explore published learning materials.</p>
    </div>
    <button type="button" onClick={() => router.push('/student/vibelearn/reading')}
      style={{ width: '100%', padding: 20, display: 'flex', alignItems: 'center', gap: 14,
        textAlign: 'left', border: '1px solid #e1e5ef', borderRadius: 16, background: '#fff',
        color: '#17213b', cursor: 'pointer', fontFamily: 'inherit', minHeight: 100 }}>
      <span style={{ background: '#eeedff', padding: 12, display: 'grid', placeItems: 'center', borderRadius: 12 }}>
        <BookOpen size={25} color="#5145e8" aria-hidden="true" />
      </span>
      <span style={{ display: 'grid', gap: 5, flex: 1, minWidth: 0 }}>
        <strong style={{ fontSize: 17 }}>Reading library</strong>
        <span style={{ fontSize: 13, color: '#64748b', lineHeight: 1.5 }}>Find published textbooks by grade and subject.</span>
      </span>
      <ArrowRight size={19} color="#5145e8" aria-hidden="true" />
    </button>
    <div style={{ marginTop: 18, padding: 16, borderRadius: 14, background: '#fff',
      border: '1px solid #e1e5ef', display: 'flex', gap: 12, alignItems: 'flex-start' }}>
      <GraduationCap size={22} color="#5145e8" aria-hidden="true" />
      <div>
        <h2 style={{ fontSize: 15, margin: '0 0 6px' }}>Your learning activities</h2>
        <p style={{ fontSize: 13, color: '#64748b', margin: 0, lineHeight: 1.6 }}>
          Only published, accessible learning material appears here. School-assigned exams, timetable and class results remain tied to a verified enrollment.
        </p>
      </div>
    </div>
  </section>
}
