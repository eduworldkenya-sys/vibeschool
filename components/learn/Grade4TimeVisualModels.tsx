'use client'

import { useEffect, useState } from 'react'
import { UUID_RE } from '@/lib/visual-library/contract'
import { VisualLearningAsset } from '@/components/learn/VisualLearningAsset'

type Visual = {
  id: string
  resourceVersionId: string
  title: string
  placements: string[]
  sourceStrandId: string
}

const GRADE4_TIME_SUBSTRAND_ID = 'e975dcc6-32a9-4274-a2a3-3d19e409cf5c'
const placementForSection: Record<string, string> = {
  understand: 'explanation',
  example: 'worked_example',
}

/**
 * Existing public certified visual-library catalogue, positioned by its
 * authoring metadata beside the actual lesson section. No stored content,
 * private image URLs or certification flags are changed.
 */
export default function Grade4TimeVisualModels({
  lessonOrder, sectionId, inlineVisualPresent = false,
}: {
  lessonOrder: number
  sectionId: string
  inlineVisualPresent?: boolean
}) {
  const [visuals, setVisuals] = useState<Visual[]>([])
  const placement = placementForSection[sectionId] ?? ''

  useEffect(() => {
    if (lessonOrder !== 4 || inlineVisualPresent || !placement) {
      setVisuals([])
      return
    }
    let active = true
    const controller = new AbortController()
    const query = new URLSearchParams({
      grade: '4', subject: 'Mathematics', topicKey: 'time-hours-minutes',
    })
    void fetch('/api/visual-library?' + query.toString(), { cache: 'no-store', signal: controller.signal })
      .then(async response => {
        if (!response.ok) throw new Error('public visual catalogue unavailable')
        return response.json() as Promise<{ visuals?: unknown }>
      })
      .then(data => {
        if (!active) return
        const entries = Array.isArray(data?.visuals) ? data.visuals : []
        setVisuals(entries.filter((entry: unknown): entry is Visual => {
          if (!entry || typeof entry !== 'object') return false
          const row = entry as Partial<Visual>
          return typeof row.id === 'string' && UUID_RE.test(row.id)
            && typeof row.resourceVersionId === 'string' && UUID_RE.test(row.resourceVersionId)
            && typeof row.title === 'string' && row.title.trim().length > 0
            && row.sourceStrandId === GRADE4_TIME_SUBSTRAND_ID
            && Array.isArray(row.placements) && row.placements.includes(placement)
        }).slice(0, 6))
      })
      .catch(() => { if (active) setVisuals([]) })
    return () => { active = false; controller.abort() }
  }, [lessonOrder, inlineVisualPresent, placement])

  if (!placement || !visuals.length || lessonOrder !== 4 || inlineVisualPresent) return null

  return <aside aria-label={sectionId === 'example' ? 'Worked example illustrations' : 'Explanation illustrations'}
    style={{ padding: 16, background: '#f5faf7', border: '1px solid #cae3d5', borderRadius: 14, margin: '16px 0' }}>
    <h4 style={{ fontSize: 17, color: '#143c2c', margin: '0 0 10px' }}>
      {sectionId === 'example' ? 'See the worked example' : 'See how the time units work'}
    </h4>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,260px),1fr))', gap: 15 }}>
      {visuals.map(visual => <div key={visual.id}>
        <p style={{ fontSize: 14, fontWeight: 700, color: '#214c38' }}>{visual.title}</p>
        <VisualLearningAsset id={visual.id} resourceVersionId={visual.resourceVersionId} />
      </div>)}
    </div>
  </aside>
}
