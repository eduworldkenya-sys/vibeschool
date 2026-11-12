'use client'

import { useEffect, useState } from 'react'
import { UUID_RE, VISUAL_TOKEN_RE } from '@/lib/visual-library/contract'

type PublicVisual = {
  id: string; title: string; altText: string; caption: string; src: string; grade: string | null; subject: string | null
}

/** Certified resource resolver. Private/draft visuals are never returned by the public API. */
export function VisualLearningAsset({ id }: { id: string }) {
  const [visual, setVisual] = useState<PublicVisual | null>(null)
  const [state, setState] = useState<'loading' | 'ready' | 'unavailable'>('loading')
  useEffect(() => {
    if (!UUID_RE.test(id)) { setState('unavailable'); return }
    let alive = true
    setState('loading')
    setVisual(null)
    const controller = new AbortController()
    void fetch('/api/visual-library/' + encodeURIComponent(id), { signal: controller.signal, cache: 'no-store' })
      .then(async r => { if (!r.ok) throw Error('not-public'); return r.json() as Promise<PublicVisual> })
      .then(v => { if (alive) { setVisual(v); setState('ready') } })
      .catch(() => { if (alive) setState('unavailable') })
    return () => { alive = false; controller.abort() }
  }, [id])
  if (state === 'loading') return <span role="status" style={{ color: '#62756a' }}>Loading illustration…</span>
  if (state !== 'ready' || !visual) return <span role="status" style={{ color: '#697b73' }}>Illustration not available.</span>
  return (
    <figure style={{ margin: '16px 0', padding: 12, border: '1px solid #dce7dd', borderRadius: 12, background: '#fff' }}>
      <img src={visual.src} alt={visual.altText} loading="lazy"
        style={{ maxWidth: '100%', height: 'auto', display: 'block', margin: 'auto', borderRadius: 8 }} />
      {visual.caption && <figcaption style={{ marginTop: 9, color: '#526558', fontSize: 13, lineHeight: 1.5 }}>{visual.caption}</figcaption>}
    </figure>
  )
}

/** Embeds [visual:UUID] inside certified lesson body without hardcoded image URLs. */
export function VisualRichText({ body, style }: { body: string; style?: React.CSSProperties }) {
  const parts = body.split(VISUAL_TOKEN_RE)
  return <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.8, overflowWrap: 'anywhere', ...style }}>
    {parts.map((part, index) => index % 2 === 1 && UUID_RE.test(part)
      ? <VisualLearningAsset id={part} key={index} />
      : <span key={index}>{part}</span>)}
  </div>
}
