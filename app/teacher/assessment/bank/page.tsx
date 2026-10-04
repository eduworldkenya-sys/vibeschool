'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

type BankQuestion = {
  id: string
  question_text: string
  question_type: string
  difficulty: string | null
  competency_tag: string | null
  status: string
  created_at: string
}

export default function TeacherQuestionBankPage() {
  const router = useRouter()
  const [questions, setQuestions] = useState<BankQuestion[]>([])
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  async function load() {
    setLoading(true)
    setError('')
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setError('Sign in to open the Question Bank.'); setLoading(false); return }
    const { data, error: bankError } = await supabase
      .from('assessment_questions')
      .select('id,question_text,question_type,difficulty,competency_tag,status,created_at')
      .order('created_at', { ascending: false })
      .limit(300)
    if (bankError) setError('Question Bank could not be loaded. Please try again.')
    else setQuestions((data ?? []) as BankQuestion[])
    setLoading(false)
  }

  useEffect(() => { void load() }, [])

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase()
    if (!needle) return questions
    return questions.filter(item =>
      [item.question_text, item.question_type, item.difficulty ?? '', item.competency_tag ?? '']
        .some(value => value.toLowerCase().includes(needle))
    )
  }, [questions, query])

  return <main style={page}><div style={{ maxWidth: 860, margin: '0 auto' }}>
    <button type="button" onClick={() => router.push('/teacher/assessment')} style={secondary}>← Assess learners</button>
    <section style={card}>
      <div style={eyebrow}>Reusable assessment material</div>
      <h1 style={{ margin: '6px 0' }}>Question Bank</h1>
      <p style={muted}>Find questions that can be reused in exercises, quizzes, CATs and exams. Draft or unapproved material remains governed by the existing review rules.</p>
      <input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search questions, type or competency" style={input} />
    </section>

    {error && <div style={errorBox}>{error}<button type="button" onClick={() => void load()} style={{ ...secondary, marginLeft: 10 }}>Retry</button></div>}
    {loading ? <section style={card}>Loading Question Bank…</section> :
      <section style={card}>
        <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 10 }}>{visible.length} question{visible.length === 1 ? '' : 's'} available</div>
        {visible.length === 0 ? <div style={empty}>No matching questions are available yet.</div> :
          <div style={{ display: 'grid', gap: 9 }}>{visible.map(item =>
            <article key={item.id} style={row}>
              <div style={{ fontSize: 13, fontWeight: 750, lineHeight: 1.5 }}>{item.question_text}</div>
              <div style={{ marginTop: 6, fontSize: 11, color: '#6b7280' }}>
                {friendlyType(item.question_type)}{item.difficulty ? ` · ${friendly(item.difficulty)}` : ''}{item.competency_tag ? ` · ${item.competency_tag}` : ''}
              </div>
            </article>
          )}</div>}
      </section>}
    <section style={{ ...card, background: '#f8fafc' }}>
      <strong style={{ fontSize: 13 }}>How the bank works</strong>
      <p style={{ ...muted, marginTop: 6 }}>The bank is the reusable library. Exercise, Quiz, CAT and Exam are the jobs teachers create from that library. Building or assigning an assessment continues through the existing assessment Builder so question lineage and review are preserved.</p>
    </section>
  </div></main>
}

function friendly(value: string) { return value ? value.charAt(0).toUpperCase() + value.slice(1) : '—' }
function friendlyType(value: string) {
  const labels: Record<string,string> = { oral: 'Oral question', written: 'Written question', cat: 'CAT question', practical: 'Practical question' }
  return labels[value] ?? friendly(value.replace(/_/g, ' '))
}

const page: React.CSSProperties = { minHeight: '100vh', background: '#f8fafc', padding: '18px 14px 80px', fontFamily: "'Plus Jakarta Sans', sans-serif", color: '#111827' }
const card: React.CSSProperties = { background: '#fff', border: '1px solid #e5e7eb', borderRadius: 16, padding: 16, marginTop: 12 }
const row: React.CSSProperties = { padding: 12, border: '1px solid #e5e7eb', borderRadius: 12, background: '#fff' }
const input: React.CSSProperties = { width: '100%', boxSizing: 'border-box', marginTop: 14, padding: '11px 12px', border: '1px solid #d1d5db', borderRadius: 10, font: 'inherit' }
const secondary: React.CSSProperties = { border: '1px solid #d1d5db', background: '#fff', color: '#374151', borderRadius: 10, padding: '8px 11px', fontWeight: 750, cursor: 'pointer' }
const eyebrow: React.CSSProperties = { fontSize: 10, fontWeight: 900, letterSpacing: '.1em', textTransform: 'uppercase', color: '#047857' }
const muted: React.CSSProperties = { margin: 0, color: '#6b7280', lineHeight: 1.55, fontSize: 12 }
const empty: React.CSSProperties = { padding: 24, textAlign: 'center', color: '#6b7280', border: '1px dashed #d1d5db', borderRadius: 12 }
const errorBox: React.CSSProperties = { marginTop: 12, padding: 12, border: '1px solid #fecaca', background: '#fef2f2', borderRadius: 12, color: '#991b1b', fontSize: 12 }
