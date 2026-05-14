'use client'

import { RefObject } from 'react'

interface Message { role: 'twin' | 'user'; text: string }

interface TwinPillProps {
  open:          boolean
  onOpen:        () => void
  onClose:       () => void
  messages:      Message[]
  thinking:      boolean
  input:         string
  onInputChange: (v: string) => void
  onSend:        () => void
  bottomRef:     RefObject<HTMLDivElement>
  isDark:        boolean
}

function TwinDot({ delay = 0 }: { delay?: number }) {
  return (
    <span style={{
      display: 'inline-block', width: 7, height: 7, borderRadius: '50%',
      background: '#10b981', margin: '0 2px',
      animation: `twinPulse 1.4s ease-in-out ${delay}s infinite`,
    }} />
  )
}

export default function TwinPill({
  open, onOpen, onClose, messages, thinking,
  input, onInputChange, onSend, bottomRef, isDark,
}: TwinPillProps) {
  const cardBg = isDark ? '#1a1d22' : '#ffffff'
  const border  = isDark ? '#2a2d31' : '#e5e7eb'
  const muted   = '#6b7280'

  return (
    <>
      {/* Pill */}
      <div
        onClick={onOpen}
        style={{
          position: 'fixed', bottom: 72, left: '50%',
          transform: 'translateX(-50%)', zIndex: 750,
          background: '#1e1b4b', borderRadius: 40,
          padding: '10px 20px',
          display: 'flex', alignItems: 'center', gap: 14,
          boxShadow: '0 4px 24px rgba(30,27,75,0.32)',
          cursor: 'pointer',
          border: '1.5px solid rgba(16,185,129,0.3)',
          minWidth: 230, justifyContent: 'space-between',
          userSelect: 'none',
          transition: 'box-shadow 0.2s, transform 0.2s',
        }}
        onMouseEnter={e => {
          e.currentTarget.style.boxShadow = '0 8px 32px rgba(30,27,75,0.45)'
          e.currentTarget.style.transform = 'translateX(-50%) translateY(-2px)'
        }}
        onMouseLeave={e => {
          e.currentTarget.style.boxShadow = '0 4px 24px rgba(30,27,75,0.32)'
          e.currentTarget.style.transform = 'translateX(-50%) translateY(0)'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 30, height: 30, borderRadius: '50%', background: 'rgba(16,185,129,0.18)', border: '1.5px solid rgba(16,185,129,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, color: '#10b981' }}>✦</div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 800, color: '#fff', fontFamily: 'Bricolage Grotesque, sans-serif', lineHeight: 1 }}>Your Twin</div>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.45)', marginTop: 2 }}>Tap to open</div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <TwinDot delay={0} /><TwinDot delay={0.2} /><TwinDot delay={0.4} />
        </div>
      </div>

      {/* Backdrop */}
      {open && (
        <div
          onClick={onClose}
          style={{ position: 'fixed', inset: 0, zIndex: 780, background: 'rgba(0,0,0,0.25)' }}
        />
      )}

      {/* Drawer */}
      <div style={{
        position: 'fixed', left: '50%', transform: 'translateX(-50%)',
        bottom: open ? 138 : -500,
        zIndex: 790,
        width: 'calc(100% - 32px)', maxWidth: 600,
        background: cardBg, borderRadius: 20,
        boxShadow: '0 -4px 40px rgba(0,0,0,0.18)',
        display: 'flex', flexDirection: 'column', height: 440,
        transition: 'bottom 0.34s cubic-bezier(0.34,1.56,0.64,1)',
        overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{ background: '#1e1b4b', padding: '14px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 34, height: 34, borderRadius: '50%', background: 'rgba(16,185,129,0.2)', border: '1.5px solid rgba(16,185,129,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, color: '#10b981' }}>✦</div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 800, color: '#fff', fontFamily: 'Bricolage Grotesque, sans-serif' }}>Your Twin</div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)' }}>Never resets · Always here</div>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.6)', fontSize: 22, cursor: 'pointer', lineHeight: 1 }}>×</button>
        </div>

        {/* Messages */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
          {messages.map((m, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start', alignItems: 'flex-end', gap: 8 }}>
              {m.role === 'twin' && (
                <div style={{ width: 26, height: 26, borderRadius: '50%', background: '#d1fae5', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, flexShrink: 0, color: '#10b981' }}>✦</div>
              )}
              <div style={{
                maxWidth: '78%', padding: '10px 14px',
                borderRadius: m.role === 'user' ? '16px 16px 4px 16px' : '4px 16px 16px 16px',
                background: m.role === 'user' ? '#10b981' : (isDark ? '#12151a' : '#f8f9fa'),
                color: m.role === 'user' ? '#fff' : (isDark ? '#f0ede8' : '#111827'),
                fontSize: 13, lineHeight: 1.6,
              }}>{m.text}</div>
            </div>
          ))}
          {thinking && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 26, height: 26, borderRadius: '50%', background: '#d1fae5', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, color: '#10b981' }}>✦</div>
              <TwinDot delay={0} /><TwinDot delay={0.2} /><TwinDot delay={0.4} />
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div style={{ padding: '10px 14px', borderTop: `1px solid ${border}`, display: 'flex', gap: 8, flexShrink: 0 }}>
          <input
            value={input}
            onChange={e => onInputChange(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && onSend()}
            placeholder="Ask your Twin anything…"
            style={{ flex: 1, padding: '9px 13px', borderRadius: 10, border: `1.5px solid ${border}`, outline: 'none', fontSize: 13, fontFamily: 'inherit', color: isDark ? '#f0ede8' : '#111827', background: isDark ? '#12151a' : '#fff' }}
          />
          <button
            onClick={onSend}
            style={{ padding: '9px 18px', borderRadius: 10, border: 'none', background: '#10b981', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}
          >Send</button>
        </div>
      </div>
    </>
  )
}