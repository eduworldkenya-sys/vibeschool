'use client'

import Link from 'next/link'
import { ArrowRight, ChevronLeft, ChevronRight, Clock3 } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import UniversalLearnReader from '@/components/learn/UniversalLearnReader'
import { adaptCanonicalLearnSections } from '@/lib/learn/learningBlockContract'
import { buildLearningToolContext, getLearningToolSectionBinding } from '@/lib/learn/teachingToolContentBridge.mjs'
import { parseGrade4TimeLessonSections } from '@/lib/content/grade4TimeSections.mjs'
import Grade4TimeLearningAid from '@/components/learn/Grade4TimeLearningAid'
import Grade4TimeWorkedSteps from '@/components/learn/Grade4TimeWorkedSteps'
import Grade4TimePracticeCards from '@/components/learn/Grade4TimePracticeCards'
import { buildTimeQuestionCards } from '@/lib/content/grade4TimePractice.mjs'
import readerStyles from './Grade4TimeContentReader.module.css'
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
  const [catalogueLoading, setCatalogueLoading] = useState(true)
  const [catalogueError, setCatalogueError] = useState(false)
  const [outcomeId] = useState(initialOutcomeId ?? '')
  const [lessons, setLessons] = useState<Lesson[]>([])
  const [items, setItems] = useState<Item[]>([])
  const [guides, setGuides] = useState<Guide[]>([])
  const [selectedLesson, setSelectedLesson] = useState<number | null>(null)
  const [chooserOpen, setChooserOpen] = useState(false)
  const [revealed, setRevealed] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [tab, setTab] = useState<'core' | 'guide' | 'exercise'>('core')
  const pendingFocus = useRef(false)

  useEffect(() => {
    let active = true
    void (async () => {
      const { data, error: catalogueError } = await supabase.rpc('vs_published_grade4_time_outcomes')
      if (!active) return
      if (catalogueError || !Array.isArray(data)) {
        setCatalogueError(true)
        setCatalogueLoading(false)
        return
      }
      const clean = (data as Outcome[]).filter(row =>
        UUID.test(row.outcome_id) && typeof row.outcome_text === 'string'
        && Number(row.lesson_count) > 0)
      setCatalogue(clean)
      setCatalogueLoading(false)
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
    if (!outcomeId) { setLoading(false); return () => { active = false } }
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
        const ordered = [...checked].sort((a, b) => a.lesson_order - b.lesson_order)
        setLessons(ordered)
        const requestedParam = new URLSearchParams(window.location.search).get('lesson')
        const requestedOrder = requestedParam && /^\d+$/.test(requestedParam) ? Number(requestedParam) : null
        setSelectedLesson(ordered.some(row => row.lesson_order === requestedOrder) ? requestedOrder : null)
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
  const toolContext = useMemo(() => selected ? buildLearningToolContext({
    sourceKind: 'published_outcome', audience,
    subject: 'Mathematics', grade: 'Grade 4',
    resourceId: selected.resource_id, resourceVersionId: selected.resource_version_id,
    outcomeId: selected.outcome_id, sections: parsedSelected?.sections ?? [],
  }) : null, [selected, parsedSelected, audience])
  const selectedIndex = selected ? lessons.findIndex(row => row.resource_version_id === selected.resource_version_id) : -1
  const selectedItems = useMemo(() => items.filter(row =>
    !selected || row.resource_version_id === selected.resource_version_id), [items, selected])
  const outcome = lessons[0] ?? catalogue.find(row => row.outcome_id === outcomeId) ?? null
  // Both entry points share the same section reader and interactive question cards.
  // Practice content remains bound to the selected certified resource version.
  const questionCards = useMemo(() => {
    const empty = { exercise: [], check: [] } as {
      exercise: { id: string; kind: string; prompt: string; answer: string; why: string }[]
      check: { id: string; kind: string; prompt: string; answer: string; why: string }[]
    }
    if (!selected) return empty
    const manuscriptCards = buildTimeQuestionCards(parseGrade4TimeLessonSections(selected.body).sections)
    const published = (kind: 'exercise' | 'formative_check') => selectedItems
      .filter(item => item.question_kind === kind)
      .map(item => ({
        id: item.question_id, kind: item.question_kind,
        prompt: item.prompt, answer: item.answer, why: item.explanation,
      }))
    return {
      exercise: published('exercise').length ? published('exercise') : manuscriptCards.exercise,
      check: published('formative_check').length ? published('formative_check') : manuscriptCards.check,
    }
  }, [selected, selectedItems])

  function chooseLesson(order: number) {
    if (!lessons.some(row => row.lesson_order === order)) return
    pendingFocus.current = true
    setSelectedLesson(order)
    setRevealed([])
    setTab('core')
    const url = new URL(window.location.href)
    url.searchParams.set('lesson', String(order))
    url.hash = ''
    window.history.replaceState(window.history.state, '', url.toString())
    if (selectedLesson === order) {
      requestAnimationFrame(() => {
        const heading = document.getElementById('outcome-time-title')
        heading?.focus({ preventScroll: true })
        heading?.scrollIntoView({ behavior: 'auto', block: 'start' })
        pendingFocus.current = false
      })
    }
  }

  useEffect(() => {
    if (!pendingFocus.current || selectedLesson === null) return
    const frame = requestAnimationFrame(() => {
      const heading = document.getElementById('outcome-time-title')
      heading?.focus({ preventScroll: true })
      heading?.scrollIntoView({ behavior: 'auto', block: 'start' })
      pendingFocus.current = false
    })
    return () => cancelAnimationFrame(frame)
  }, [selectedLesson])
  const hrefFor = (id: string) => audience === 'teacher'
    ? `/teacher/outcome-package?outcomeId=${encodeURIComponent(id)}`
    : `/learn/grade-4/mathematics/time/outcome/${encodeURIComponent(id)}`


  // Learners land directly on the modern Time reader. The teacher-specific
  // package below keeps its existing guidance and preparation controls.
  if (audience === 'learner') return <main className={readerStyles.page}
    style={{ background: '#f5f9f6', color: '#163c2b' }}>
    <div className={readerStyles.wrap}>
      <nav className={readerStyles.breadcrumbs} aria-label="Breadcrumb">
        <Link href="/learn">Learn</Link><ChevronRight size={15} aria-hidden="true" />
        <Link href="/learn?grade=Grade+4&subject=Mathematics">Grade 4 Mathematics</Link>
        <ChevronRight size={15} aria-hidden="true" />
        <Link href="/learn/grade-4/mathematics/time">Time</Link>
        <ChevronRight size={15} aria-hidden="true" /><span aria-current="page">Learning goal</span>
      </nav>

      <header className={readerStyles.hero}>
        <div>
          <p className={readerStyles.kicker}>Grade 4 Mathematics · Measurement</p>
          <h1 className={readerStyles.heroTitle}>Time</h1>
          <p className={readerStyles.heroDescription}>
            {outcome?.outcome_text ?? 'Choose a learning goal and study its published lessons.'}
          </p>
        </div>
        <div className={readerStyles.subjectTag}>
          <Clock3 size={20} aria-hidden="true" /> Learn at your own pace
        </div>
      </header>

      {loading && <section className={readerStyles.empty} role="status">Loading published Time lessons…</section>}
      {!loading && error && <section className={readerStyles.error} role="alert">{error}</section>}
      {!loading && !error && lessons.length === 0 &&
        <section className={readerStyles.empty} role="status">
          No eligible certified lessons are currently available for this learning goal.
        </section>}

      {!loading && !error && selected && <div>
        <details className={readerStyles.lessonChooser} open={chooserOpen}
          onToggle={event => setChooserOpen(event.currentTarget.open)}>
          <summary>Choose a lesson <span>({lessons.length} available)</span></summary>
          <nav className={readerStyles.lessonList} aria-label="Choose a Time lesson">
            {lessons.map(row => <button key={row.resource_version_id} type="button"
              className={[readerStyles.lessonButton,
                selected.resource_version_id === row.resource_version_id ? readerStyles.lessonButtonActive : ''].join(' ')}
              aria-current={selected.resource_version_id === row.resource_version_id ? 'step' : undefined}
              onClick={() => { chooseLesson(row.lesson_order); setChooserOpen(false) }}>
              <span className={readerStyles.lessonNumber}>{row.lesson_order}</span>
              <span><span className={readerStyles.lessonTitle}>{parseGrade4TimeLessonSections(row.body).title || row.title}</span>
                <span className={readerStyles.lessonSmall}>
                  {selected.resource_version_id === row.resource_version_id ? 'Reading now' : 'Open lesson'}
                </span></span>
            </button>)}
          </nav>
        </details>

        <article key={selected.resource_version_id} className={readerStyles.article}
          aria-labelledby="outcome-time-title">
          <header className={readerStyles.articleHead}>
            <p className={readerStyles.articleNum}>
              Lesson {selectedIndex + 1} of {lessons.length}
            </p>
            <h2 id="outcome-time-title" tabIndex={-1} className={readerStyles.articleTitle}>
              {parsedSelected?.title || selected.title}
            </h2>
            <div className={readerStyles.goal}>
              <p className={readerStyles.goalLabel}>What you will learn</p>
              <p className={readerStyles.goalText}>{parsedSelected?.goal || outcome?.outcome_text}</p>
            </div>
          </header>

          <UniversalLearnReader
            subject="Mathematics"
            topic="time"
            sections={adaptCanonicalLearnSections(parsedSelected?.sections ?? [])}
            anchorPrefix="outcome-time"
            renderBody={section => section.id === 'example'
              ? <Grade4TimeWorkedSteps body={section.body} />
              : section.id === 'exercise' && questionCards.exercise.length
              ? <Grade4TimePracticeCards questions={questionCards.exercise} lessonNumber={selected.lesson_order} />
              : section.id === 'check' && questionCards.check.length
              ? <Grade4TimePracticeCards questions={questionCards.check} lessonNumber={selected.lesson_order} />
              : undefined}
            toolContext={toolContext ?? undefined}
            visualContext={selected.lesson_order === 4 && !!toolContext ? {
              grade: 'Grade 4', subject: 'Mathematics',
              topicKey: 'time-hours-minutes',
              sourceStrandId: 'e975dcc6-32a9-4274-a2a3-3d19e409cf5c',
            } : undefined}
            afterSection={(section, index) => toolContext &&
              getLearningToolSectionBinding(toolContext, section, index)
              ? <Grade4TimeLearningAid lessonNumber={selected.lesson_order} sectionId={section.id} />
              : null}
          />
          {selectedItems.length > 0 &&
            !parsedSelected?.sections.some(section => section.id === 'exercise' || section.id === 'check') &&
            <section className={readerStyles.outcomePanel} aria-label="Published practice">
              <h3>Check your understanding</h3>
              <Grade4TimePracticeCards lessonNumber={selected.lesson_order}
                questions={selectedItems.map(item => ({
                  id: item.question_id, kind: item.question_kind,
                  prompt: item.prompt, answer: item.answer, why: item.explanation,
                }))} />
            </section>}
          <div className={readerStyles.articleBottom}>
            <LearningNotebookPrompt subject="Mathematics" stage="learn" compact />
            <nav aria-label="Move between outcome lessons" className={readerStyles.lessonPager}>
              {selectedIndex > 0
                ? <button type="button" className={readerStyles.pagerButton}
                  onClick={() => chooseLesson(lessons[selectedIndex - 1].lesson_order)}>
                  <ChevronLeft size={17} aria-hidden="true" /> Previous lesson
                </button>
                : <Link className={readerStyles.pagerButton} href="/learn/grade-4/mathematics/time">
                  <ChevronLeft size={17} aria-hidden="true" /> Back to Time
                </Link>}
              {selectedIndex < lessons.length - 1
                ? <button type="button"
                  className={[readerStyles.pagerButton, readerStyles.pagerPrimary].join(' ')}
                  onClick={() => chooseLesson(lessons[selectedIndex + 1].lesson_order)}>
                  Next lesson <ArrowRight size={17} aria-hidden="true" />
                </button>
                : <Link className={[readerStyles.pagerButton, readerStyles.pagerPrimary].join(' ')}
                  href="/learn/grade-4/mathematics/time">
                  Back to Time <ArrowRight size={17} aria-hidden="true" />
                </Link>}
            </nav>
          </div>
        </article>
      </div>}

      <section className={readerStyles.outcomePanel} aria-label="Time learning outcomes">
        <h2>Practise another learning goal</h2>
        <p>Choose a published goal to study with the same lesson reader.</p>
        {catalogueLoading && <p role="status">Loading learning goals…</p>}
        {!catalogueLoading && catalogueError &&
          <p role="status">The learning-goal list is temporarily unavailable.</p>}
        {!catalogueLoading && !catalogueError && catalogue.length === 0 &&
          <p role="status">No published learning goals are currently available.</p>}
        <nav className={readerStyles.outcomeList} aria-label="Choose another learning goal">
          {catalogue.map(row => <Link className={readerStyles.outcomeLink}
            key={row.outcome_id} href={hrefFor(row.outcome_id)}
            aria-current={row.outcome_id === outcomeId ? 'page' : undefined}>
            <span>{row.outcome_text}</span><ChevronRight size={18} aria-hidden="true" />
          </Link>)}
        </nav>
      </section>
    </div>
  </main>

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
      {catalogueLoading && <p role="status">Loading published outcomes…</p>}
      {!catalogueLoading && catalogueError && <p role="status">
        The outcome list is temporarily unavailable. You can still read the lesson opened from this link.
      </p>}
      {!catalogueLoading && !catalogueError && catalogue.length === 0 &&
        <p role="status">No published outcomes are available in the catalogue.</p>}
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
          onClick={() => chooseLesson(row.lesson_order)}
          style={{ border: '1px solid #a9c8b3', borderRadius: 9, minHeight: 44, padding: '8px 12px',
            background: selected?.resource_version_id === row.resource_version_id ? '#e3f2e8' : '#fff', color: '#244a36' }}>
          Lesson {row.lesson_order}
        </button>)}
      </div>

      {selected && tab === 'core' && <article style={PANEL}>
        <UniversalLearnReader
          key={selected.resource_version_id}
          subject="Mathematics"
          topic="time"
          sections={adaptCanonicalLearnSections(parsedSelected?.sections ?? [])}
          title={parsedSelected?.title || selected.title}
          goal={parsedSelected?.goal}
          anchorPrefix="outcome-time"
          renderBody={(section) => section.id === 'example'
            ? <Grade4TimeWorkedSteps body={section.body} />
            : undefined}
          toolContext={toolContext ?? undefined}
          visualContext={selected.lesson_order === 4 && !!toolContext ? {
            grade: 'Grade 4', subject: 'Mathematics',
            topicKey: 'time-hours-minutes',
            sourceStrandId: 'e975dcc6-32a9-4274-a2a3-3d19e409cf5c',
          } : undefined}
          afterSection={(section, index) => toolContext && getLearningToolSectionBinding(toolContext, section, index)
            ? <Grade4TimeLearningAid lessonNumber={selected.lesson_order} sectionId={section.id} />
            : null}
        />
        <LearningNotebookPrompt subject="Mathematics" stage="learn" compact />
        <nav aria-label="Move between outcome lessons"
          style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', marginTop: 14 }}>
          {selectedIndex > 0 ? <button type="button" style={LINK}
            onClick={() => chooseLesson(lessons[selectedIndex - 1].lesson_order)}>
            Previous lesson
          </button> : <span />}
          {selectedIndex >= 0 && selectedIndex < lessons.length - 1 && <button type="button" style={LINK}
            onClick={() => chooseLesson(lessons[selectedIndex + 1].lesson_order)}>
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
