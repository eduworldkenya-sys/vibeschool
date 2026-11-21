'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { LIVE_LEARNER_ASSET_KINDS, liveResourcePages, readableLiveResourceText } from '@/lib/live/resourcePresentation'
import styles from './LiveResourcePicker.module.css'

type ResourceChoice = {
  id: string
  title: string
  subject: string | null
  grade: string | null
  source: 'certified' | 'class'
}
type Selected = { item: ResourceChoice; pages: string[]; version: string | null }

export function LiveResourcePicker({
  classId, canPresent, onPresent, onClose,
}: {
  classId: string | null
  canPresent: boolean
  onPresent: (body: string) => void
  onClose: () => void
}) {
  const [items, setItems] = useState<ResourceChoice[]>([])
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [opening, setOpening] = useState(false)
  const [error, setError] = useState('')
  const [selected, setSelected] = useState<Selected | null>(null)
  const [page, setPage] = useState(0)
  const request = useRef(0)

  useEffect(() => {
    let alive = true
    setLoading(true)
    setItems([])
    setSelected(null)
    setError('')
    async function fetchLibrary() {
      try {
        const auth = await supabase.auth.getUser()
        if (auth.error || !auth.data.user) throw new Error('Sign in to select teaching resources.')
        const canonical = await supabase.from('learning_resources')
          .select('id,title,subject,grade,asset_kind')
          .eq('status', 'active').eq('visibility', 'public')
          .in('asset_kind', [...LIVE_LEARNER_ASSET_KINDS])
          .order('updated_at', { ascending: false }).limit(80)
        if (canonical.error) throw canonical.error
        const safe: ResourceChoice[] = (canonical.data ?? []).map(r => ({
          id: r.id, title: r.title, subject: r.subject, grade: r.grade, source: 'certified' as const,
        }))
        // Teacher-owned supplementary material is school/class scoped. An
        // accepted tuition invitation is NOT permission to copy school files.
        if (classId) {
          const classMaterials = await supabase.from('resources')
            .select('id,title,subject')
            .eq('teacher_id', auth.data.user.id)
            .eq('class_id', classId)
            .eq('publication_status', 'shared')
            .not('content', 'is', null).limit(80)
          if (classMaterials.error) throw classMaterials.error
          safe.push(...(classMaterials.data ?? []).map(r => ({
            id: r.id, title: r.title, subject: r.subject, grade: null, source: 'class' as const,
          })))
        }
        if (alive) setItems(safe)
      } catch (reason) {
        if (alive) setError(reason instanceof Error ? reason.message : 'Could not load teaching resources.')
      } finally {
        if (alive) setLoading(false)
      }
    }
    void fetchLibrary()
    return () => { alive = false; request.current++ }
  }, [classId])

  const filtered = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase()
    return needle ? items.filter(item => [item.title, item.subject ?? '', item.grade ?? '']
      .some(value => value.toLocaleLowerCase().includes(needle))) : items
  }, [items, query])

  async function open(item: ResourceChoice) {
    const id = ++request.current
    setOpening(true)
    setSelected(null)
    setPage(0)
    setError('')
    try {
      const auth = await supabase.auth.getUser()
      if (auth.error || !auth.data.user) throw new Error('Sign in to use teaching resources.')
      let body = ''
      let version: string | null = null
      if (item.source === 'class') {
        if (!classId) throw new Error('School material requires its original class.')
        const result = await supabase.from('resources')
          .select('id,content')
          .eq('id', item.id)
          .eq('teacher_id', auth.data.user.id)
          .eq('class_id', classId)
          .eq('publication_status', 'shared')
          .maybeSingle()
        if (result.error) throw result.error
        if (!result.data) throw new Error('This class resource is no longer shared.')
        body = result.data.content ?? ''
      } else {
        // Resolve the active public root again; never trust a stale list item.
        const root = await supabase.from('learning_resources')
          .select('id,asset_kind')
          .eq('id', item.id).eq('status', 'active').eq('visibility', 'public')
          .in('asset_kind', [...LIVE_LEARNER_ASSET_KINDS]).maybeSingle()
        if (root.error) throw root.error
        if (!root.data) throw new Error('The resource is not released for learner presentation.')
        const result = await supabase.from('learning_resource_versions')
          .select('id,resource_id,version,payload')
          .eq('resource_id', root.data.id)
          .eq('lifecycle_status', 'certified')
          .in('rights_status', ['cleared', 'not_applicable'])
          .not('certified_at', 'is', null)
          .order('version', { ascending: false }).limit(1).maybeSingle()
        if (result.error) throw result.error
        if (!result.data) throw new Error('No authorized certified version is available.')
        body = readableLiveResourceText(result.data.payload)
        version = result.data.id
      }
      const pages = liveResourcePages(item.title, body)
      if (!pages.length) throw new Error('This material has no presentable text or exceeds 30 pages. Open it in Resources instead.')
      if (request.current === id) setSelected({ item, pages, version })
    } catch (reason) {
      if (request.current === id) setError(reason instanceof Error ? reason.message : 'Could not open this resource.')
    } finally {
      if (request.current === id) setOpening(false)
    }
  }

  return <section className={styles.picker} aria-label="Classroom resources">
    <div className={styles.toolbar}>
      <strong>Resources</strong>
      <span>Certified learning materials{classId ? ' and shared class resources' : ''}</span>
      <button type="button" onClick={onClose}>Return to lesson</button>
    </div>
    {error && <p role="alert" className={styles.error}>{error}</p>}
    <div className={styles.layout}>
      <div className={styles.library}>
        <label>Search resources
          <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Topic, subject or grade" />
        </label>
        {loading ? <p role="status">Loading available resources…</p> :
          filtered.length === 0 ? <p>No released text resources found for this search.</p> :
          <ul>{filtered.map(item => <li key={item.source + ':' + item.id}>
            <button type="button" disabled={opening} aria-pressed={selected?.item.id === item.id} onClick={() => void open(item)}>
              <strong>{item.title}</strong>
              <small>{item.source === 'class' ? 'Shared class resource' : 'Certified resource'} · {[item.grade, item.subject].filter(Boolean).join(' · ')}</small>
            </button>
          </li>)}</ul>}
      </div>
      <div className={styles.preview}>
        {opening ? <p role="status">Opening certified material…</p> : selected ?
          <>
            <strong>{selected.item.title}</strong>
            <small>{selected.version ? 'Pinned certified version · ' : 'Shared class text · '}{page + 1} / {selected.pages.length}</small>
            <article aria-label="Selected resource page">{selected.pages[page]}</article>
            <div className={styles.actions}>
              <button type="button" disabled={page === 0} onClick={() => setPage(n => n - 1)}>Previous</button>
              <button type="button" disabled={page === selected.pages.length - 1} onClick={() => setPage(n => n + 1)}>Next</button>
              <button type="button" className={styles.primary} disabled={!canPresent} onClick={() => onPresent(selected.pages[page])}>Present this page</button>
            </div>
            <small>Presentation creates a learner-visible snapshot in Live history. Private drafts and teacher notes are not available here.</small>
          </> :
          <p>Select a resource to preview its readable pages. Only an explicit Present action shares a page.</p>}
      </div>
    </div>
  </section>
}
