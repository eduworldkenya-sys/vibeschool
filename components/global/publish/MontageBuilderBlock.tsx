'use client'

import { useId, useState } from 'react'
import type { ContentBlock } from '@/lib/publishTypes'

const positions = [
  { id: 'behind', label: 'Behind the player', description: 'The player’s foot covers part of the ball. The foot looks closer.' },
  { id: 'front', label: 'In front of the player', description: 'The ball covers part of the player’s foot. The ball looks closer.' },
] as const

const surface = 'var(--publication-surface, #132033)'
const border = 'var(--publication-border, #526179)'
const text = 'var(--publication-text, #f8fafc)'
const accent = 'var(--publication-accent, #ccff00)'
const onAccent = 'var(--publication-on-accent, #101820)'

export function MontageBuilderBlock({ block }: { block: ContentBlock }) {
  const headingId = useId()
  const [position, setPosition] = useState<(typeof positions)[number]>(positions[0])

  return (
    <section aria-labelledby={headingId} style={{ padding: 16, borderRadius: 16, border: `1px solid ${border}`, background: surface, color: text }}>
      <h3 id={headingId} style={{ margin: '0 0 8px' }}>{block.content || 'Montage Builder'}</h3>
      <p style={{ margin: '0 0 12px' }}>Change which cut-out is on top. Before you switch, predict which shape will look closer.</p>

      <div aria-hidden="true" data-montage-scene style={{
        position: 'relative', isolation: 'isolate', overflow: 'hidden', height: 160,
        background: 'linear-gradient(#dff3ff 0 65%, #a5d389 65%)', borderRadius: 10,
      }}>
        <div style={{ position: 'absolute', left: '50%', bottom: 25, width: 92, height: 106, transform: 'translateX(-62px)', zIndex: 2 }}>
          <span style={{ position: 'absolute', left: 18, top: 0, width: 25, height: 25, background: '#754023', borderRadius: '50%' }} />
          <span style={{ position: 'absolute', left: 12, top: 24, width: 42, height: 43, background: '#6339a0', borderRadius: 9 }} />
          <span style={{ position: 'absolute', left: 17, top: 63, width: 14, height: 38, background: '#31265d', transform: 'rotate(19deg)', borderRadius: 5 }} />
          <span style={{ position: 'absolute', left: 39, top: 64, width: 14, height: 34, background: '#31265d', transform: 'rotate(-27deg)', borderRadius: 5 }} />
          <span style={{ position: 'absolute', left: 46, top: 91, width: 34, height: 13, background: '#31265d', borderRadius: 5 }} />
        </div>
        <div data-montage-ball style={{
          position: 'absolute', left: '50%', bottom: 22, transform: 'translateX(5px)',
          width: 35, height: 35, boxSizing: 'border-box', borderRadius: '50%',
          border: '3px solid #783100', background: '#ffb348', zIndex: position.id === 'front' ? 3 : 1,
        }} />
      </div>

      <div aria-label="Ball position" role="group" style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
        {positions.map(option => {
          const selected = position.id === option.id
          return (
            <button key={option.id} type="button" aria-pressed={selected} onClick={() => setPosition(option)}
              style={{ flex: '1 1 145px', minHeight: 44, padding: '8px 12px', borderRadius: 8,
                border: `1px solid ${selected ? accent : border}`, background: selected ? accent : surface,
                color: selected ? onAccent : text, fontWeight: 700, cursor: 'pointer' }}>
              {option.label}
            </button>
          )
        })}
      </div>
      <p role="status" style={{ margin: '12px 0 6px' }}>{position.description}</p>
      <p style={{ margin: 0 }}>Try both positions. Which arrangement makes the ball easier to see? Explain how overlap changed the picture.</p>
    </section>
  )
}
