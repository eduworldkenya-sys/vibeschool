'use client'

import Link from 'next/link'
import { useEffect, useState, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { getSubjectName } from '@/lib/curriculum/globalSubjects'
import {
  selectCertifiedNoteCatalogue,
  type CatalogueNoteRoot,
  type CanonicalNoteVersion,
  type CertifiedCatalogueNote,
} from '@/lib/teaching/canonicalLessonNotes'

type PersonalNote = {
  id: string
  title: string
  subject: string | null
  type: string
  component_type: string | null
  publication_status: string | null
}
type View = 'browse' | 'mine' | 'prepared'
const PAGE_SIZE = 30
const field: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box', minHeight: 44, padding: '10px 12px',
  border: '1px solid #cbd9cf', borderRadius: 10, background: '#fff',
  fontFamily: 'inherit', fontSize: 14, color: '#21382b',
}
const panel: React.CSSProperties = {
  border: '1px solid #dbe5df', borderRadius: 14, background: '#fff', padding: 16,
}

/**
 * Read-only catalogue over existing canonical content. My notes are teacher-owned
 * drafts from the established Resources editor, not clones of certified content.
 * No timetable, class assignment or lesson-plan ID is required to browse.
 */
export default function LessonNotesLibrary({
  subjectId = '',
  preparedLessons,
}: {
  subjectId?: string
  preparedLessons?: ReactNode
}) {
  const router = useRouter()
  const [view, setView] = useState<View>('browse')
  const [grade, setGrade] = useState('')
  const [subject, setSubject] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(0)
  const [notes, setNotes] = useState<CertifiedCatalogueNote[]>([])
  const [totalRoots, setTotalRoots] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [myNotes, setMyNotes] = useState<PersonalNote[]>([])
  const [myLoading, setMyLoading] = useState(true)
  const [myError, setMyError] = useState('')

  useEffect(() => {
    if (!subjectId) return
    let alive = true
    void getSubjectName(subjectId).then(name => {
      if (alive && name) { setSubject(name); setPage(0) }
    })
    return () => { alive = false }
  }, [subjectId])

  useEffect(() => {
    let alive = true
    async function loadOwnNotes() {
      try {
        const auth = await supabase.auth.getUser()
        if (!auth.data.user) { router.replace('/login/teacher'); return }
        if (auth.error) throw auth.error
        const result = await supabase.from('resources')
          .select('id,title,subject,type,component_type,publication_status')
          .eq('teacher_id', auth.data.user.id)
          .order('created_at', { ascending: false }).limit(100)
        if (result.error) throw result.error
        if (alive) setMyNotes(((result.data ?? []) as PersonalNote[]).filter(row =>
          row.type === 'notes' || row.component_type === 'lesson-notes'))
      } catch (reason) {
        if (alive) setMyError(reason instanceof Error ? reason.message : 'Could not load your saved notes.')
      } finally {
        if (alive) setMyLoading(false)
      }
    }
    void loadOwnNotes()
    return () => { alive = false }
  }, [router])

  useEffect(() => {
    let alive = true
    const timeout = setTimeout(() => { void loadCatalogue() }, 250)
    async function loadCatalogue() {
      setLoading(true)
      setError('')
      setNotes([])
      try {
        const auth = await supabase.auth.getUser()
        if (!auth.data.user) { router.replace('/login/teacher'); return }
        if (auth.error) throw auth.error

        let query = supabase.from('learning_resources')
          .select('id,title,grade,subject,asset_kind,status,visibility,curriculum_outcome_id,sub_strand_id', { count: 'exact' })
          .in('asset_kind', ['teacher_notes', 'learner_notes'])
          .eq('status', 'active').eq('visibility', 'public')
        if (grade) query = query.eq('grade', grade)
        if (subject.trim()) query = query.ilike('subject', subject.trim())
        // Search is a discovery filter only; never infer outcome identity from a title.
        const term = search.trim().replace(/[%_\\,]/g, '').slice(0, 80)
        if (term) query = query.ilike('title', '%' + term + '%')
        const result = await query.order('title', { ascending: true })
          .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1)
        if (result.error) throw result.error
        const roots = (result.data ?? []) as CatalogueNoteRoot[]
        if (!roots.length) {
          if (alive) { setNotes([]); setTotalRoots(result.count ?? 0) }
          return
        }
        const versions = await supabase.from('learning_resource_versions')
          .select('id,resource_id,version,lifecycle_status,certified_at')
          .in('resource_id', roots.map(row => row.id))
          .eq('lifecycle_status', 'certified')
          .not('certified_at', 'is', null)
          .order('version', { ascending: false }).limit(2000)
        if (versions.error) throw versions.error
        if (alive) {
          setNotes(selectCertifiedNoteCatalogue(
            roots, (versions.data ?? []) as CanonicalNoteVersion[],
          ))
          setTotalRoots(result.count ?? 0)
        }
      } catch (reason) {
        if (alive) setError(reason instanceof Error ? reason.message : 'Could not open certified notes.')
      } finally {
        if (alive) setLoading(false)
      }
    }
    return () => { alive = false; clearTimeout(timeout) }
  }, [grade, subject, search, page, router])

  function changeGrade(next: string) { setGrade(next); setPage(0) }
  function changeSubject(next: string) { setSubject(next); setPage(0) }
  function changeSearch(next: string) { setSearch(next); setPage(0) }

  return (
    <main style={{ maxWidth: 1080, margin: '0 auto', padding: '16px 14px 48px', display: 'grid', gap: 15 }}>
      <header>
        <h1 style={{ fontSize: 24, margin: '0 0 5px', color: '#203c2d' }}>Lesson Notes</h1>
        <p style={{ fontSize: 13, margin: 0, color: '#61756a' }}>
          Find curriculum-linked notes, manage your own notes or open a prepared lesson.
          No timetable or prepared lesson is needed to read published notes.
        </p>
      </header>
      <nav aria-label="Lesson Notes sections" style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {([
          ['browse', 'Curriculum notes'],
          ['mine', 'My notes'],
          ['prepared', 'Prepared lessons'],
        ] as const).map(([key, label]) => (
          <button type="button" key={key} aria-pressed={view === key} onClick={() => setView(key)}
            style={{ borderRadius: 999, minHeight: 42, padding: '9px 13px',
              border: '1px solid ' + (view === key ? '#17694a' : '#cbd9cf'),
              color: view === key ? '#11583b' : '#435e50', fontWeight: 700,
              background: view === key ? '#e8f5ec' : '#fff', cursor: 'pointer' }}>
            {label}
          </button>
        ))}
      </nav>

      {view === 'browse' && <>
        <section style={panel} aria-label="Find certified Lesson Notes">
          <label htmlFor="lesson-note-search" style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 6 }}>Search notes</label>
          <input id="lesson-note-search" type="search" value={search} onChange={event => changeSearch(event.target.value)}
            placeholder="Topic or note title, e.g. Time" style={field} />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 210px), 1fr))', gap: 10, marginTop: 12 }}>
            <label style={{ fontSize: 12, fontWeight: 700, color: '#49665a' }}>Grade
              <select value={grade} onChange={event => changeGrade(event.target.value)} style={{ ...field, marginTop: 5 }}>
                <option value="">All grades</option>
                {Array.from({ length: 12 }, (_, i) => i + 1).map(number =>
                  <option key={number} value={'Grade ' + number}>{'Grade ' + number}</option>)}
              </select>
            </label>
            <label style={{ fontSize: 12, fontWeight: 700, color: '#49665a' }}>Subject
              <input type="search" value={subject} onChange={event => changeSubject(event.target.value)}
                placeholder="All subjects" aria-label="Filter notes by subject"
                style={{ ...field, marginTop: 5 }} />
            </label>
          </div>
          <p style={{ fontSize: 11, color: '#61756a', margin: '9px 0 0' }}>
            Only released, certified notes appear. An outcome link is not proof of full curriculum reconciliation.
          </p>
        </section>

        <section style={{ display: 'grid', gap: 9 }} aria-label="Available certified notes">
          {loading && <p role="status">Checking the published notes library…</p>}
          {!loading && error && <div role="alert" style={{ ...panel, color: '#991b1b' }}>{error}</div>}
          {!loading && !error && notes.length === 0 && (
            <div role="status" style={panel}>
              <strong>No readable certified notes found in this selection.</strong>
              <p style={{ fontSize: 13, color: '#60746a', marginBottom: 8 }}>
                Try a broader search or another page. Unreleased manuscripts are intentionally hidden;
                the canonical learning library may contain other content types.
              </p>
              <Link href="/teacher/resources" style={{ color: '#17694a', fontWeight: 700 }}>Open Teaching Library</Link>
            </div>
          )}
          {!loading && !error && notes.map(note => (
            <article key={note.resourceId} style={panel}>
              <strong style={{ fontSize: 15, color: '#1f3e2d' }}>{note.title}</strong>
              <p style={{ fontSize: 12, color: '#64786d', margin: '5px 0' }}>
                {[note.grade, note.subject, note.kind === 'teacher_notes' ? 'Teacher notes' : 'Learner explanations']
                  .filter(Boolean).join(' · ')}
              </p>
              <p style={{ fontSize: 12, color: '#576f60', margin: '0 0 10px' }}>
                {note.curriculumOutcomeId ? 'Learning outcome linked'
                  : note.subStrandId ? 'Sub-strand linked · exact outcome not established'
                  : 'Curriculum outcome link not established'} · Certified version {note.version}
              </p>
              <Link href={'/teacher/resources/read/' + encodeURIComponent(note.resourceId) +
                '?versionId=' + encodeURIComponent(note.resourceVersionId)}
                style={{ display: 'inline-block', color: '#17694a', fontWeight: 750, fontSize: 13 }}>
                Read notes
              </Link>
            </article>
          ))}
          {!loading && !error && totalRoots > PAGE_SIZE && (
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'space-between' }}>
              <button type="button" disabled={page === 0} onClick={() => setPage(value => Math.max(0, value - 1))}
                style={{ ...field, width: 'auto', cursor: 'pointer' }}>Previous</button>
              <span style={{ fontSize: 12, color: '#61756a' }}>Page {page + 1} of {Math.ceil(totalRoots / PAGE_SIZE)}</span>
              <button type="button" disabled={(page + 1) * PAGE_SIZE >= totalRoots}
                onClick={() => setPage(value => value + 1)} style={{ ...field, width: 'auto', cursor: 'pointer' }}>Next</button>
            </div>
          )}
        </section>
      </>}

      {view === 'mine' && <section style={panel} aria-label="My saved Lesson Notes">
        <h2 style={{ fontSize: 17, marginTop: 0 }}>My Lesson Notes</h2>
        <p style={{ color: '#63776b', fontSize: 13 }}>
          Your own materials are edited in the existing Teaching Library. Private drafts are never treated as certified content.
        </p>
        <Link href="/teacher/resources#saved-teaching-resources" style={{ display: 'inline-block', fontSize: 13, fontWeight: 750, color: '#17694a', marginBottom: 12 }}>Create or manage my notes</Link>
        {myLoading && <p role="status">Opening your saved materials…</p>}
        {!myLoading && myError && <p role="alert" style={{ color: '#991b1b' }}>{myError}</p>}
        {!myLoading && !myError && myNotes.length === 0 && <p role="status">No saved notes yet. Use Create resource in the Teaching Library.</p>}
        {myNotes.map(note => (
          <div key={note.id} style={{ padding: '11px 0', borderTop: '1px solid #edf1ee' }}>
            <Link href={'/teacher/resources#saved-resource-' + encodeURIComponent(note.id)}
              style={{ fontSize: 14, fontWeight: 700, color: '#17694a' }}>{note.title}</Link>
            <div style={{ fontSize: 12, color: '#61756a', marginTop: 4 }}>
              {note.subject || 'Subject not set'} · {note.publication_status === 'shared' ? 'Shared' : 'Private draft'}
            </div>
          </div>
        ))}
      </section>}

      {view === 'prepared' && <section style={panel} aria-label="Open prepared lessons">
        <h2 style={{ marginTop: 0, fontSize: 17 }}>Open notes for a prepared lesson</h2>
        <p style={{ color: '#63776b', fontSize: 13 }}>Use an existing lesson plan to enter Teach mode. Unscheduled preparations are supported.</p>
        {preparedLessons ?? <p style={{ fontSize: 13 }}>
          <Link href="/teacher/subjecthub" style={{ color: '#17694a', fontWeight: 750 }}>Choose a subject and class</Link>
          {' · '}
          <Link href="/teacher/lessonplan" style={{ color: '#17694a', fontWeight: 750 }}>Open Lesson Plans</Link>
        </p>}
      </section>}
    </main>
  )
}
