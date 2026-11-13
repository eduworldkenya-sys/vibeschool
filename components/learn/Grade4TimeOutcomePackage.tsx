'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import UniversalLearnReader from '@/components/learn/UniversalLearnReader'
import { parseGrade4TimeLessonSections } from '@/lib/content/grade4TimeSections.mjs'
import Grade4TimeVisualModels from '@/components/learn/Grade4TimeVisualModels'
import Grade4TimeLearningAid from '@/components/learn/Grade4TimeLearningAid'
import Grade4TimeWorkedSteps from '@/components/learn/Grade4TimeWorkedSteps'
import { formatGrade4TimeLessonBody } from '@/lib/content/grade4TimePresentation.mjs'
import LearningNotebookPrompt from '@/components/learn/LearningNotebookPrompt'

type Outcome = {
  outcome_id: string
  outcome_code: string
  outcome_text: string
  source_locator: string
  lesson_count: number
}
type Lesson = {
  outcome_id: string
  outcome_code: string
  outcome_text: string
  source_locator: string
  resource_id: string
  resource_version_id: string
  lesson_order: number
  title: string
  body: string
}
type Item = {
  outcome_id: string
  resource_version_id: string
  lesson_order: number
  question_id: string
  question_kind: 'guided' | 'exercise' | 'formative_check'
  prompt: string
  answer: string
  explanation: string
}
type Guide = { id: string; title: string; guidance: Record<string, unknown> }

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const PANEL = { border: '1px solid #d7e5db', background: '#fff', borderRadius: 14, padding: 16 } as const
const LINK = { display: 'inline-block', border: '1px solid #b4d5c2', borderRadius: 10, padding: '9px 12px', color: '#155e46', textDecoration: 'none', fontWeight: 700 as const }
const safeString = (v: unknown): string => {
  if (typeof v === 'string' || typeof v === 'number') return String(v)
  if (Array.isArray(v)) return v.map(safeString).filter(Boolean).join('\n')
  if (v && typeof v === 'object') {
    return Object.entries(v).map(([key, value]) => {
      const text = safeString(value)
      return text ? `${key.replaceAll('_', ' ')}: ${text}` : ''
    }).filter(Boolean).join('\n')
  }
  return ''
}

/**
 * Published version is the single source for learner/teacher reading.
 * Lesson notes and guide can be prepared without a timetable or a class link.
 * Practice is a revealed self-check, never an assessment attempt or mastery record.
 */
