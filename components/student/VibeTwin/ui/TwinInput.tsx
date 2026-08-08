// components/student/VibeTwin/ui/TwinInput.tsx
'use client'

import type { TwinMode, TwinState } from '../types'
import { T } from './TwinHeader'

interface TwinInputProps {
  mode: TwinMode
  twinState: TwinState
  input: string
  onInput: (val: string) => void
  onSubmit: (text: string) => void
  onStartListen: (e: React.PointerEvent) => void
  onStopListen: (e: React.PointerEvent) => void
  onCancelListen: (e: React.PointerEvent) => void
  onStopSpeak: () => void
}

export default function TwinInput({ mode, twinState, input, onInput, onSubmit, onStartListen, onStopListen, onCancelListen, onStopSpeak }: TwinInputProps) {
  const canSubmit = input.trim().length > 0 && twinState !== 'processing'

  return <div style={{ padding: '10px 14px 20px', borderTop: `1px solid ${T.border}`, background: T.inputBg, flexShrink: 0 }}>
    {mode === 'text' ? <div style={{ display: 'grid', gap: 6 }}>
      <div style={{ fontSize: 9.5, color: T.muted }}>Ask about what you are learning, or use the buttons above.</div>
      <div style={{ display: 'flex', gap: 8 }}>
        <input
          value={input}
          onChange={e => onInput(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              if (canSubmit) onSubmit(input)
            }
          }}
          placeholder="Ask Twin about this…"
          disabled={twinState === 'processing'}
          aria-label="Ask Twin about what you are learning"
          style={{ flex: 1, background: T.card, border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, padding: '12px 14px', fontSize: 13, color: T.text, outline: 'none' }}
        />
        {twinState === 'speaking' ? <button onClick={onStopSpeak} aria-label="Stop speaking" style={{ background: T.dangerBg, border: 'none', borderRadius: 14, padding: '12px 16px', color: T.danger, fontSize: 16, cursor: 'pointer' }}>⏹</button> : <button onClick={() => { if (canSubmit) onSubmit(input) }} disabled={!canSubmit} aria-label="Send message" style={{ background: canSubmit ? T.accent : 'rgba(255,255,255,0.05)', border: 'none', borderRadius: 14, padding: '12px 18px', color: canSubmit ? '#000' : T.muted, fontSize: 13, fontWeight: 800, cursor: canSubmit ? 'pointer' : 'default' }}>✦</button>}
      </div>
    </div> : <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
      {twinState === 'speaking' ? <button onClick={onStopSpeak} aria-label="Stop speaking" style={{ width: 72, height: 72, borderRadius: '50%', border: 'none', background: T.dangerBg, color: T.danger, fontSize: 24, cursor: 'pointer' }}>⏹</button> : <button onPointerDown={onStartListen} onPointerUp={onStopListen} onPointerCancel={onCancelListen} aria-label="Hold to speak" aria-pressed={twinState === 'listening'} disabled={twinState === 'processing'} style={{ width: 72, height: 72, borderRadius: '50%', border: 'none', background: twinState === 'listening' ? T.accentBg : 'rgba(204,255,0,0.08)', color: T.accent, fontSize: 28, cursor: twinState === 'processing' ? 'default' : 'pointer', boxShadow: twinState === 'listening' ? `0 0 0 8px ${T.accentBg}` : 'none', transition: 'all 0.2s', WebkitTapHighlightColor: 'transparent' }}>🎙</button>}
      <span style={{ fontSize: 11, color: T.muted }}>{twinState === 'listening' ? 'Release to send' : twinState === 'processing' ? 'Choosing the next teaching move…' : twinState === 'speaking' ? 'Twin is speaking…' : 'Hold to ask Twin'}</span>
    </div>}
  </div>
}
