'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import {
  selectCanonicalLessonNotes,
  type CanonicalNoteLink,
  type CanonicalNoteRoot,
  type CanonicalNoteVersion,
} from '@/lib/teaching/canonicalLessonNotes'

/**
 * Existing library identities and certified versions only. No draft approval,
 * cross-tenant access, new publishing path, or guessed outcome mapping.
 */
export default function CanonicalLessonNotesPanel({
  outcomeId,
  subStrandId,
}: {
  outcomeId: string | null
  subStrandId: string | null
}) {
  const [notes, setNotes] = useState<CanonicalNoteLink[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let alive = true
    async function load() {
      setNotes([])
      setError('')
      if (!outcomeId && !subStrandId) return
      setLoading(true)
      try {
        const auth = await supabase.auth.getUser()
        if (auth.error || !auth.data.user) throw new Error('Sign in to read teaching resources.')

        // Exact outcomes take precedence. Sub-strand-only resources are
        // explicitly identified as related, never asserted as exact matches.
        const lookup = []
        if (outcomeId) lookup.push(
          supabase.from('learning_resources')
            .select('id,title,asset_kind,status,visibility,curriculum_outcome_id,sub_strand_id')
            .in('asset_kind', ['teacher_notes', 'learner_notes'])
            .eq('status', 'active').eq('visibility', 'public')
            .eq('curriculum_outcome_id', outcomeId).limit(50),
        )
        if (subStrandId) lookup.push(
          supabase.from('learning_resources')
            .select('id,title,asset_kind,status,visibility,curriculum_outcome_id,sub_strand_id')
            .in('asset_kind', ['teacher_notes', 'learner_notes'])
            .eq('status', 'active').eq('visibility', 'public')
            .eq('sub_strand_id', subStrandId)
            .is('curriculum_outcome_id', null).limit(50),
        )
        const results = await Promise.all(lookup)
        const roots = new Map<string, CanonicalNoteRoot>()
        for (const result of results) {
          if (result.error) throw result.error
          for (const root of (result.data ?? []) as CanonicalNoteRoot[]) roots.set(root.id, root)
        }
        if (roots.size === 0) return
        const versions = await supabase.from('learning_resource_versions')
          .select('id,resource_id,version,lifecycle_status,certified_at')
          .in('resource_id', Array.from(roots.keys()))
          .eq('lifecycle_status', 'certified')
          .not('certified_at', 'is', null)
          .order('version', { ascending: false }).limit(200)
        if (versions.error) throw versions.error
        if (alive) setNotes(selectCanonicalLessonNotes(
          Array.from(roots.values()),
          (versions.data ?? []) as CanonicalNoteVersion[],
          outcomeId, subStrandId,
        ))
      } catch (reason) {
        if (alive) setError(reason instanceof Error ? reason.message : 'The linked notes could not be loaded.')
      } finally {
        if (alive) setLoading(false)
      }
    }
    void load()
    return () => { alive = false }
  }, [outcomeId, subStrandId])

  if (!outcomeId && !subStrandId) return null
  const exact = notes.filter(note => note.scope === 'exact_outcome')
  const related = notes.filter(note => note.scope === 'related_sub_strand')
  function noteLink(note: CanonicalNoteLink) {
    return '/teacher/resources/read/' + encodeURIComponent(note.resourceId) +
      '?versionId=' + encodeURIComponent(note.resourceVersionId)
  }
  function renderLinks(group: CanonicalNoteLink[]) {
    return group.map(note => (
      <Link key={note.resourceId} href={noteLink(note)}
        style={{ display: 'block', padding: '10px 12px', borderRadius: 10, border: '1px solid #dbe5df', background: '#fff', color: '#175b43', textDecoration: 'none' }}>
        <strong>{note.title}</strong>
        <span style={{ display: 'block', marginTop: 4, fontSize: 12, color: '#52665d' }}>
          {note.kind === 'teacher_notes' ? 'Teacher Lesson Notes' : 'Learner learning content'} · certified version {note.version}
        </span>
      </Link>
    ))
  }

  return (
    <section aria-label="Released learning and teaching notes"
      style={{ padding: 16, margin: '12px 0', border: '1px solid #c7dace', borderRadius: 16, background: '#f2faf4' }}>
      <h2 style={{ fontSize: 17, margin: '0 0 5px', color: '#175b43' }}>Learning content & teacher Lesson Notes</h2>
      <p style={{ fontSize: 12, color: '#52665d', margin: '0 0 12px', lineHeight: 1.55 }}>
        One canonical resource library; teacher notes support teaching while learner notes explain the full lesson.
        Only released roots with certified versions are linked.
      </p>
      {loading && <p role="status">Checking certified notes…</p>}
      {error && <p role="alert" style={{ color: '#991b1b' }}>Cannot verify note availability: {error}</p>}
      {!loading && !error && exact.length === 0 && (
        <p style={{ fontSize: 13, margin: '6px 0 12px', color: '#52665d' }}>
          No released notes are directly linked to this exact learning outcome yet.
          The prepared Lesson Plan remains available below.
        </p>
      )}
      {exact.length > 0 && (
        <div style={{ display: 'grid', gap: 8, marginBottom: 12 }}>
          <strong style={{ fontSize: 13 }}>Verified outcome identity</strong>
          {renderLinks(exact)}
        </div>
      )}
      {related.length > 0 && (
        <div style={{ display: 'grid', gap: 8 }}>
          <strong style={{ fontSize: 13 }}>Related sub-strand resources — outcome mapping pending</strong>
          <p style={{ fontSize: 12, margin: 0, color: '#52665d' }}>
            These certified resources share the linked sub-strand, but have no exact outcome ID.
            Check suitability before teaching; their presence is not curriculum reconciliation evidence.
          </p>
          {renderLinks(related)}
        </div>
      )}
      {!loading && !error && notes.length === 0 && (
        <Link href="/teacher/resources" style={{ color: '#175b43', fontWeight: 700, fontSize: 13 }}>
          Open Teaching Library
        </Link>
      )}
    </section>
  )
}
