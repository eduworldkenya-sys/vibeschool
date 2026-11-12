'use client'

import { useEffect, useState } from 'react'
import { UUID_RE } from '@/lib/visual-library/contract'
import { VisualLearningAsset } from '@/components/learn/VisualLearningAsset'

type Visual = { id: string; resourceVersionId: string; title: string }

/**
 * Supplemental source-linked diagrams for the already certified Lesson 4.
 * Only public, active, certified visual-library assets are fetched. Never
 * hardcodes image URLs, private object paths or an unpublished version ID.
 * When a newer certified manuscript includes visual tokens inline, it wins:
 * the supplemental panel is suppressed to prevent duplicate diagrams.
 */
export default function Grade4TimeVisualModels({
  lessonOrder, inlineVisualPresent = false,
}: { lessonOrder: number; inlineVisualPresent?: boolean }) {
  const [visuals, setVisuals] = useState<Visual[]>([])

  useEffect(() => {
    if (lessonOrder !== 4 || inlineVisualPresent) {
      setVisuals([])
      return
    }
    let active = true
    const controller = new AbortController()
    const query = new URLSearchParams({
      grade: '4', subject: 'Mathematics', topicKey: 'time-hours-minutes',
    })
    void fetch('/api/visual-library?' + query.toString(), {
      cache: 'no-store', signal: controller.signal,
    })
      .then(async response => {
        if (!response.ok) throw Error('no-published-visuals')
        return response.json()
      })
      .then(data => {
        if (!active) return
        const next = Array.isArray(data?.visuals) ? data.visuals : []
        setVisuals(next.filter((v: unknown): v is Visual => {
          if (!v || typeof v !== 'object') return false
          const row = v as Partial<Visual>
          return typeof row.id === 'string' && UUID_RE.test(row.id)
            && typeof row.resourceVersionId === 'string' && UUID_RE.test(row.resourceVersionId)
            && typeof row.title === 'string' && row.title.length > 0
        }).slice(0, 6))
      })
      .catch(() => { if (active) setVisuals([]) })
    return () => { active = false; controller.abort() }
  }, [lessonOrder, inlineVisualPresent])

  if (!visuals.length || lessonOrder !== 4 || inlineVisualPresent) return null

  return <section aria-label="Visual models for changing hours and minutes"
    style={{ padding: 18, background: '#f5faf7', border: '1px solid #cae3d5', borderRadius: 16, margin: '20px 0' }}>
    <h3 style={{ fontSize: 19, color: '#143c2c', margin: '0 0 8px' }}>See how hours and minutes work</h3>
    <p style={{ fontSize: 14, color: '#476253', lineHeight: 1.55 }}>
      Use these diagrams to check how complete hours and extra minutes are grouped.
    </p>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,260px),1fr))', gap: 15 }}>
      {visuals.map(visual => <div key={visual.id}>
        <p style={{ fontSize: 14, fontWeight: 700, color: '#214c38' }}>{visual.title}</p>
        <VisualLearningAsset id={visual.id} resourceVersionId={visual.resourceVersionId} />
      </div>)}
    </div>
  </section>
}
