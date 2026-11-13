'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { ArrowRight, ChevronLeft, ChevronRight, Clock3 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { VisualRichText } from '@/components/learn/VisualLearningAsset'
import { formatGrade4TimeLessonBody } from '@/lib/content/grade4TimePresentation.mjs'
import { parseGrade4TimeLessonSections } from '@/lib/content/grade4TimeSections.mjs'
import { buildTimeQuestionCards } from '@/lib/content/grade4TimePractice.mjs'
import Grade4TimeLearningAid from '@/components/learn/Grade4TimeLearningAid'
import Grade4TimePracticeCards from '@/components/learn/Grade4TimePracticeCards'
import Grade4TimeVisualModels from '@/components/learn/Grade4TimeVisualModels'
import Grade4TimeWorkedSteps from '@/components/learn/Grade4TimeWorkedSteps'
import UniversalLearnReader from '@/components/learn/UniversalLearnReader'
import { adaptCanonicalLearnSections } from '@/lib/learn/learningBlockContract'
import { grade4TimeToolsForReleasedLesson } from '@/lib/learn/grade4TimeToolBindings'
import LearningNotebookPrompt from '@/components/learn/LearningNotebookPrompt'
import styles from './Grade4TimeContentReader.module.css'

type Lesson = {
  id: string
  title: string
  unitId: string
  body: string
  order: number
}

type PublishedOutcome = {
  outcome_id: string
  outcome_text: string
  lesson_count: number
}

const INK = '#163c2b'

function learnerTitle(title: string) {
  return title.replace(/\s*[—–-]\s*Learner Notes$/i, '').trim()
}

