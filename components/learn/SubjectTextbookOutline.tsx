'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowRight, BookOpen, ChevronRight } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { subjectKey } from '@/lib/learn/schoolCatalog'
import { connectReadingEntries, type BookReadingEntry, type CurriculumOutlineRow } from '@/lib/learn/textbookOutline'
import styles from './SchoolLearnLibrary.module.css'

type State = { scope: string; status: 'loading' | 'ready' | 'unavailable'; rows: CurriculumOutlineRow[] }
type Book = { id: string; title: string; href: string }
type Reader = { title: string; href: string }
type Reading = { scope: string; loading: boolean; entries: BookReadingEntry[]; resume: string | null }
type Props = { grade: string; subject: string; books: readonly Book[]; readers: readonly Reader[]; booksLoading: boolean; booksError: boolean }

export default function SubjectTextbookOutline({ grade, subject, books, readers, booksLoading, booksError }: Props) {
  const scope = JSON.stringify([grade, subject])
  const bookScope = JSON.stringify(books.map(book => book.id))
  const readingScope = JSON.stringify([scope, bookScope])
  const [state, setState] = useState<State>({ scope, status: 'loading', rows: [] })
  const [reading, setReading] = useState<Reading>({scope:readingScope,loading:true,entries:[],resume:null})
  useEffect(() => {
    let active = true
    const finish = (status: State['status'], rows: CurriculumOutlineRow[] = []) => {
      if (active) setState({ scope, status, rows })
    }
    finish('loading')
    async function load() {
      try {
        const { data: subjects, error: subjectError } = await supabase.from('subjects')
          .select('id,name').is('school_id', null).order('id').limit(1000)
        if (subjectError) throw subjectError
        const matches = (subjects ?? []).filter(item => subjectKey(item.name) === subjectKey(subject))
        if (matches.length !== 1) return finish('unavailable')
        const rows: CurriculumOutlineRow[] = []
        const size = 200
        for (let page = 0; ; page++) {
          const { data, error } = await supabase.from('cbc_strands')
            .select('id,name,sub_strand').eq('grade', grade).eq('subject_id', matches[0].id)
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
  const {groups,unmatched} = connectReadingEntries(current.rows, entries)
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
        <div className={styles.bookTopics}>{group.topics.map(topic=><div key={topic.id}>
          {topic.entries.length ? topic.entries.map((entry,i)=>entryLink(entry,i===0?topic.title:entry.title)) : <div className={styles.bookTopicPending}><span>{topic.title}</span><small>Coming soon</small></div>}
        </div>)}</div>
      </details>)}
      {unmatched.map(entry=>entryLink(entry))}
      {!groups.length && !entries.length && <p className={styles.bookEmpty} role="status">{pending ? 'Loading contents…' : 'Content coming soon'}</p>}
      {booksError && <p className={styles.tinyNote} role="status">Some books could not load. Try refreshing.</p>}
    </section>
  </article>
}
