'use client'

import { Suspense, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { ArrowRight, BookOpen, ChevronRight, Images, RefreshCw, Search } from 'lucide-react'
import { SCHOOL_LEVELS, fallbackSubjectGroups, recogniseLearnerGrade } from '@/lib/learn/schoolCatalog'
import { VisualLearningAsset } from '@/components/learn/VisualLearningAsset'
import learnStyles from '@/components/learn/SchoolLearnLibrary.module.css'
import styles from './visuals.module.css'

type Visual = {
  id: string
  resourceVersionId: string
  title: string
  grade: string | null
  subject: string | null
  caption: string
  type: string
  topicKey: string
}
type PageResult = { visuals: Visual[]; page: number; pageSize: number; hasMore: boolean }
type LoadState = 'loading' | 'ready' | 'error'

/** Only links backed by a known published Learn reader are advertised as lessons. */
function relatedLesson(visual: Visual): string | null {
  if (visual.grade === 'Grade 4' && visual.subject === 'Mathematics'
    && visual.topicKey === 'time-hours-minutes') {
    return '/learn/grade-4/mathematics/time?lesson=4'
  }
  return null
}

function VisualLibraryContent() {
  const params = useSearchParams()
  const requestedGrade = recogniseLearnerGrade(params.get('grade'))
  const [grade, setGrade] = useState(requestedGrade ?? '')
  const [subject, setSubject] = useState(params.get('subject') ?? '')
  const [topicKey, setTopicKey] = useState(params.get('topicKey') ?? '')
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [page, setPage] = useState(1)
  const [retry, setRetry] = useState(0)
  const [visuals, setVisuals] = useState<Visual[]>([])
  const [hasMore, setHasMore] = useState(false)
  const [state, setState] = useState<LoadState>('loading')

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search.trim()), 250)
    return () => clearTimeout(timer)
  }, [search])

  useEffect(() => {
    let active = true
    const controller = new AbortController()
    const query = new URLSearchParams({ page: String(page) })
    if (grade) query.set('grade',grade)
    if (subject) query.set('subject',subject)
    if (topicKey) query.set('topicKey',topicKey)
    if (debouncedSearch) query.set('search',debouncedSearch)
    setState('loading')
    void fetch('/api/visual-library?' + query.toString(), { cache:'no-store', signal:controller.signal })
      .then(async response => {
        if (!response.ok) throw new Error('visual catalogue unavailable')
        return response.json() as Promise<PageResult>
      })
      .then(result => {
        if (!active) return
        setVisuals(Array.isArray(result.visuals) ? result.visuals : [])
        setHasMore(result.hasMore === true)
        setState('ready')
      })
      .catch(() => { if (active) setState('error') })
    return () => { active = false; controller.abort() }
  }, [grade,subject,topicKey,debouncedSearch,page,retry])

  const subjects = useMemo(() => grade
    ? Array.from(new Set(fallbackSubjectGroups(grade).flatMap(group => group.subjects)))
    : [], [grade])
  const subjectHref = (visual: Visual) => visual.grade && visual.subject
    ? '/learn?' + new URLSearchParams({grade: visual.grade, subject: visual.subject}).toString()
    : '/learn'

  function changeGrade(next: string) {
    setGrade(next)
    setSubject('')
    setTopicKey('')
    setPage(1)
  }
  function changeSubject(next: string) {
    setSubject(next)
    setTopicKey('')
    setPage(1)
  }

  return <div className={learnStyles.shell}>
    <header className={learnStyles.topbar}>
      <div className={learnStyles.topInner}>
        <Link className={learnStyles.brand} href="/learn" aria-label="VibeSchool Learn home">
          <span className={learnStyles.brandIcon} aria-hidden="true">V</span>
          <span><span className={learnStyles.brandName}>VibeSchool <strong>Learn</strong></span>
            <span className={learnStyles.brandSub}>Your digital learning library</span></span>
        </Link>
        <nav className={learnStyles.topLinks} aria-label="Learning navigation">
          <Link className={learnStyles.topLink} href="/learn">School subjects</Link>
          <Link className={learnStyles.topLink} href="/learn?view=reading">All reading</Link>
          <Link className={learnStyles.topLink} href="/student/study">My learning</Link>
          <span className={learnStyles.topLink} aria-current="page">Visual aids</span>
        </nav>
      </div>
    </header>

    <main className={styles.main} id="main-content">
      <nav className={learnStyles.breadcrumbs} aria-label="Breadcrumb">
        <Link href="/learn">Learn</Link><ChevronRight size={15} aria-hidden="true" />
        <span aria-current="page">Visual aids</span>
      </nav>
      <div className={styles.heading}>
        <div>
          <p className={learnStyles.kicker}>Explore and understand</p>
          <h1 className={learnStyles.pageTitle}>Visual learning library</h1>
          <p className={learnStyles.description}>Explore diagrams, models and illustrations that help make lessons clearer.
            Open a related lesson to keep learning.</p>
        </div>
        <div className={styles.headingIcon} aria-hidden="true"><Images size={32}/></div>
      </div>
      <section className={styles.filters} aria-label="Find learning visuals">
        <label className={styles.field}>Grade
          <select value={grade} onChange={event => changeGrade(event.target.value)}>
            <option value="">All grades</option>
            {SCHOOL_LEVELS.map(level =>
              <optgroup key={level.id} label={level.label}>
                {level.grades.map(item => <option key={item} value={item}>{item}</option>)}
              </optgroup>)}
          </select>
        </label>
        <label className={styles.field}>Subject
          <select value={subject} onChange={event => changeSubject(event.target.value)}
            disabled={!grade} aria-label="Filter visuals by subject">
            <option value="">All subjects</option>
            {subject && !subjects.includes(subject) && <option value={subject}>{subject}</option>}
            {subjects.map(item => <option key={item} value={item}>{item}</option>)}
          </select>
        </label>
        <label className={styles.field + ' ' + styles.searchField}>Search visual aids
          <span className={styles.searchWrap}><Search size={17} aria-hidden="true"/>
            <input type="search" value={search} placeholder="Try clocks, fractions or maps"
              onChange={event => { setSearch(event.target.value); setPage(1) }} />
          </span>
        </label>
        {topicKey && <div className={styles.topicFilter}>
          Topic: {topicKey.replaceAll('-',' ')}
          <button type="button" onClick={() => { setTopicKey('');setPage(1) }}>Clear topic</button>
        </div>}
      </section>

      <div className={styles.resultsHead}>
        <h2>Available visuals</h2>
        {state === 'ready' && <span>{visuals.length} shown{hasMore ? ' · More available' : ''}</span>}
      </div>

      {state === 'loading' ? <div className={styles.notice} role="status">Loading approved visual aids…</div>
        : state === 'error' ? <div className={styles.notice} role="alert">
          <p>Visual aids could not be loaded. Your filters have been kept.</p>
          <button type="button" className={learnStyles.buttonSecondary} onClick={() => setRetry(value => value + 1)}>
            <RefreshCw size={15}/> Try again
          </button>
        </div>
        : visuals.length === 0 ? <div className={styles.notice} role="status">
          <p>No approved visuals match these filters yet. You can try another subject or browse a lesson.</p>
          <Link className={learnStyles.buttonSecondary} href="/learn"><BookOpen size={16}/> Browse lessons</Link>
        </div>
        : <section className={styles.grid} aria-label="Approved visual aids">
          {visuals.map(visual => {
            const lesson = relatedLesson(visual)
            return <article key={visual.id} className={styles.visualCard}>
              <div className={styles.cardTop}><span className={styles.type}>{visual.type.replaceAll('_',' ')}</span>
                <span className={styles.grade}>{visual.grade || 'Learning visual'}</span></div>
              <h3>{visual.title}</h3>
              <p className={styles.subject}>{visual.subject || 'Learning resource'}</p>
              <VisualLearningAsset id={visual.id} resourceVersionId={visual.resourceVersionId}/>
              <Link className={styles.cardLink} href={lesson || subjectHref(visual)}>
                {lesson ? 'Open related lesson' : 'Browse subject'} <ArrowRight size={16} aria-hidden="true"/>
              </Link>
            </article>
          })}
        </section>}

      {state === 'ready' && (page > 1 || hasMore) && <nav className={styles.pagination} aria-label="Visual results pages">
        <button type="button" className={learnStyles.buttonSecondary} disabled={page <= 1}
          onClick={() => setPage(value => Math.max(1,value-1))}>Previous</button>
        <span>Page {page}</span>
        <button type="button" className={learnStyles.buttonSecondary} disabled={!hasMore}
          onClick={() => setPage(value => value+1)}>Next</button>
      </nav>}
    </main>
  </div>
}

export default function LearnVisualLibrary() {
  return <Suspense fallback={<main role="status" style={{padding:24}}>Opening visual library…</main>}>
    <VisualLibraryContent/>
  </Suspense>
}
