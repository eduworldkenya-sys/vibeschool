"use client"

import React, { useState } from 'react'
import { BlockType, PublicationFormat } from '@/lib/publishTypes'

const ACCENT = '#CCFF00'
const SURF   = '#111827'
const MUTED  = 'rgba(255,255,255,0.4)'
const BORDER = 'rgba(255,255,255,0.06)'
const TEXT   = '#ffffff'

type BlockGroup = {
  label: string
  blocks: { type: BlockType; label: string; icon: string }[]
}

const GROUPS: BlockGroup[] = [
  {
    label: 'Write',
    blocks: [
      { type: 'paragraph', label: 'Text', icon: '¶' },
      { type: 'heading1', label: 'H1', icon: 'H1' },
      { type: 'heading2', label: 'H2', icon: 'H2' },
      { type: 'heading3', label: 'H3', icon: 'H3' },
      { type: 'definition', label: 'Definition', icon: 'D' },
      { type: 'example', label: 'Example', icon: 'Ex' },
      { type: 'workedExample', label: 'Worked', icon: '✓' },
      { type: 'summary', label: 'Summary', icon: 'Σ' },
      { type: 'keyPoints', label: 'Key points', icon: '★' },
    ],
  },
  {
    label: 'Visual',
    blocks: [
      { type: 'image', label: 'Image', icon: '🖼' },
      { type: 'diagram', label: 'Diagram', icon: '◉' },
      { type: 'table', label: 'Table', icon: '▦' },
      { type: 'equation', label: 'Equation', icon: '∑' },
      { type: 'video', label: 'Video', icon: '▶' },
      { type: 'audio', label: 'Audio', icon: '♪' },
      { type: 'model3d', label: '3D model', icon: '⬡' },
      { type: 'simulation', label: 'Simulation', icon: '↻' },
    ],
  },
  {
    label: 'Learn',
    blocks: [
      { type: 'activity', label: 'Activity', icon: '📋' },
      { type: 'experiment', label: 'Experiment', icon: '⚗' },
      { type: 'project', label: 'Project', icon: '🛠' },
      { type: 'question', label: 'Question', icon: '❓' },
      { type: 'callout', label: 'Callout', icon: '💡' },
      { type: 'quote', label: 'Quote', icon: '"' },
      { type: 'bulletList', label: 'Bullets', icon: '•' },
      { type: 'numberedList', label: 'Numbers', icon: '1.' },
      { type: 'divider', label: 'Divider', icon: '—' },
      { type: 'code', label: 'Code', icon: '<>' },
    ],
  },
]

interface Props {
  format: PublicationFormat
  onAddBlock: (type: BlockType) => void
}

export function BlockToolbar({ onAddBlock }: Props) {
  const [open, setOpen] = useState(false)

  return (
    <div style={{
      position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 200,
      background: 'rgba(9,13,22,0.97)', backdropFilter: 'blur(12px)',
      borderTop: '1px solid ' + BORDER,
    }}>
      {open && (
        <div style={{ maxHeight: '52dvh', overflowY: 'auto', padding: '12px 16px 4px' }}>
          {GROUPS.map(group => (
            <div key={group.label} style={{ marginBottom: 14 }}>
              <div style={{
                fontSize: 10, color: MUTED, fontWeight: 800,
                letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 7,
              }}>
                {group.label}
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {group.blocks.map(b => (
                  <button
                    key={b.type}
                    onClick={() => { onAddBlock(b.type); setOpen(false) }}
                    style={{
                      background: SURF, border: '1px solid ' + BORDER,
                      borderRadius: 10, padding: '8px 12px',
                      color: TEXT, fontSize: 12, fontWeight: 650,
                      cursor: 'pointer', display: 'flex',
                      alignItems: 'center', gap: 6,
                    }}
                  >
                    <span style={{ fontSize: 14 }}>{b.icon}</span>
                    {b.label}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
      <div style={{ padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <button
          onClick={() => setOpen(o => !o)}
          aria-expanded={open}
          style={{
            background: open ? ACCENT : SURF,
            color: open ? '#090D16' : TEXT,
            border: '1px solid ' + (open ? ACCENT : BORDER),
            borderRadius: 10, padding: '8px 16px',
            fontSize: 13, fontWeight: 750, cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 6,
          }}
        >
          <span style={{ fontSize: 18, lineHeight: 1 }}>{open ? '✕' : '+'}</span>
          {open ? 'Close' : 'Add'}
        </button>
        <span style={{ fontSize: 11, color: MUTED }}>
          {open ? 'Text · visuals · activities · assessment' : 'Build this unit block by block'}
        </span>
      </div>
    </div>
  )
}
