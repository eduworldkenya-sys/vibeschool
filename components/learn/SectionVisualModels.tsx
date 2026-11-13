'use client'

import { useEffect, useState } from 'react'
import { UUID_RE } from '@/lib/visual-library/contract'
import { VisualLearningAsset } from '@/components/learn/VisualLearningAsset'

export type LessonVisualContext = {
  grade: string
  subject: string
  topicKey: string
  /** Curriculum source ID validated by the authorising lesson caller. */
  sourceStrandId: string
}

type Entry = {
  id: string
  resourceVersionId: string
  title: string
  sourceStrandId: string
  topicKey: string
  placements: string[]
}

export function sectionVisualPlacement(id: string, tone?: string): string | null {
  if (id === 'example' || id === 'worked_example' || tone === 'example') return 'worked_example'
  if (id === 'understand' || id === 'explanation' || tone === 'learn') return 'explanation'
  if (id === 'activity' || tone === 'explore') return 'activity'
  return null
}

/** Certified visual matching an explicitly authorised topic, source strand and section. */
export default function SectionVisualModels({ context, sectionId, sectionTone, suppress = false }: {
  context: LessonVisualContext
  sectionId: string
  sectionTone?: string
  suppress?: boolean
}) {
  const [visuals, setVisuals] = useState<Entry[]>([])
  const placement = sectionVisualPlacement(sectionId,sectionTone)
  const { grade, subject, topicKey, sourceStrandId } = context

  useEffect(() => {
    setVisuals([])
    if (suppress || !placement || !UUID_RE.test(sourceStrandId) || !grade || !subject || !topicKey) return
    let active = true
    const controller = new AbortController()
    const query = new URLSearchParams({
      grade, subject, topicKey, sourceStrandId, placement, page:'1',
    })
    void fetch('/api/visual-library?' + query.toString(), { cache:'no-store', signal:controller.signal })
      .then(async response => {
        if (!response.ok) throw new Error('visuals unavailable')
        return response.json() as Promise<{visuals?: Entry[]}>
      })
      .then(result => {
        if (!active) return
        const rows = Array.isArray(result.visuals) ? result.visuals : []
        setVisuals(rows.filter((row): row is Entry => Boolean(row)
          && UUID_RE.test(row.id) && UUID_RE.test(row.resourceVersionId)
          && row.sourceStrandId === sourceStrandId && row.topicKey === topicKey
          && Array.isArray(row.placements) && row.placements.includes(placement)).slice(0,4))
      })
      .catch(() => { if (active) setVisuals([]) })
    return () => { active = false; controller.abort() }
  }, [grade,subject,topicKey,sourceStrandId,placement,suppress])

  if (!placement || !visuals.length || suppress) return null
  return <aside aria-label="Illustrations for this section"
    style={{margin:'16px 0',padding:15,border:'1px solid #cce5d4',borderRadius:14,background:'#f5faf7'}}>
    <h4 style={{fontSize:16,margin:'0 0 10px',color:'#174a32'}}>
      {placement === 'worked_example' ? 'See the worked example' : 'See it clearly'}
    </h4>
    <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(min(100%,260px),1fr))',gap:13}}>
      {visuals.map(visual => <div key={visual.id}>
        <strong style={{fontSize:13,color:'#28543d'}}>{visual.title}</strong>
        <VisualLearningAsset id={visual.id} resourceVersionId={visual.resourceVersionId} />
      </div>)}
    </div>
  </aside>
}