function Grade4TimeLessonArticle({
  lesson, rawBody, total, onPrevious, onNext, previousAvailable, nextAvailable,
}: {
  lesson: Lesson
  rawBody: string
  total: number
  onPrevious: () => void
  onNext: () => void
  previousAvailable: boolean
  nextAvailable: boolean
}) {
  // Only the approved, read-only RPC body is passed to this display parser.
  // The formatter hides internal question IDs but preserves all explanations
  // and approved [visual:UUID] placeholders for the certified asset resolver.
  const parsed = useMemo(() => parseGrade4TimeLessonSections(lesson.body), [lesson.body])
  // Match only question/answer IDs that were already in the published manuscript.
  // The formatted reader body is still used for all visible text.
  const cards = useMemo(() =>
    buildTimeQuestionCards(parseGrade4TimeLessonSections(rawBody).sections), [rawBody])
  const [largeText, setLargeText] = useState(false)

  return <article className={`${styles.article} ${largeText ? styles.largeType : ''}`} aria-labelledby="time-lesson-title">
    <header className={styles.articleHead}>
      <div className={styles.readerToolbar}>
        <p className={styles.articleNum}>Lesson {lesson.order} of {total}</p>
        <div className={styles.textSettings} role="group" aria-label="Text size">
          <span>Text size</span>
          <button type="button" aria-label="Standard text size" aria-pressed={!largeText}
            className={!largeText ? styles.settingActive : ''} onClick={() => setLargeText(false)}>A</button>
          <button type="button" aria-label="Large text size" aria-pressed={largeText}
            className={largeText ? styles.settingActive : ''} onClick={() => setLargeText(true)}>A+</button>
        </div>
      </div>
      <h2 className={styles.articleTitle} id="time-lesson-title" tabIndex={-1}>
        {parsed.title || learnerTitle(lesson.title)}
      </h2>
      {parsed.goal && <div className={styles.goal}>
        <p className={styles.goalLabel}>What you will learn</p>
        <p className={styles.goalText}>{parsed.goal}</p>
      </div>}
    </header>

    <UniversalLearnReader
      subject="Mathematics"
      topic="time"
      sections={adaptCanonicalLearnSections(parsed.sections)}
      tools={grade4TimeToolsForReleasedLesson(lesson.order)}
      anchorPrefix="time-section"
      renderBody={(section) => section.id === 'example'
        ? <Grade4TimeWorkedSteps body={section.body}/>
        : section.id === 'exercise' && cards.exercise.length > 0
        ? <Grade4TimePracticeCards questions={cards.exercise} lessonNumber={lesson.order}/>
        : section.id === 'check' && cards.check.length > 0
        ? <Grade4TimePracticeCards questions={cards.check} lessonNumber={lesson.order}/>
        : <VisualRichText body={section.body} style={{ fontSize: 17, lineHeight: 1.8 }} />}
      afterSection={(section) => <>
        <Grade4TimeLearningAid lessonNumber={lesson.order} sectionId={section.id}/>
        {(section.id === 'understand' || section.id === 'example') && <Grade4TimeVisualModels
          lessonOrder={lesson.order} sectionId={section.id} inlineVisualPresent={/\\[visual:/.test(rawBody)} />}
      </>}
    />

    <div className={styles.articleBottom}>
      <LearningNotebookPrompt subject="Mathematics" stage="learn" compact />
      <div className={styles.lessonPager} aria-label="Move between lessons">
        {previousAvailable ? <button className={styles.pagerButton} type="button" onClick={onPrevious}>
          <ChevronLeft size={17} aria-hidden="true" /> Previous lesson
        </button> : <span aria-hidden="true" />}
        {nextAvailable ? <button className={`${styles.pagerButton} ${styles.pagerPrimary}`} type="button" onClick={onNext}>
          Next lesson <ArrowRight size={17} aria-hidden="true" />
        </button> : <Link className={styles.pagerButton} href="/learn?grade=Grade+4&subject=Mathematics">
          Back to Mathematics <ArrowRight size={17} aria-hidden="true" />
        </Link>}
      </div>
    </div>
  </article>
}

/** The same certified Time resources remain visible to school-linked and independent learners. */
export default function Grade4TimeContentReader() {
  const [lessons, setLessons] = useState<Lesson[]>([])
  const [chooserOpen, setChooserOpen] = useState(false)
  const [selected, setSelected] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [outcomes, setOutcomes] = useState<PublishedOutcome[]>([])

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
        // Incomplete or incompatible RPC data is an error, never 'no published content'.
        if (!Array.isArray(data) || clean.length !== data.length) {
          if (active) setLoadError(true)
          return
        }
        if (active) {
          const ordered = clean.sort((a, b) => a.order - b.order)
          setLessons(ordered)
          const requested = Number(new URLSearchParams(window.location.search).get('lesson'))
          const match = Number.isInteger(requested) ? ordered.find(item => item.order === requested) : undefined
          setSelected(match?.id ?? null)
        }
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
    let active = true
    void (async () => {
      const response = await supabase.rpc('vs_published_grade4_time_outcomes')
      if (active && !response.error && Array.isArray(response.data)) {
        setOutcomes(response.data.filter((row: PublishedOutcome) =>
          typeof row.outcome_id === 'string' && typeof row.outcome_text === 'string'))
      }
    })()
    return () => { active = false }
  }, [])

  const current = useMemo(() => lessons.find(l => l.id === selected) ?? lessons[0] ?? null, [lessons, selected])
  const currentIndex = current ? lessons.findIndex(l => l.id === current.id) : -1

  function chooseLesson(lesson: Lesson) {
    setSelected(lesson.id)
    setChooserOpen(false)
    // Shareable deep link, not a claim that reading progress was saved.
    const url = new URL(window.location.href)
    url.searchParams.set('lesson', String(lesson.order))
    url.hash = ''
    window.history.replaceState(window.history.state, '', url.toString())
    requestAnimationFrame(() => {
      const target = document.getElementById('time-lesson-title')
      target?.focus({ preventScroll: true })
      target?.scrollIntoView({ behavior: 'auto', block: 'start' })
    })
  }

  return <main className={styles.page} style={{ color: INK, background: '#f5f9f6' }}>
    <div className={styles.wrap}>
      <nav className={styles.breadcrumbs} aria-label="Breadcrumb">
        <Link href="/learn">Learn</Link><ChevronRight size={15} aria-hidden="true" />
        <Link href="/learn?grade=Grade+4&subject=Mathematics">Grade 4 Mathematics</Link>
        <ChevronRight size={15} aria-hidden="true" /><span aria-current="page">Time</span>
      </nav>

      <header className={styles.hero}>
        <div>
          <p className={styles.kicker}>Grade 4 Mathematics · Measurement</p>
          <h1 className={styles.heroTitle}>Time</h1>
          <p className={styles.heroDescription}>Read clocks, understand a.m. and p.m., change time units and solve everyday duration problems.</p>
        </div>
        <div className={styles.subjectTag}><Clock3 size={20} aria-hidden="true" /> Learn at your own pace</div>
      </header>

      {loading ? <section className={styles.empty} role="status">Loading published Mathematics lessons…</section>
        : loadError ? <section className={styles.error} role="alert">The published lesson library could not load. Please reopen this page.</section>
        : lessons.length === 0 ? <section className={styles.empty} role="status">No certified Time lessons are available in the library right now.</section>
        : current && <div>
          <details className={styles.lessonChooser} open={chooserOpen} onToggle={event => setChooserOpen(event.currentTarget.open)}>
            <summary>Choose a lesson <span>({lessons.length} available)</span></summary>
            <nav className={styles.lessonList} aria-label="Choose a Time lesson">
              {lessons.map(lesson =>
                <button key={lesson.id} type="button"
                  aria-current={current.id === lesson.id ? 'step' : undefined}
                  className={`${styles.lessonButton} ${current.id === lesson.id ? styles.lessonButtonActive : ''}`}
                  onClick={() => chooseLesson(lesson)}>
                  <span className={styles.lessonNumber}>{lesson.order}</span>
                  <span><span className={styles.lessonTitle}>{learnerTitle(lesson.title)}</span>
                    <span className={styles.lessonSmall}>{current.id === lesson.id ? 'Reading now' : 'Open lesson'}</span></span>
                </button>,
              )}
            </nav>
          </details>

          <div className={styles.contentArea}>
            <Grade4TimeLessonArticle
              key={current.id}
              lesson={{ ...current, body: formatGrade4TimeLessonBody(current.body) }}
              rawBody={current.body}
              total={lessons.length}
              previousAvailable={currentIndex > 0}
              nextAvailable={currentIndex + 1 < lessons.length}
              onPrevious={() => chooseLesson(lessons[currentIndex - 1])}
              onNext={() => chooseLesson(lessons[currentIndex + 1])}
            />
          </div>
        </div>}

      {outcomes.length > 0 && <section className={styles.outcomePanel} aria-label="Time learning outcomes">
        <h2>Practise a learning goal</h2>
        <p>Choose an area to study again, follow its worked examples and check the available formative questions.</p>
        <div className={styles.outcomeList}>
          {outcomes.map(item =>
            <Link key={item.outcome_id} className={styles.outcomeLink}
              href={`/learn/grade-4/mathematics/time/outcome/${encodeURIComponent(item.outcome_id)}`}>
              <span>{item.outcome_text}</span><ChevronRight size={18} aria-hidden="true" />
            </Link>,
          )}
        </div>
      </section>}
    </div>
  </main>
}
