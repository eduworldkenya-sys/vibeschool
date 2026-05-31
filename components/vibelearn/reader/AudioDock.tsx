'use client'

import React, { useState, useEffect, useRef } from 'react'
import { VibeContent } from '@/lib/types'

const SURFACE = '#111827'
const ACCENT  = '#CCFF00'
const MUTED   = 'rgba(255,255,255,0.4)'
const TEXT    = '#ffffff'
const GREEN   = '#10b981'

interface Props {
  content: VibeContent
  active?: boolean
}

const SPEEDS = [0.75, 1, 1.25, 1.5, 2]

export default function AudioDock({ content }: Props) {
  const [speaking, setSpeaking] = useState(false)
  const [speed,    setSpeed]    = useState(1)
  const uttRef                  = useRef<SpeechSynthesisUtterance | null>(null)

  useEffect(() => {
    return () => { window.speechSynthesis?.cancel() }
  }, [])

  function play() {
    window.speechSynthesis?.cancel()
    const text = `${content.title}. ${content.description ?? ''}`
    const u    = new SpeechSynthesisUtterance(text)
    u.rate     = speed
    u.pitch    = 1.05
    const voices = window.speechSynthesis?.getVoices() ?? []
    const voice  = voices.find(v => v.name.includes('Google UK English Female') || v.lang === 'en-GB')
    if (voice) u.voice = voice
    u.onend = () => setSpeaking(false)
    uttRef.current = u
    window.speechSynthesis?.speak(u)
    setSpeaking(true)
  }

  function stop() {
    window.speechSynthesis?.cancel()
    setSpeaking(false)
  }

  function cycleSpeed() {
    const next = SPEEDS[(SPEEDS.indexOf(speed) + 1) % SPEEDS.length]
    setSpeed(next)
    if (speaking) { stop(); setTimeout(play, 100) }
  }

  return (
    <div style={{
      position: 'fixed', bottom: 0, left: 0, right: 0,
      background: SURFACE, borderTop: '1px solid rgba(255,255,255,0.08)',
      padding: '12px 20px 28px', zIndex: 200,
    }}>
      {/* Track info */}
      <div style={{ fontSize: 12, color: MUTED, marginBottom: 10, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        🎧 {content.title}
      </div>

      {/* Controls */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        {/* Play / Stop */}
        <button
          onClick={speaking ? stop : play}
          style={{
            width: 48, height: 48, borderRadius: '50%', border: 'none', cursor: 'pointer',
            background: ACCENT, color: '#000', fontSize: 20, fontWeight: 900,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          {speaking ? '⏹' : '▶'}
        </button>

        {/* Title */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: TEXT, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {content.title}
          </div>
          <div style={{ fontSize: 11, color: speaking ? GREEN : MUTED, marginTop: 2 }}>
            {speaking ? 'Playing…' : 'Tap ▶ to listen'}
          </div>
        </div>

        {/* Speed */}
        <button
          onClick={cycleSpeed}
          style={{
            padding: '6px 12px', borderRadius: 20, border: '1px solid rgba(255,255,255,0.1)',
            background: 'transparent', color: ACCENT, fontSize: 12, fontWeight: 800, cursor: 'pointer',
          }}
        >
          {speed}x
        </button>
      </div>
    </div>
  )
}