export default function Grade4TimeOutcomePackage({
  initialOutcomeId = null,
  audience = 'learner',
}: {
  initialOutcomeId?: string | null
  audience?: 'learner' | 'teacher'
}) {
  const [catalogue, setCatalogue] = useState<Outcome[]>([])
  const [outcomeId] = useState(initialOutcomeId ?? '')
  const [lessons, setLessons] = useState<Lesson[]>([])
  const [items, setItems] = useState<Item[]>([])
  const [guides, setGuides] = useState<Guide[]>([])
  const [selectedLesson, setSelectedLesson] = useState<number | null>(null)
  const [revealed, setRevealed] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [tab, setTab] = useState<'core' | 'guide' | 'exercise'>('core')

  useEffect(() => {
    let active = true
    void (async () => {
      const { data, error: catalogueError } = await supabase.rpc('vs_published_grade4_time_outcomes')
      if (!active) return
      if (catalogueError || !Array.isArray(data)) {
        setError('Published outcome catalogue is unavailable.')
        setLoading(false)
        return
      }
      const clean = (data as Outcome[]).filter(row =>
        UUID.test(row.outcome_id) && typeof row.outcome_text === 'string'
        && Number(row.lesson_count) > 0)
      setCatalogue(clean)
      if (!initialOutcomeId) setLoading(false)
    })()
    return () => { active = false }
  }, [])

  useEffect(() => {
    let active = true
    setLessons([])
    setItems([])
    setGuides([])
    setSelectedLesson(null)
    setRevealed([])
    setError('')
    if (!outcomeId) return () => { active = false }
    if (!UUID.test(outcomeId)) {
      setError('The outcome link is invalid.')
      setLoading(false)
      return () => { active = false }
    }
    setLoading(true)
    void (async () => {
      try {
        // Both RPCs derive from the same certified-only canonical reader.
        const [content, practice] = await Promise.all([
          supabase.rpc('vs_published_grade4_time_outcome', { p_outcome_id: outcomeId }),
          supabase.rpc('vs_published_grade4_time_practice', { p_outcome_id: outcomeId }),
        ])
        if (content.error) throw content.error
        if (practice.error) throw practice.error
        if (!Array.isArray(content.data) || !Array.isArray(practice.data)) {
          throw new Error('The canonical delivery response was not readable.')
        }
        const checked = (content.data as Lesson[]).filter(row =>
          row.outcome_id === outcomeId && UUID.test(row.resource_version_id)
          && UUID.test(row.resource_id) && typeof row.body === 'string'
          && row.body.trim().length > 0 && Number.isInteger(row.lesson_order))
        if (checked.length !== content.data.length) {
          throw new Error('An invalid released lesson was returned.')
        }
        const checkedItems = (practice.data as Item[]).filter(row =>
          row.outcome_id === outcomeId && UUID.test(row.resource_version_id)
          && ['guided', 'exercise', 'formative_check'].includes(row.question_kind)
          && row.question_id && row.prompt && row.answer && row.explanation)
        if (checkedItems.length !== practice.data.length) {
          throw new Error('An invalid formative item was returned.')
        }
        if (!active) return
        setLessons(checked)
        setItems(checkedItems)

        if (audience === 'teacher' && checked.length > 0) {
          // Existing authenticated SELECT and RLS: never expose guidance via
          // the anonymous learner RPC or insert teacher-only drafts as published.
          const auth = await supabase.auth.getUser()
          if (!active || !auth.data.user) return
          const versions = await supabase.from('learning_resource_versions')
            .select('id,payload,lifecycle_status')
            .in('id', checked.map(row => row.resource_version_id))
            .eq('lifecycle_status', 'certified')
          if (!active || versions.error) return
          const allowed = new Map(checked.map(row => [row.resource_version_id, row.title]))
          const guideRows: Guide[] = []
          for (const v of versions.data ?? []) {
            if (!allowed.has(v.id)) continue
            const payload = v.payload && typeof v.payload === 'object' && !Array.isArray(v.payload)
              ? v.payload as Record<string, unknown> : {}
            const raw = payload.teacher_guidance
            if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
              guideRows.push({ id: v.id, title: allowed.get(v.id) ?? 'Lesson', guidance: raw as Record<string, unknown> })
            }
          }
          setGuides(guideRows)
        }
      } catch (reason) {
        if (active) setError(reason instanceof Error ? reason.message : 'Published outcome could not load.')
      } finally {
        if (active) setLoading(false)
      }
    })()
    return () => { active = false }
  }, [outcomeId, audience])

  const selected = useMemo(() =>
    lessons.find(row => row.lesson_order === selectedLesson) ?? lessons[0] ?? null,
    [lessons, selectedLesson])
  const parsedSelected = useMemo(() => selected
    ? parseGrade4TimeLessonSections(formatGrade4TimeLessonBody(selected.body)) : null, [selected])
  const selectedIndex = selected ? lessons.findIndex(row => row.resource_version_id === selected.resource_version_id) : -1
  const selectedItems = useMemo(() => items.filter(row =>
    !selected || row.resource_version_id === selected.resource_version_id), [items, selected])
  const outcome = lessons[0] ?? catalogue.find(row => row.outcome_id === outcomeId) ?? null
  const hrefFor = (id: string) => audience === 'teacher'
    ? `/teacher/outcome-package?outcomeId=${encodeURIComponent(id)}`
    : `/learn/grade-4/mathematics/time/outcome/${encodeURIComponent(id)}`

  return <main style={{ maxWidth: 960, margin: '0 auto', padding: '18px 14px 80px', background: '#f5f9f6', minHeight: '100vh', color: '#193e2d' }}>
    <p style={{ color: '#176147', fontSize: 12, fontWeight: 800 }}>VIBESCHOOL ORIGINALS · GRADE 4 MATHEMATICS · TIME</p>
    <h1 style={{ margin: '4px 0 10px', fontSize: 28 }}>{audience === 'teacher' ? 'Time teaching materials' : 'Learn about time'}</h1>
    <p style={{ fontSize: 14, color: '#486554', lineHeight: 1.7 }}>
      Learn and practise time using the lessons and activities below.
      {audience === 'teacher'
        ? ' Choose a learning goal before preparing notes, guidance or exercises. No timetable is needed.'
        : ' Choose what you want to learn. No class code or teacher assignment is needed.'}
    </p>

    <section style={{ ...PANEL, marginTop: 18 }}>
      <h2 style={{ marginTop: 0, fontSize: 18 }}>What you will learn</h2>
      {catalogue.length === 0 && !error ? <p role="status">Loading published outcomes…</p> : null}
      <div style={{ display: 'grid', gap: 9 }}>
        {catalogue.map(row => <Link key={row.outcome_id} href={hrefFor(row.outcome_id)}
          aria-current={row.outcome_id === outcomeId ? 'page' : undefined}
          style={{ ...LINK, background: row.outcome_id === outcomeId ? '#dff0e5' : '#fff' }}>
          {row.outcome_text} <span style={{ display: 'block', fontSize: 12, fontWeight: 400, marginTop: 3 }}>
            {row.lesson_count} published lesson{Number(row.lesson_count) === 1 ? '' : 's'}
          </span>
        </Link>)}
      </div>
    </section>

    {loading && <p role="status">Loading the published outcome package…</p>}
    {!loading && error && <p role="alert" style={{ color: '#991b1b' }}>{error}</p>}
    {!loading && outcomeId && !error && lessons.length === 0 &&
      <p role="status">No eligible certified package is currently available for this outcome.</p>}
    {lessons.length > 0 && !error && <section style={{ marginTop: 18 }}>
      <div style={PANEL}>
        <h2 style={{ margin: '0 0 8px', fontSize: 19 }}>{outcome?.outcome_text}</h2>
        <p style={{ color: '#61766b', fontSize: 12, margin: 0 }}>Grade 4 Mathematics · Time</p>
      </div>
      <nav aria-label="Outcome package tools" style={{ display: 'flex', flexWrap: 'wrap', gap: 9, margin: '12px 0' }}>
        {(['core', 'guide', 'exercise'] as const).map(key => <button key={key} type="button"
          aria-pressed={tab === key} onClick={() => setTab(key)}
          style={{ border: '1px solid #acd0b7', borderRadius: 10, minHeight: 44, padding: '10px 16px', fontWeight: 700,
            background: tab === key ? '#175b43' : '#fff', color: tab === key ? '#fff' : '#175b43' }}>
          {key === 'core' ? (audience === 'teacher' ? 'Lesson Notes' : 'Core learning') : key === 'guide' ? (audience === 'teacher' ? 'Teacher Guide' : 'Learning support') : 'Exercises'}
        </button>)}
      </nav>
      <div role="group" aria-label="Choose an associated lesson" style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
        {lessons.map(row => <button type="button" key={row.resource_version_id}
          aria-pressed={selected?.resource_version_id === row.resource_version_id}
          onClick={() => { setSelectedLesson(row.lesson_order); setRevealed([]) }}
          style={{ border: '1px solid #a9c8b3', borderRadius: 9, minHeight: 44, padding: '8px 12px',
            background: selected?.resource_version_id === row.resource_version_id ? '#e3f2e8' : '#fff', color: '#244a36' }}>
          Lesson {row.lesson_order}
        </button>)}
      </div>

      {selected && tab === 'core' && <article style={PANEL}>
        <UniversalLearnReader
          key={selected.resource_version_id}
          subject="Mathematics"
          sections={parsedSelected?.sections ?? []}
          title={parsedSelected?.title || selected.title}
          goal={parsedSelected?.goal}
          anchorPrefix="outcome-time"
          renderBody={(section) => section.id === 'example'
            ? <Grade4TimeWorkedSteps body={section.body} />
            : undefined}
          afterSection={(section) => <Grade4TimeLearningAid lessonNumber={selected.lesson_order} sectionId={section.id} />}
        />
        <Grade4TimeVisualModels lessonOrder={selected.lesson_order} inlineVisualPresent={/\[visual:/.test(selected.body)} />
        <LearningNotebookPrompt subject="Mathematics" stage="learn" compact />
        <nav aria-label="Move between outcome lessons"
          style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', marginTop: 14 }}>
          {selectedIndex > 0 ? <button type="button" style={LINK}
            onClick={() => { setSelectedLesson(lessons[selectedIndex - 1].lesson_order); setRevealed([]) }}>
            Previous lesson
          </button> : <span />}
          {selectedIndex >= 0 && selectedIndex < lessons.length - 1 && <button type="button" style={LINK}
            onClick={() => { setSelectedLesson(lessons[selectedIndex + 1].lesson_order); setRevealed([]) }}>
            Next lesson
          </button>}
        </nav>
        {audience === 'teacher' && <p style={{ fontSize: 12, color: '#64748b' }}>
          This is the released core explanation. Teaching preparation can be drafted separately without scheduling an occurrence.
        </p>}
      </article>}

      {tab === 'guide' && <section style={PANEL}>
        <h3 style={{ marginTop: 0 }}>{audience === 'teacher' ? 'Certified teacher guidance' : 'How to strengthen understanding'}</h3>
        <LearningNotebookPrompt subject="Mathematics" stage={audience === 'teacher' ? 'teacher' : 'learn'} compact />
        {audience === 'learner'
          ? <p>Read the explanation first, try the guided questions, then attempt the exercises. Review each checked answer after trying.</p>
          : guides.filter(row => row.id === selected?.resource_version_id).length === 0
            ? <p role="status">No teacher guidance was accessible from the certified version. Use the linked Scheme and your saved Lesson Plan; no guidance is invented.</p>
            : guides.filter(row => row.id === selected?.resource_version_id).map(guide =>
              <div key={guide.id}>{Object.entries(guide.guidance).map(([key, value]) =>
                <div key={key} style={{ marginBottom: 14 }}>
                  <h4 style={{ marginBottom: 5 }}>{key.replaceAll('_', ' ')}</h4>
                  <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.7, fontSize: 14 }}>{safeString(value) || 'See the certified source for details.'}</div>
                </div>)}</div>)}
      </section>}

      {tab === 'exercise' && <section style={PANEL}>
        <h3 style={{ marginTop: 0 }}>Guided, independent and formative self-check</h3>
        <p style={{ fontSize: 13, color: '#566e60' }}>Attempt each question before revealing the checked answer. These are published learning questions, not protected exam items. Revealing an answer does not record completion, marks or mastery.</p>
        <LearningNotebookPrompt subject="Mathematics" stage="practice" />
        {selectedItems.length === 0 ? <p role="status">No released formative questions are eligible for this lesson.</p>
          : <div style={{ display: 'grid', gap: 12 }}>{selectedItems.map((q, index) => {
            const show = revealed.includes(q.question_id)
            return <article key={q.question_id} style={{ borderTop: '1px solid #dae7dd', paddingTop: 13 }}>
              <p style={{ fontSize: 12, fontWeight: 700, color: '#526e5c' }}>{q.question_kind.replaceAll('_', ' ')} · {index + 1} of {selectedItems.length}</p>
              <p style={{ fontWeight: 700, fontSize: 16 }}>{q.prompt}</p>
              <button type="button" onClick={() => setRevealed(current =>
                show ? current.filter(x => x !== q.question_id) : [...current, q.question_id])}
                aria-expanded={show}
                style={{ border: '1px solid #a5c8ae', borderRadius: 9, padding: '10px 12px', minHeight: 44, background: '#eff8f2', color: '#175b43', fontWeight: 700 }}>
                {show ? 'Hide checked answer' : 'Reveal checked answer'}
              </button>
              {show && <div style={{ marginTop: 10, padding: 12, background: '#eef6ef', borderRadius: 8 }}>
                <strong>Answer: {q.answer}</strong>
                <p style={{ marginBottom: 0 }}>{q.explanation}</p>
              </div>}
            </article>
          })}</div>}
      </section>}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 14 }}>
        <Link style={LINK} href="/learn/grade-4/mathematics/time">Open full Time reader</Link>
        {audience === 'teacher' && <>
          <Link style={LINK} href="/teacher/curriculum?unitId=2.6">Curriculum Map</Link>
          <Link style={LINK} href="/teacher/scheme?unitId=2.6">Scheme of Work</Link>
          <Link style={LINK} href="/teacher/lesson-notes">Lesson Notes</Link>
          <Link style={LINK} href="/teacher/teacher-guide">Teacher Guide</Link>
        </>}
      </div>
    </section>}
  </main>
}
