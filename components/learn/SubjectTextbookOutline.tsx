'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowRight, BookOpen, ChevronRight } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { subjectKey } from '@/lib/learn/schoolCatalog'
import { connectReadingEntries, projectGrade4MathOutline, type Grade4MathBinding, type BookReadingEntry, type CurriculumOutlineRow } from '@/lib/learn/textbookOutline'
import styles from './SchoolLearnLibrary.module.css'

type State = { scope: string; status: 'loading' | 'ready' | 'unavailable'; rows: CurriculumOutlineRow[] }
type ObjectiveState = { scope: string; canonicalRows: CurriculumOutlineRow[] | null; byUnit: Record<string, string[]> }
type Book = { id: string; title: string; href: string }
type Reader = { title: string; href: string }
type Reading = { scope: string; loading: boolean; entries: BookReadingEntry[]; resume: string | null }
type Props = { grade: string; subject: string; books: readonly Book[]; readers: readonly Reader[]; booksLoading: boolean; booksError: boolean }

export default function SubjectTextbookOutline({ grade, subject, books, readers, booksLoading, booksError }: Props) {
  const scope = JSON.stringify([grade, subject])
  const bookScope = JSON.stringify(books.map(book => book.id))
  const readingScope = JSON.stringify([scope, bookScope])
  const [state, setState] = useState<State>({ scope, status: 'loading', rows: [] })
  const [objectives, setObjectives] = useState<ObjectiveState>({ scope: '', canonicalRows: null, byUnit: {} })
  const [reading, setReading] = useState<Reading>({scope:readingScope,loading:true,entries:[],resume:null})
  useEffect(() => {
    let active = true
    const finish = (status: State['status'], rows: CurriculumOutlineRow[] = []) => {
      if (active) setState({ scope, status, rows })
    }
    finish('loading')
    async function load() {
      try {
        const {data:metadata,error:metadataError}=await supabase.rpc('get_school_textbook_shell_metadata',{p_grade:grade,p_subject:subject})
        if (!active) return
        if (!metadataError && metadata && Array.isArray(metadata.rows)) return finish('ready',metadata.rows as CurriculumOutlineRow[])
        // Existing signed-in metadata lookup during the additive migration rollout.
        const { data: subjects, error: subjectError } = await supabase.from('subjects')
          .select('id,name').is('school_id', null).order('id').limit(1000)
        if (subjectError) throw subjectError
        const matches = (subjects ?? []).filter(item => subjectKey(item.name) === subjectKey(subject))
        if (matches.length !== 1) return finish('unavailable')
        const rows: CurriculumOutlineRow[] = []
        const size = 200
        for (let page = 0; ; page++) {
          const { data, error } = await supabase.from('cbc_strands')
            .select('id,name,sub_strand,source_ref,strand_order,sub_strand_order').eq('grade', grade).eq('subject_id', matches[0].id)
            .order('name').order('sub_strand').order('id').range(page * size, (page + 1) * size - 1)
          if (!active) return
          if (error) throw error
          rows.push(...(data ?? []))
          if ((data ?? []).length < size) break
        }
        finish('ready', rows)
      } catch { finish('unavailable') }
    }
    void load()
    return () => { active = false }
  }, [grade, subject, scope])

  // Grade 4 Maths has 19 canonical sub-strands alongside older generic headings.
  // Authenticate before fetching objective text. This preserves the existing
  // public headings-only shell and never reads unpublished textbook or KICD bytes.
  useEffect(() => {
    if (state.scope !== scope || state.status !== 'ready' ||
        grade !== 'Grade 4' || subjectKey(subject) !== subjectKey('Mathematics')) return
    let active = true
    async function loadObjectives() {
      const { data: { user }, error: authError } = await supabase.auth.getUser()
      if (!active || authError || !user) return
      const { data: bindings, error: bindingError } = await supabase
        .from('grade4_mathematics_reader_bindings')
        .select('source_ref,sub_strand_id').eq('status','active')
        .like('source_ref','VS-CUR-G04-MA-2026#%')
      if (!active || bindingError) return
      const canonicalRows = projectGrade4MathOutline(state.rows, (bindings ?? []) as Grade4MathBinding[])
      if (!canonicalRows) return
      setObjectives({ scope, canonicalRows, byUnit: {} })
      const ids = canonicalRows.map(row => row.id)
      const { data: activeGuides, error: guideError } = await supabase
        .from('curriculum_learning_outcomes')
        .select('sub_strand_id,outcome_code,outcome_text')
        .in('sub_strand_id', ids)
        .eq('status','active').eq('source_type','creator_claimed').is('created_by',null)
        .like('source_ref','VS-CUR-G04-MA-2026#%')
        .order('outcome_code', { ascending: true })
      if (!active || guideError) return
      const allowed = new Set(ids)
      const byUnit: Record<string,string[]> = {}
      for (const item of activeGuides ?? []) {
        const unitId = item.sub_strand_id
        if (!unitId || !allowed.has(unitId)) continue
        const text = String(item.outcome_text ?? '').trim()
        if (!text) continue
        if (!byUnit[unitId]) byUnit[unitId] = []
        byUnit[unitId].push(text)
      }
      setObjectives({ scope, canonicalRows, byUnit })
    }
    void loadObjectives()
    return () => { active = false }
  }, [state.scope, state.status, state.rows, scope, grade, subject])

  // Only published chapter metadata allowed by existing RLS. The reader
  // remains the entitlement authority. No draft or body is requested here.
  useEffect(() => {
    let active = true
    const ids: string[] = JSON.parse(bookScope)
    setReading({scope:readingScope,loading:true,entries:[],resume:null})
    async function load() {
      const entries: BookReadingEntry[] = []
      let resume: string | null = null
      try {
        for (let offset = 0; offset < ids.length; offset += 50) {
          for (let page = 0; ; page++) {
            const {data,error} = await supabase.from('vibe_chapters')
              .select('id,publication_id,title,number,sub_strand_id')
              .in('publication_id',ids.slice(offset,offset+50)).eq('status','published')
              .order('publication_id').order('number').order('id').range(page*200,(page+1)*200-1)
            if (!active) return
            if (error) throw error
            for (const row of data ?? []) entries.push({
              id:row.id,title:row.title || `Chapter ${row.number}`,subStrandId:row.sub_strand_id,
              href:`/read/textbook/${encodeURIComponent(row.publication_id)}/${encodeURIComponent(row.id)}`,
            })
            if ((data ?? []).length < 200) break
          }
        }
        const {data:{user}} = await supabase.auth.getUser()
        if (user && entries.length) {
          // The owner-only progress table is already RLS protected. Query only
          // known public chapter IDs and never promote a missing chapter.
          let latest: {chapter_id:string;last_read_at:string} | null = null
          for (let offset = 0; offset < entries.length; offset += 100) {
            const {data} = await supabase.from('vibe_reading_progress')
              .select('chapter_id,last_read_at').eq('viewer_id',user.id)
              .in('chapter_id',entries.slice(offset,offset+100).map(entry=>entry.id))
              .order('last_read_at',{ascending:false}).limit(1).maybeSingle()
            if (!active) return
            if (data && (!latest || data.last_read_at > latest.last_read_at)) latest = data
          }
          resume = latest?.chapter_id ?? null
        }
      } catch { /* existing book links stay reachable if metadata is unavailable */ }
      if (active) setReading({scope:readingScope,loading:false,entries,resume})
    }
    void load()
    return () => { active = false }
  }, [bookScope, readingScope])

  const current = state.scope === scope ? state : { status: 'loading' as const, rows: [] }
  const currentReading = reading.scope === readingScope ? reading : {loading:true,entries:[],resume:null}
  const fallbackBooks = books.filter(book => !currentReading.entries.some(entry => entry.href.startsWith(book.href+'/')))
  const entries: BookReadingEntry[] = [
    ...currentReading.entries,
    ...readers.map(reader=>({id:reader.href,title:reader.title,href:reader.href,legacy:true})),
    ...fallbackBooks.map(book=>({id:book.id,title:book.title,href:book.href})),
  ]
  const learnerObjectives = objectives.scope === scope ? objectives : null
  const {groups,unmatched} = connectReadingEntries(learnerObjectives?.canonicalRows ?? current.rows, entries)
  const first = groups.flatMap(group=>group.topics.flatMap(topic=>topic.entries))[0] ?? unmatched[0]
  const resumed = currentReading.entries.find(entry=>entry.id===currentReading.resume)
  const open = resumed ?? first
  const pending = booksLoading || currentReading.loading || current.status === 'loading'
  const entryLink = (entry: BookReadingEntry, label = entry.title) =>
    <Link className={styles.bookTopicLink} key={entry.href} href={entry.href}><span>{label}</span><ChevronRight size={17} aria-hidden="true"/></Link>

  return <article className={styles.subjectBook} aria-label={grade+' '+subject+' textbook'}>
    <header className={styles.bookHero}>
      <div className={styles.bookCover} aria-hidden="true"><span>VibeSchool</span><BookOpen size={28}/><strong>{subject}</strong><small>{grade}</small></div>
      <div className={styles.bookTitle}><div className={styles.kicker}>VibeSchool Originals</div><h1>{subject}</h1>
        <p>{grade} · Textbook</p>
        {open ? <Link className={styles.buttonPrimary} href={open.href}>{resumed ? 'Continue reading' : 'Start reading'} <ArrowRight size={16}/></Link>
          : <p role="status">{pending ? 'Opening book…' : 'Content coming soon'}</p>}
      </div>
    </header>
    <section aria-label="Contents" className={styles.bookContents}>
      <h2>Contents</h2>
      {groups.map((group,index)=><details key={group.id} className={styles.bookChapter}>
        <summary><span className={styles.chapterNumber}>{String(index+1).padStart(2,'0')}</span><strong>{group.title}</strong><ChevronRight size={18} aria-hidden="true"/></summary>
        <div className={styles.bookTopics}>{group.topics.map(topic=>{
          const goals = learnerObjectives?.byUnit[topic.id] ?? []
          return <div key={topic.id} className={styles.bookTopicGroup}>
            {topic.strand && <small className={styles.tinyNote}>{topic.strand}</small>}
            {topic.entries.length ? topic.entries.map((entry,i)=>entryLink(entry,i===0?topic.title:entry.title)) : <div className={styles.bookTopicPending}><span>{topic.title}</span><small>Coming soon</small></div>}
            {goals.length > 0 && <div className={styles.bookObjectivePreview} aria-label={topic.title+' learning objectives'}>
              <strong>What you'll learn</strong>
              <p>{goals[0]}</p>
              {goals.length > 1 && <details className={styles.bookObjectiveMore}>
                <summary>View all {goals.length} objectives <ChevronRight size={14} aria-hidden="true" /></summary>
                <ol>{goals.map((goal,i)=><li key={i}>{goal}</li>)}</ol>
              </details>}
              <small>VibeSchool curriculum guidance</small>
            </div>}
          </div>
        })}</div>
      </details>)}
      {unmatched.map(entry=>entryLink(entry))}
      {!groups.length && !entries.length && <p className={styles.bookEmpty} role="status">{pending ? 'Loading contents…' : 'Content coming soon'}</p>}
      {booksError && <p className={styles.tinyNote} role="status">Some books could not load. Try refreshing.</p>}
    </section>
  </article>
}
