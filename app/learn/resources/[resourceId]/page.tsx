'use client'
export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { useParams, useSearchParams } from 'next/navigation'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import PlaceValueResourceStudio, {
  isPlaceValueStudioPayload,
  type PlaceValueStudioPayload,
} from '@/components/learn/PlaceValueResourceStudio'

type ReleasedResource = {
  title: string
  grade: string
  subject: string
  payload: PlaceValueStudioPayload
}
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const linkStyle: React.CSSProperties = {
  border: '1px solid var(--vs-border, #c9d8cd)', borderRadius: 10, padding: '11px 13px',
  display: 'inline-flex', alignItems: 'center', color: 'var(--vs-text, #1b3b2b)',
  textDecoration: 'none', fontWeight: 650, minHeight: 44, boxSizing: 'border-box',
}

/** Public learner read: active root AND exact certified version; never candidates. */
export default function CertifiedInteractiveResourcePage() {
  const params = useParams()
  const search = useSearchParams()
  const id = typeof params.resourceId === 'string' ? params.resourceId : ''
  const versionId = search.get('versionId') ?? ''
  const [resource, setResource] = useState<ReleasedResource | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    setResource(null)
    setLoading(true)
    setError('')
    async function load() {
      try {
        if (!UUID.test(id) || !UUID.test(versionId)) throw new Error('This resource link is incomplete.')
        const { data: root, error: rootError } = await supabase.from('learning_resources')
          .select('id,title,grade,subject,status,visibility,owner_type,asset_kind,material_variant')
          .eq('id', id).eq('status', 'active').eq('visibility', 'public')
          .eq('owner_type', 'platform').eq('asset_kind', 'practical')
          .eq('material_variant', 'demonstration').maybeSingle()
        if (rootError) throw rootError
        if (!root) throw new Error('This learning resource has not been released.')

        const { data: version, error: versionError } = await supabase.from('learning_resource_versions')
          .select('id,resource_id,payload,lifecycle_status,certified_at')
          .eq('id', versionId).eq('resource_id', root.id)
          .eq('lifecycle_status', 'certified').not('certified_at', 'is', null).maybeSingle()
        if (versionError) throw versionError
        if (!version || !isPlaceValueStudioPayload(version.payload))
          throw new Error('The certified interactive lesson is unavailable.')
        if (active) setResource({
          title: root.title,
          grade: root.grade || 'Grade 4',
          subject: root.subject || 'Mathematics',
          payload: version.payload,
        })
      } catch (reason) {
        if (active) setError(reason instanceof Error ? reason.message : 'Unable to open resource.')
      } finally {
        if (active) setLoading(false)
      }
    }
    void load()
    return () => { active = false }
  }, [id, versionId])

  const back = resource ? '/learn?' + new URLSearchParams({ grade: resource.grade, subject: resource.subject }).toString() : '/learn'
  return <main style={{ minHeight: '100dvh', padding: '24px 14px 72px', background: 'var(--vs-bg, #f3f7f4)', color: 'var(--vs-text, #173d2b)' }}>
    <article style={{ maxWidth: 820, margin: '0 auto', display: 'grid', gap: 18 }}>
      <Link href={back} style={{ ...linkStyle, justifySelf: 'start' }}>← Mathematics resources</Link>
      {loading && <p role="status">Checking the released lesson resource…</p>}
      {!loading && error && <p role="alert" style={{ padding: 16, borderRadius: 12, background: 'var(--vs-card, #fff)' }}>{error}</p>}
      {resource && <>
        <header>
          <p style={{ color: 'var(--vs-muted, #576b60)', fontSize: 13, margin: '0 0 6px' }}>{resource.grade} · {resource.subject} · Whole Numbers · Lesson 1</p>
          <h1 style={{ fontSize: 'clamp(22px, 5vw, 32px)', margin: 0 }}>{resource.title}</h1>
        </header>
        <PlaceValueResourceStudio payload={resource.payload}/>
        <aside style={{ padding: 16, borderRadius: 14, border: '1px solid var(--vs-border, #c9d8cd)', background: 'var(--vs-card, #fff)' }}>
          <h2 style={{ fontSize: 18, margin: '0 0 6px' }}>Ready to practise?</h2>
          <p style={{ fontSize: 14, lineHeight: 1.6, color: 'var(--vs-muted, #576b60)' }}>
            The exploration game gives practice feedback but is not a scored assessment.
            Saved answers, results and mistake recovery belong to VibeSchool's normal topic-practice system.
          </p>
          <nav aria-label="Continue learning" style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Link style={linkStyle} href="/student/vibelearn/topic-practice?subject=Mathematics&topic=Place%20Value%20%26%20Total%20Value">Topic practice →</Link>
            <Link style={linkStyle} href="/student/vibelearn/mistakes">My Mistakes</Link>
            <Link style={linkStyle} href="/student/vibelearn/topic-practice/progress">My Progress</Link>
          </nav>
        </aside>
      </>}
    </article>
  </main>
}
