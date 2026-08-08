"use client"

import React, { useState } from 'react'
import { BlockType, PublicationFormat } from '@/lib/publishTypes'

const ACCENT = '#CCFF00'
const SURF   = '#111827'
const MUTED  = 'rgba(255,255,255,0.4)'
const BORDER = 'rgba(255,255,255,0.06)'
const TEXT   = '#ffffff'

const BLOCKS: { type: BlockType; label: string; icon: string }[] = [
  { type: 'paragraph',    label: 'Text',        icon: '¶'  },
  { type: 'heading1',     label: 'H1',          icon: 'H1' },
  { type: 'heading2',     label: 'H2',          icon: 'H2' },
  { type: 'heading3',     label: 'H3',          icon: 'H3' },
  { type: 'quote',        label: 'Quote',       icon: '"'  },
  { type: 'bulletList',   label: 'Bullets',     icon: '•'  },
  { type: 'numberedList', label: 'Numbers',     icon: '1.' },
  { type: 'image',        label: 'Image',       icon: '🖼' },
  { type: 'divider',      label: 'Divider',     icon: '—'  },
  { type: 'callout',      label: 'Callout',     icon: '💡' },
  { type: 'code',         label: 'Code',        icon: '<>' },
  { type: 'activity',     label: 'Activity',    icon: '📋' },
  { type: 'question',     label: 'Question',    icon: '❓' },
  { type: 'interactive',  label: 'Interactive', icon: '⚡' },
]

interface Props {
  format:     PublicationFormat
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
        <div style={{
          display: 'flex', flexWrap: 'wrap', gap: 8,
          padding: '12px 16px',
          borderBottom: '1px solid ' + BORDER,
        }}>
          {BLOCKS.map(b => (
            <button
              key={b.type}
              onClick={() => { onAddBlock(b.type); setOpen(false) }}
              style={{
                background: SURF, border: '1px solid ' + BORDER,
                borderRadius: 10, padding: '8px 14px',
                color: TEXT, fontSize: 12, fontWeight: 600,
                cursor: 'pointer', display: 'flex',
                alignItems: 'center', gap: 6,
              }}
            >
              <span style={{ fontSize: 14 }}>{b.icon}</span>
              {b.label}
            </button>
          ))}
        </div>
      )}
      <div style={{ padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <button
          onClick={() => setOpen(o => !o)}
          style={{
            background: open ? ACCENT : SURF,
            color: open ? '#090D16' : TEXT,
            border: '1px solid ' + (open ? ACCENT : BORDER),
            borderRadius: 10, padding: '8px 16px',
            fontSize: 13, fontWeight: 700, cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 6,
          }}
        >
          <span style={{ fontSize: 18, lineHeight: 1 }}>{open ? '✕' : '+'}</span>
          {open ? 'Close' : 'Add Block'}
        </button>
        <span style={{ fontSize: 11, color: MUTED }}>
          {open ? 'Pick a block type' : 'Tap + to insert content'}
        </span>
      </div>
    </div>
  )
}
