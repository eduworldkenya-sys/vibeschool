'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { LIVE_LEARNER_ASSET_KINDS, LIVE_SCHOOL_GRADE_LABELS, liveResourcePages, readableLiveResourceText } from '@/lib/live/resourcePresentation'
import styles from './LiveResourcePicker.module.css'

type ResourceChoice = {
  id: string
  title: string
  subject: string | null
  grade: string | null
  source: 'certified' | 'class'
  schemeLessonId?: string
  schemeTopic?: string
  pinnedVersionId?: string | null
}
type Selected = { item: ResourceChoice; pages: string[]; version: string | null }
type SchemeRow = { id: string; topic: string | null }
type SchemeLink = { scheme_lesson_id: string | null; resource_id: string | null; resource_version_id: string | null }
type ReleasedRoot = { id: string; title: string; subject: string | null; grade: string | null }

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
  const [schemeWarning, setSchemeWarning] = useState('')
  const [selected, setSelected] = useState<Selected | null>(null)
  const [page, setPage] = useState(0)
  const request = useRef(0)

  useEffect(() => {
    let alive = true
    setLoading(true)
    setItems([])
    setSelected(null)
    setError('')
    setSchemeWarning('')
    async function fetchLibrary() {
      try {
        const auth = await supabase.auth.getUser()
        if (auth.error || !auth.data.user) throw new Error('Sign in to select teaching resources.')
        const canonical = await supabase.from('learning_resources')
          .select('id,title,subject,grade,asset_kind')
          .eq('status', 'active').eq('visibility', 'public')
          .in('asset_kind', [...LIVE_LEARNER_ASSET_KINDS])
          .in('grade', LIVE_SCHOOL_GRADE_LABELS)
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
        // Prepared for this exact school class: discover only the teacher's
        // existing Scheme links. Neither titles nor subjects grant linkage.
        const prepared: ResourceChoice[] = []
        if (classId) {
          try {
            const schemeResult = await supabase.from('scheme_of_work')
              .select('id,topic').eq('teacher_id', auth.data.user.id)
              .eq('class_id', classId).limit(150)
            if (schemeResult.error) throw schemeResult.error
            const schemes = (schemeResult.data ?? []) as SchemeRow[]
            if (schemes.length) {
              const linksResult = await supabase.from('teaching_resource_links')
                .select('scheme_lesson_id,resource_id,resource_version_id')
                .eq('target_type', 'scheme_lesson')
                .in('scheme_lesson_id', schemes.map(s => s.id)).limit(300)
              if (linksResult.error) throw linksResult.error
              const links = (linksResult.data ?? []) as SchemeLink[]
              const ids = [...new Set(links.flatMap(l => l.resource_id ? [l.resource_id] : []))]
              const roots = ids.length
                ? await supabase.from('learning_resources')
                    .select('id,title,subject,grade,asset_kind')
                    .in('id', ids).eq('status', 'active').eq('visibility', 'public')
                    .in('asset_kind', [...LIVE_LEARNER_ASSET_KINDS])
                    .in('grade', LIVE_SCHOOL_GRADE_LABELS)
                : { data: [], error: null }
              if (roots.error) throw roots.error
              const released = (roots.data ?? []) as ReleasedRoot[]
              const byId = new Map<string, ReleasedRoot>(released.map(r => [r.id, r] as const))
              const byScheme = new Map<string, SchemeRow>(schemes.map(s => [s.id, s] as const))
              const seen = new Set<string>()
              for (const link of links) {
                if (!link.resource_id || !link.scheme_lesson_id) continue
                const root = byId.get(link.resource_id), scheme = byScheme.get(link.scheme_lesson_id)
                if (!root || !scheme) continue
                const key = link.scheme_lesson_id + ':' + link.resource_id + ':' + (link.resource_version_id ?? '')
                if (seen.has(key)) continue
                seen.add(key)
                prepared.push({
                  id: root.id, title: root.title, subject: root.subject,
                  grade: root.grade, source: 'certified',
                  schemeLessonId: scheme.id, schemeTopic: scheme.topic?.trim() || 'Linked Scheme lesson',
                  pinnedVersionId: link.resource_version_id,
                })
              }
            }
          } catch {
            // No unsafe fallback to a guessed lesson association. Unlinked
            // certified resources remain usable through the existing picker.
            if (alive) setSchemeWarning('Linked Scheme resources are unavailable. You can still browse released materials.')
          }
        }
        const preparedIds = new Set(prepared.map(item => item.id))
        if (alive) setItems([...prepared, ...safe.filter(item => item.source !== 'certified' || !preparedIds.has(item.id))])
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
    return needle ? items.filter(item => [item.title, item.subject ?? '', item.grade ?? '', item.schemeTopic ?? '']
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
        if (item.schemeLessonId) {
          if (!classId) throw new Error('This Scheme resource requires its original school class.')
          // Fresh authority check: a previous picker snapshot cannot authorize
          // a stale or replaced Scheme link.
          const scheme = await supabase.from('scheme_of_work')
            .select('id').eq('id', item.schemeLessonId)
            .eq('teacher_id', auth.data.user.id).eq('class_id', classId).maybeSingle()
          if (scheme.error) throw scheme.error
          if (!scheme.data) throw new Error('The Scheme lesson no longer belongs to this class.')
          let linkQuery = supabase.from('teaching_resource_links')
            .select('resource_id').eq('target_type', 'scheme_lesson')
            .eq('scheme_lesson_id', item.schemeLessonId).eq('resource_id', item.id)
          linkQuery = item.pinnedVersionId
            ? linkQuery.eq('resource_version_id', item.pinnedVersionId)
            : linkQuery.is('resource_version_id', null)
          const link = await linkQuery.limit(1).maybeSingle()
          if (link.error) throw link.error
          if (!link.data) throw new Error('This Scheme resource link is no longer available.')
        }
        // Resolve the active public root again; never trust a stale list item.
        const root = await supabase.from('learning_resources')
          .select('id,asset_kind')
          .eq('id', item.id).eq('status', 'active').eq('visibility', 'public')
          .in('asset_kind', [...LIVE_LEARNER_ASSET_KINDS])
          .in('grade', LIVE_SCHOOL_GRADE_LABELS).maybeSingle()
        if (root.error) throw root.error
        if (!root.data) throw new Error('The resource is not released for learner presentation.')
        let versionQuery = supabase.from('learning_resource_versions')
          .select('id,resource_id,version,payload')
          .eq('resource_id', root.data.id)
          .eq('lifecycle_status', 'certified')
          .in('rights_status', ['cleared', 'not_applicable'])
          .not('certified_at', 'is', null)
        if (item.pinnedVersionId) versionQuery = versionQuery.eq('id', item.pinnedVersionId)
        const result = await versionQuery.order('version', { ascending: false }).limit(1).maybeSingle()
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
    {schemeWarning && <p role="status" className={styles.warning}>{schemeWarning}</p>}
    <div className={styles.layout}>
      <div className={styles.library}>
        <label>Search resources
          <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Topic, subject or grade" />
        </label>
        {loading ? <p role="status">Loading available resources…</p> :
          filtered.length === 0 ? <p>No released text resources found for this search.</p> :
          <ul>{filtered.map(item => <li key={item.source + ':' + item.id + ':' + (item.schemeLessonId ?? '')}>
            <button type="button" disabled={opening} aria-pressed={selected?.item.id === item.id && selected?.item.schemeLessonId === item.schemeLessonId} onClick={() => void open(item)}>
              <strong>{item.title}</strong>
              <small>{item.schemeLessonId ? 'Prepared · ' + item.schemeTopic : item.source === 'class' ? 'Shared class resource' : 'Certified resource'} · {[item.grade, item.subject].filter(Boolean).join(' · ')}</small>
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
