'use client'
export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { useParams, useSearchParams } from 'next/navigation'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

type ReadableResource = {
  title: string
  grade: string | null
  subject: string | null
  body: string
  version: number
  sourceType: string | null
}

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function readableBody(payload: unknown): string {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return ''
  const value = payload as Record<string, unknown>
  const first = typeof value.content_text === 'string' ? value.content_text.trim() : ''
  const fallback = typeof value.body === 'string' ? value.body.trim() : ''
  return first || fallback
}

/**
 * This view reads one immutable certified version through existing Supabase
 * authenticated SELECT/RLS. It cannot load candidates, unpublished roots or
 * another tenant's private resource. It never promotes or modifies a version.
 */
export default function TeachingLibraryReaderPage() {
  const params = useParams()
  const search = useSearchParams()
  const resourceId = typeof params.resourceId === 'string' ? params.resourceId : ''
  const versionId = search.get('versionId') ?? ''
  const [resource, setResource] = useState<ReadableResource | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let alive = true
    async function load() {
      setResource(null)
      setError('')
      setLoading(true)
      try {
        if (!uuid.test(resourceId) || !uuid.test(versionId)) throw new Error('This resource link is incomplete.')
        const auth = await supabase.auth.getUser()
        if (auth.error || !auth.data.user) throw new Error('Sign in to Teacher OS to read this resource.')
        const { data: root, error: rootError } = await supabase.from('learning_resources')
          .select('id,title,grade,subject,source_type,status,visibility')
          .eq('id', resourceId).eq('status', 'active').eq('visibility', 'public').maybeSingle()
        if (rootError) throw rootError
        if (!root) throw new Error('This resource is not released or is not available to your account.')

        const { data: version, error: versionError } = await supabase.from('learning_resource_versions')
          .select('id,resource_id,version,lifecycle_status,certified_at,payload')
          .eq('id', versionId).eq('resource_id', root.id)
          .eq('lifecycle_status', 'certified').not('certified_at', 'is', null).maybeSingle()
        if (versionError) throw versionError
        if (!version) throw new Error('The certified version is unavailable or you do not have access.')

        const body = readableBody(version.payload)
        if (!body) throw new Error('This certified resource has no readable text. Open its linked Scheme for another activity.')
        if (alive) setResource({ title: root.title, grade: root.grade, subject: root.subject, body, version: version.version, sourceType: root.source_type })
      } catch (reason) {
        if (alive) setError(reason instanceof Error ? reason.message : 'Unable to open this resource.')
      } finally {
        if (alive) setLoading(false)
      }
    }
    void load()
    return () => { alive = false }
  }, [resourceId, versionId])

  return (
    <main style={{ minHeight: '100vh', background: 'var(--teacher-canvas, #f5f7f4)', padding: '20px 14px 60px' }}>
      <article style={{ maxWidth: 800, margin: '0 auto', background: '#fff', padding: 'clamp(18px, 4vw, 36px)', borderRadius: 16, border: '1px solid #e2e8e4' }}>
        <Link href="/teacher/resources" style={{ color: '#17674e', fontSize: 14, display: 'inline-block', marginBottom: 18 }}>← Teaching Library</Link>
        {loading && <p role="status">Opening the certified learning resource…</p>}
        {!loading && error && <div role="alert" style={{ color: '#991b1b', padding: 16, borderRadius: 10, background: '#fff7f7' }}>{error}</div>}
        {!loading && resource && (
          <>
            <div style={{ fontSize: 12, color: '#166348', fontWeight: 700 }}>{resource.sourceType === 'platform_authored' ? 'VibeSchool Originals' : 'Certified teaching resource'} · Version {resource.version}</div>
            <h1 style={{ fontSize: 'clamp(22px, 3.5vw, 30px)', lineHeight: 1.25, margin: '10px 0' }}>{resource.title}</h1>
            <p style={{ color: '#64748b', marginBottom: 24, fontSize: 13 }}>{[resource.grade, resource.subject].filter(Boolean).join(' · ')}</p>
            <div style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', lineHeight: 1.8, fontSize: 16, color: '#24332b' }}>{resource.body}</div>
          </>
        )}
      </article>
    </main>
  )
}
