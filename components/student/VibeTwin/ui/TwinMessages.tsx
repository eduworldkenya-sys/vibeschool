"use client";
// components/student/VibeTwin/ui/TwinMessages.tsx
'use client'

import { useEffect, useRef } from 'react'
import type { TwinMessage, TwinState } from '../types'
import { T } from './TwinHeader'

interface TwinMessagesProps {
  messages:  TwinMessage[]
  twinState: TwinState
}

export default function TwinMessages({ messages, twinState }: TwinMessagesProps) {
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages, twinState])

  return (
    <div
      ref={scrollRef}
      aria-live="polite"
      aria-label="Conversation"
      style={{
        flex:                  1,
        overflowY:             'auto',
        padding:               '20px 16px',
        display:               'flex',
        flexDirection:         'column',
        gap:                   12,
        WebkitOverflowScrolling: 'touch',
      }}
    >
      {messages.length === 0 && twinState === 'idle' && (
        <div role="status" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div aria-hidden="true" style={{
            width: 28, height: 28, borderRadius: '50%', background: T.accentBg,
            border: `1px solid ${T.accentBdr}`, display: 'flex', alignItems: 'center',
            justifyContent: 'center', fontSize: 12,
          }}>✦</div>
          <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: '4px 16px 16px 16px', padding: '10px 14px', fontSize: 11, color: T.muted }}>
            Opening your learning context…
          </div>
        </div>
      )}

      {messages.map(msg => (
        <div key={msg.id} style={{ display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
          {msg.role === 'twin' && (
            <div aria-hidden="true" style={{
              width: 28, height: 28, borderRadius: '50%', flexShrink: 0, background: T.accentBg,
              border: `1px solid ${T.accentBdr}`, display: 'flex', alignItems: 'center',
              justifyContent: 'center', fontSize: 12, marginRight: 8, marginTop: 2,
            }}>✦</div>
          )}
          <div
            role={msg.role === 'twin' ? 'status' : undefined}
            style={{
              maxWidth: '78%', background: msg.role === 'twin' ? T.card : T.accentMsg,
              border: msg.role === 'twin' ? `1px solid ${T.border}` : `1px solid ${T.accentMsgBdr}`,
              borderRadius: msg.role === 'twin' ? '4px 16px 16px 16px' : '16px 4px 16px 16px',
              padding: '10px 14px', fontSize: 13, color: T.text, lineHeight: 1.6,
              userSelect: 'text', WebkitUserSelect: 'text',
            }}
          >
            {msg.text}
          </div>
        </div>
      ))}

      {twinState === 'listening' && (
        <div role="status" aria-label="Listening" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div aria-hidden="true" style={{
            width: 28, height: 28, borderRadius: '50%', background: T.accentBg,
            border: `1px solid ${T.accentBdr}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12,
          }}>✦</div>
          <div style={{ background: T.card, borderRadius: '4px 16px 16px 16px', padding: '10px 14px', display: 'flex', gap: 4, alignItems: 'center' }}>
            {[0, 0.2, 0.4].map(d => (
              <div key={d} style={{ width: 6, height: 6, borderRadius: '50%', background: T.accent, animation: `twinDot 1.2s ${d}s ease-in-out infinite` }} />
            ))}
            <span style={{ fontSize: 11, color: T.muted, marginLeft: 6 }}>Listening...</span>
          </div>
        </div>
      )}

      {twinState === 'processing' && (
        <div role="status" aria-label="Processing" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div aria-hidden="true" style={{
            width: 28, height: 28, borderRadius: '50%', background: T.accentBg,
            border: `1px solid ${T.accentBdr}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12,
          }}>✦</div>
          <div style={{ background: T.card, borderRadius: '4px 16px 16px 16px', padding: '10px 14px', fontSize: 11, color: T.muted }}>
            Finding your vibe...
          </div>
        </div>
      )}

      <style>{`
        @keyframes twinDot {
          0%, 80%, 100% { transform: scale(0.7); opacity: 0.4; }
          40%            { transform: scale(1);   opacity: 1;   }
        }
      `}</style>
    </div>
  )
}
