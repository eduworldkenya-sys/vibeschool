'use client'

import React from 'react'
import { ReadMode } from '@/app/global/read/[id]/page'

const SURFACE = '#111827'
const ACCENT  = '#CCFF00'
const MUTED   = 'rgba(255,255,255,0.4)'

interface Props {
  mode:     ReadMode
  onChange: (m: ReadMode) => void
}

const MODES: { id: ReadMode; icon: string; label: string }[] = [
  { id: 'scroll', icon: '📖', label: 'Read'   },
  { id: 'listen', icon: '🎧', label: 'Listen' },
]

export default function ModeSwitcher({ mode, onChange }: Props) {
  return (
    <div style={{ display: 'flex', gap: 4 }}>
      {MODES.map(m => (
        <button
          key={m.id}
          onClick={() => onChange(m.id)}
          style={{
            padding: '6px 12px', borderRadius: 20, border: 'none', cursor: 'pointer',
            background: mode === m.id ? ACCENT : 'rgba(255,255,255,0.06)',
            color: mode === m.id ? '#000' : MUTED,
            fontSize: 11, fontWeight: 800,
          }}
        >
          {m.icon} {m.label}
        </button>
      ))}
    </div>
  )
}