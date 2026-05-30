'use client'

import React, { useEffect, useRef, useState } from 'react'
import { VibeContent } from '@/lib/types'

const TEXT  = '#e8e6e0'
const MUTED = 'rgba(255,255,255,0.4)'
const ACCENT = '#CCFF00'


interface Props {
  content: VibeContent
  active:  boolean
}

export default function ScrollSurface({ content, active }: Props) {
  const containerRef            = useRef<HTMLDivElement>(null)
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    const el = containerRef.current?.closest('[style*="overflow"]') as HTMLElement | null
    if (!el) return
    const onScroll = () => {
      const pct = Math.min(100, Math.round((el.scrollTop / (el.scrollHeight - el.clientHeight)) * 100))
      setProgress(pct)
    }
    el.addEventListener('scroll', onScroll)
    return () => el.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <div ref={containerRef} style={{ padding: '20px 20px 0' }}>
      {/* Progress bar */}
      <div style={{ position: 'sticky', top: 0, zIndex: 10, marginBottom: 20 }}>
        <div style={{ height: 2, background: 'rgba(255,255,255,0.06)', borderRadius: 2 }}>
          <div style={{ height: '100%', width: `${progress}%`, background: ACCENT, borderRadius: 2, transition: 'width 0.2s' }} />
        </div>
        <div style={{ fontSize: 10, color: MUTED, textAlign: 'right', marginTop: 4 }}>{progress}% read</div>
      </div>

      {/* Title */}
      <h1 style={{ fontSize: 22, fontWeight: 900, color: '#ffffff', lineHeight: 1.3, marginBottom: 8 }}>
        {content.title}
      </h1>

      {/* Meta */}
      <div style={{ fontSize: 12, color: MUTED, marginBottom: 24 }}>
        {content.source} · {content.type.toUpperCase()}
        {content.tags?.length > 0 && ' · ' + content.tags.slice(0, 3).join(', ')}
      </div>

      {/* Body text — extracted from PDF or written directly */}
      {content.body ? (
        <div style={{ fontSize: 16, color: TEXT, lineHeight: 1.9, marginBottom: 24 }}>
          {content.body.split('\n\n').map((para, i) => (
            <p key={i} style={{ marginBottom: 16 }}>{para}</p>
          ))}
        </div>
      ) : (
        <p style={{ fontSize: 16, color: TEXT, lineHeight: 1.8, marginBottom: 24 }}>
          {content.description}
        </p>
      )}

      {/* PDF download link */}
      {content.url && /\.pdf$/i.test(content.url) && (
        <a
          href={content.url}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '16px 20px', borderRadius: 14, textDecoration: 'none',
            background: 'rgba(204,255,0,0.06)', border: '1px solid rgba(204,255,0,0.15)',
            marginBottom: 24,
          }}
        >
          <div>
            <div style={{ fontSize: 13, fontWeight: 800, color: '#CCFF00' }}>📄 View Full PDF</div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>Opens in browser</div>
          </div>
          <div style={{ fontSize: 20, color: '#CCFF00' }}>↗</div>
        </a>
      )}

      {content.url && content.url.match(/\.(png|jpg|jpeg|webp)$/i) && (
        <img
          src={content.url}
          alt={content.title}
          style={{ width: '100%', borderRadius: 12, marginBottom: 24 }}
        />
      )}

      {/* Fallback link */}
      {content.url && !content.url.match(/\.(pdf|png|jpg|jpeg|webp)$/i) && (
        <a
          href={content.url}
          target="_blank"
          rel="noopener noreferrer"
          style={{ display: 'block', padding: '14px 20px', borderRadius: 12, background: 'rgba(204,255,0,0.08)', color: ACCENT, fontWeight: 700, fontSize: 13, textDecoration: 'none', textAlign: 'center' }}
        >
          Open Content ↗
        </a>
      )}
    </div>
  )
}