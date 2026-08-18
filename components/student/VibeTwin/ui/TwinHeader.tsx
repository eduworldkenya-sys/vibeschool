// components/student/VibeTwin/ui/TwinHeader.tsx
'use client'

import type { TwinMode } from '../types'
import TwinRoleSwitcher from '@/components/twin/TwinRoleSwitcher'

// Design tokens — single source for this component tree
export const T = {
  bg:        '#090D16',
  card:      '#1a2235',
  accent:    '#CCFF00',
  muted:     'rgba(255,255,255,0.4)',
  text:      '#ffffff',
  border:    'rgba(255,255,255,0.06)',
  inputBg:   '#0d1117',
  accentBg:  'rgba(204,255,0,0.1)',
  accentBdr: 'rgba(204,255,0,0.3)',
  accentMsg: 'rgba(204,255,0,0.12)',
  accentMsgBdr: 'rgba(204,255,0,0.25)',
  dangerBg:  'rgba(255,77,77,0.2)',
  danger:    '#ff4d4d',
} as const

interface TwinHeaderProps {
  mode:    TwinMode
  onMode:  (m: TwinMode) => void
  onClose: () => void
}

export default function TwinHeader({ mode, onMode, onClose }: TwinHeaderProps) {
  return (
    <div style={{
      display:        'flex',
      alignItems:     'center',
      justifyContent: 'space-between',
      gap:            8,
      padding:        '12px 14px',
      borderBottom:   `1px solid ${T.border}`,
      flexShrink:     0,
      minHeight:      60,
    }}>
      <button
        onClick={onClose}
        aria-label="Close Vibe Twin"
        style={{
          background:   'rgba(255,255,255,0.05)',
          border:       'none',
          color:        T.text,
          padding:      '8px 11px',
          borderRadius: 10,
          cursor:       'pointer',
          fontSize:     12,
          fontWeight:   600,
          flexShrink:   0,
        }}
      >
        ← Back
      </button>

      <div style={{ display: 'flex', alignItems: 'center', gap: 7, minWidth: 0 }}>
        <span style={{
          color:         T.accent,
          fontWeight:    800,
          fontSize:      12,
          letterSpacing: '0.08em',
          whiteSpace:    'nowrap',
        }}>
          ✦ VIBE TWIN
        </span>
        <TwinRoleSwitcher currentRole="student" />
      </div>

      <div style={{
        display:      'flex',
        background:   'rgba(255,255,255,0.05)',
        borderRadius: 10,
        padding:      3,
        flexShrink:   0,
      }}
        role="group"
        aria-label="Input mode"
      >
        {(['text', 'audio'] as TwinMode[]).map(m => (
          <button
            key={m}
            onClick={() => onMode(m)}
            aria-pressed={mode === m}
            aria-label={m === 'text' ? 'Text mode' : 'Audio mode'}
            style={{
              padding:       '5px 8px',
              borderRadius:  8,
              border:        'none',
              background:    mode === m ? T.accent : 'transparent',
              color:         mode === m ? '#000' : T.muted,
              fontSize:      10,
              fontWeight:    800,
              cursor:        'pointer',
              textTransform: 'uppercase',
              letterSpacing: 0.5,
            }}
          >
            {m === 'text' ? '💬' : '🎙'} {m}
          </button>
        ))}
      </div>
    </div>
  )
}