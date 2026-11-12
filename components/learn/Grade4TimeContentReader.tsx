'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { VisualRichText } from '@/components/learn/VisualLearningAsset'
import LearningNotebookPrompt from '@/components/learn/LearningNotebookPrompt'

type Lesson = {
  id: string
  title: string
  unitId: string
  body: string
  order: number
}

const INK = '#163c2b'
const GREEN = '#175b43'
const BORDER = '#d8e5db'
const SECTION = { border: `1px solid ${BORDER}`, background: '#fff', borderRadius: 14, padding: 18 } as const

/** A shared certified-Content-Engine reader for both independent and school-linked learners. */
export default function Grade4TimeContentReader() {
  const [lessons, setLessons] = useState<Lesson[]>([])
  const [selected, setSelected] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [outcomes, setOutcomes] = useState<Array<{ outcome_id: string; outcome_text: string; lesson_count: number }>>([])

  useEffect(() => {
    let active = true
    const load = async () => {
      try {
        const { data, error } = await supabase.rpc('vs_public_grade4_math_time_learner_lessons')
        if (error) throw error
        const clean: Lesson[] = []
        for (const item of Array.isArray(data) ? data : []) {
          if (!item || typeof item !== 'object') continue
          const row = item as Record<string, unknown>
          if (typeof row.resource_version_id !== 'string'
            || typeof row.title !== 'string'
            || row.unit_id !== '2.6'
            || typeof row.body !== 'string'
            || !row.body.trim()
            || typeof row.lesson_order !== 'number'
            || row.lesson_order < 1 || row.lesson_order > 10) continue
          clean.push({
            id: row.resource_version_id,
            title: row.title,
            unitId: row.unit_id,
            body: row.body,
            order: row.lesson_order,
          })
        }
        // An incompatible RPC response must never look like unpublished content.
        // Failing closed also avoids silently hiding a malformed certified lesson.
        if (!Array.isArray(data) || clean.length !== data.length) {
          if (active) setLoadError(true)
          return
        }
        if (active) setLessons(clean.sort((a,b) => a.order - b.order))
      } catch {
        if (active) setLoadError(true)
      } finally {
        if (active) setLoading(false)
      }
    }
    void load()
    return () => { active = false }
  }, [])

  useEffect(() => {
    let alive = true
    void (async () => {
      const response = await supabase.rpc('vs_published_grade4_time_outcomes')
      if (alive && !response.error && Array.isArray(response.data)) {
        setOutcomes(response.data.filter((row: { outcome_id?: string; outcome_text?: string }) =>
          typeof row.outcome_id === 'string' && typeof row.outcome_text === 'string'))
      }
    })()
    return () => { alive = false }
  }, [])

  const current = useMemo(() => lessons.find(l => l.id === selected) ?? lessons[0] ?? null, [lessons, selected])
  const currentIndex = current ? lessons.findIndex(l => l.id === current.id) : -1

  return (
    <main style={{ maxWidth: 930, margin: '0 auto', padding: 'clamp(14px, 3vw, 28px)', paddingBottom: 110, minHeight: '100vh', color: INK, background: '#f5f9f6' }}>
      <header style={{ marginBottom: 24 }}>
        <p style={{ fontSize: 12, fontWeight: 800, letterSpacing: '.06em', color: GREEN }}>VIBESCHOOL ORIGINALS · GRADE 4 MATHEMATICS</p>
        <h1 style={{ fontSize: 'clamp(26px,4vw,38px)', margin: '4px 0 10px' }}>Time</h1>
        <p style={{ lineHeight: 1.7, color: '#476457', margin: 0 }}>
          Learn to read clocks, understand a.m. and p.m., convert units of time and solve problems about how long activities take.
        </p>
      </header>

      <section aria-label="Time lessons" style={SECTION}>
        <h2 style={{ fontSize: 21, margin: '0 0 10px' }}>Choose a lesson</h2>
        {loading ? (
          <p role="status">Loading published lessons…</p>
        ) : loadError ? (
          <p role="alert">The lesson library could not load. Please reopen this page.</p>
        ) : lessons.length === 0 ? (
          <p role="status">No certified Time lessons are available in the library right now.</p>
        ) : (
          <>
            <div role="group" aria-label="Select a Time lesson" style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 18 }}>
              {lessons.map(l => (
                <button key={l.id} type="button" aria-pressed={current?.id === l.id} onClick={() => setSelected(l.id)}
                  style={{ border: `1px solid ${GREEN}`, borderRadius: 10, background: current?.id === l.id ? GREEN : '#fff', color: current?.id === l.id ? '#fff' : GREEN, padding: '10px 13px', minHeight: 44, cursor: 'pointer', fontWeight: 700 }}>
                  Lesson {l.order}
                </button>
              ))}
            </div>
            {current && <article aria-live="polite">
              <h3 style={{ fontSize: 20, margin: '0 0 12px' }}>{current.title}</h3>
              <VisualRichText body={current.body} style={{ fontSize: 16, lineHeight: 1.8 }} />
              <LearningNotebookPrompt subject="Mathematics" stage="learn" compact />
              {currentIndex + 1 < lessons.length && (
                <button type="button" onClick={() => setSelected(lessons[currentIndex+1].id)}
                  style={{ marginTop: 20, border: 0, borderRadius: 10, background: GREEN, color: '#fff', padding: '11px 18px', minHeight: 46, cursor: 'pointer', fontWeight: 800 }}>Next lesson</button>
              )}
            </article>}
          </>
        )}
      </section>
      {outcomes.length > 0 && <section aria-label="Time learning outcomes" style={{ ...SECTION, marginTop: 14 }}>
        <h2 style={{ fontSize: 20, marginTop: 0 }}>Learn and practise by outcome</h2>
        <p style={{ fontSize: 13, color: '#476457' }}>Choose exactly what you want to learn. Available to independent and school-linked learners.</p>
        <div style={{ display: 'grid', gap: 8 }}>
          {outcomes.map(item => <Link key={item.outcome_id}
            href={`/learn/grade-4/mathematics/time/outcome/${encodeURIComponent(item.outcome_id)}`}
            style={{ display: 'block', color: GREEN, border: `1px solid ${BORDER}`, borderRadius: 10, padding: 12, textDecoration: 'none', fontWeight: 700 }}>
            {item.outcome_text}
            <span style={{ display: 'block', fontWeight: 400, color: '#66786d', fontSize: 12, marginTop: 3 }}>{item.lesson_count} released lessons · guided and formative self-check</span>
          </Link>)}
        </div>
      </section>}
      <p style={{ fontSize: 12, color: '#66786d', lineHeight: 1.6, marginTop: 14 }}>
        VibeSchool-original content aligned to the KICD Grade 4 Mathematics Time learning scope.
        Only certified learning-resource versions appear in this reader.
      </p>
    </main>
  )
}
