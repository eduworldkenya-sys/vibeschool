"use client";
'use client'

import React, { useState, useEffect, useRef, useCallback } from 'react'
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

function buildSentences(content: VibeContent): string[] {
  // Full body > description > title only
  const raw = content.body ?? content.description ?? ''
  const full = `${content.title}. ${raw}`.trim()
  // Split on sentence boundaries, filter empties
  return full
    .split(/(?<=[.!?])\s+/)
    .map(s => s.trim())
    .filter(Boolean)
}

export default function AudioDock({ content }: Props) {
  const [speaking,  setSpeaking]  = useState(false)
  const [speed,     setSpeed]     = useState(1)
  const [sentIdx,   setSentIdx]   = useState(0)
  const [totalSent, setTotalSent] = useState(0)
  const sentences = useRef<string[]>([])
  const cancelled = useRef(false)

  useEffect(() => {
    sentences.current = buildSentences(content)
    setTotalSent(sentences.current.length)
    return () => {
      cancelled.current = true
      window.speechSynthesis?.cancel()
    }
  }, [content])

  const speakFrom = useCallback((idx: number, rate: number) => {
    if (!sentences.current.length) return
    cancelled.current = false

    function speakNext(i: number) {
      if (cancelled.current || i >= sentences.current.length) {
        setSpeaking(false)
        setSentIdx(0)
        return
      }
      setSentIdx(i)
      const u = new SpeechSynthesisUtterance(sentences.current[i])
      u.rate  = rate
      u.pitch = 1.05

      const voices = window.speechSynthesis?.getVoices() ?? []
      const voice  = voices.find(v =>
        v.name.includes('Google UK English Female') || v.lang === 'en-GB'
      )
      if (voice) u.voice = voice

      u.onend = () => {
        if (!cancelled.current) speakNext(i + 1)
      }
      u.onerror = () => {
        if (!cancelled.current) speakNext(i + 1)
      }

      window.speechSynthesis?.speak(u)
    }

    window.speechSynthesis?.cancel()
    setSpeaking(true)
    speakNext(idx)
  }, [])

  function play() {
    speakFrom(sentIdx, speed)
  }

  function stop() {
    cancelled.current = true
    window.speechSynthesis?.cancel()
    setSpeaking(false)
  }

  function restart() {
    cancelled.current = true
    window.speechSynthesis?.cancel()
    setSentIdx(0)
    setTimeout(() => speakFrom(0, speed), 80)
  }

  function cycleSpeed() {
    const next = SPEEDS[(SPEEDS.indexOf(speed) + 1) % SPEEDS.length]
    setSpeed(next)
    if (speaking) {
      cancelled.current = true
      window.speechSynthesis?.cancel()
      setTimeout(() => speakFrom(sentIdx, next), 80)
    }
  }

  const progress = totalSent > 0 ? Math.round((sentIdx / totalSent) * 100) : 0

  return (
    <div style={{
      position: 'fixed', bottom: 0, left: 0, right: 0,
      background: SURFACE, borderTop: '1px solid rgba(255,255,255,0.08)',
      padding: '12px 20px 28px', zIndex: 200,
    }}>

      {/* Progress bar */}
      <div style={{ height: 2, background: 'rgba(255,255,255,0.06)', borderRadius: 2, marginBottom: 10 }}>
        <div style={{
          height: '100%', width: `${progress}%`,
          background: ACCENT, borderRadius: 2, transition: 'width 0.3s',
        }} />
      </div>

      {/* Track info */}
      <div style={{
        fontSize: 11, color: MUTED, marginBottom: 10,
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
      }}>
        🎧 {content.title}
        {totalSent > 0 && (
          <span style={{ marginLeft: 8, color: speaking ? ACCENT : MUTED }}>
            {sentIdx + 1}/{totalSent}
          </span>
        )}
      </div>

      {/* Current sentence preview */}
      {speaking && sentences.current[sentIdx] && (
        <div style={{
          fontSize: 12, color: TEXT, lineHeight: 1.5, marginBottom: 10,
          background: 'rgba(204,255,0,0.04)', borderRadius: 8,
          padding: '8px 12px', border: '1px solid rgba(204,255,0,0.1)',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {sentences.current[sentIdx]}
        </div>
      )}

      {/* Controls */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>

        {/* Restart */}
        <button
          onClick={restart}
          style={{
            width: 36, height: 36, borderRadius: '50%', border: 'none', cursor: 'pointer',
            background: 'rgba(255,255,255,0.06)', color: MUTED, fontSize: 14,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          ↺
        </button>

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

        {/* Title + status */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: 13, fontWeight: 700, color: TEXT,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {content.title}
          </div>
          <div style={{ fontSize: 11, color: speaking ? GREEN : MUTED, marginTop: 2 }}>
            {speaking ? 'Playing…' : sentIdx > 0 ? 'Paused — tap ▶ to resume' : 'Tap ▶ to listen'}
          </div>
        </div>

        {/* Speed */}
        <button
          onClick={cycleSpeed}
          style={{
            padding: '6px 12px', borderRadius: 20,
            border: '1px solid rgba(255,255,255,0.1)',
            background: 'transparent', color: ACCENT,
            fontSize: 12, fontWeight: 800, cursor: 'pointer',
          }}
        >
          {speed}x
        </button>

      </div>
    </div>
  )
}
