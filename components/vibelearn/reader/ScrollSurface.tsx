'use client'

import React, { useEffect, useRef, useState } from 'react'
import { VibeContent } from '@/lib/types'

const TEXT   = '#e8e6e0'
const MUTED  = 'rgba(255,255,255,0.4)'
const ACCENT = '#CCFF00'

interface Props {
  content: VibeContent
  active:  boolean
}

export default function ScrollSurface({ content, active }: Props) {
  const wrapRef                 = useRef<HTMLDivElement>(null)
  const [progress, setProgress] = useState(0)

  // ── Fix: attach to the actual scrollable parent reliably ──
  useEffect(() => {
    function findScrollParent(el: HTMLElement | null): HTMLElement | null {
      if (!el) return null
      const style = window.getComputedStyle(el)
      if (style.overflowY === 'auto' || style.overflowY === 'scroll') return el
      return findScrollParent(el.parentElement)
    }

    const scroller = findScrollParent(wrapRef.current?.parentElement ?? null) ?? window as unknown as HTMLElement

    function onScroll() {
      if (scroller === (window as unknown as HTMLElement)) {
        const pct = Math.min(100, Math.round(
          (window.scrollY / (document.body.scrollHeight - window.innerHeight)) * 100
        ))
        setProgress(isNaN(pct) ? 0 : pct)
      } else {
        const el = scroller as HTMLElement
        const pct = Math.min(100, Math.round(
          (el.scrollTop / (el.scrollHeight - el.clientHeight)) * 100
        ))
        setProgress(isNaN(pct) ? 0 : pct)
      }
    }

    const target = scroller === (window as unknown as HTMLElement) ? window : scroller
    target.addEventListener('scroll', onScroll, { passive: true })
    return () => target.removeEventListener('scroll', onScroll)
  }, [])

  // ── Derive readable text: body > description > nothing ──
  const bodyText: string | null = content.body ?? content.description ?? null

  const isPdf   = content.url && /\.pdf$/i.test(content.url)
  const isImage = content.url && /\.(png|jpg|jpeg|webp)$/i.test(content.url)
  const isOther = content.url && !isPdf && !isImage

  return (
    <div ref={wrapRef} style={{ padding: '20px 20px 0' }}>

      {/* ── Progress bar ── */}
      <div style={{ position: 'sticky', top: 0, zIndex: 10, marginBottom: 20 }}>
        <div style={{ height: 2, background: 'rgba(255,255,255,0.06)', borderRadius: 2 }}>
          <div style={{
            height: '100%', width: `${progress}%`,
            background: ACCENT, borderRadius: 2, transition: 'width 0.2s',
          }} />
        </div>
        <div style={{ fontSize: 10, color: MUTED, textAlign: 'right', marginTop: 4 }}>
          {progress}% read
        </div>
      </div>

      {/* ── Title ── */}
      <h1 style={{ fontSize: 22, fontWeight: 900, color: '#ffffff', lineHeight: 1.3, marginBottom: 8 }}>
        {content.title}
      </h1>

      {/* ── Meta ── */}
      <div style={{ fontSize: 12, color: MUTED, marginBottom: 24 }}>
        {content.source} · {content.type.toUpperCase()}
        {content.tags?.length > 0 && ' · ' + content.tags.slice(0, 3).join(', ')}
      </div>

      {/* ── Body text ── */}
      {bodyText && (
        <div style={{ fontSize: 16, color: TEXT, lineHeight: 1.9, marginBottom: 28 }}>
          {bodyText.split('\n\n').map((para, i) => (
            <p key={i} style={{ marginBottom: 16 }}>{para}</p>
          ))}
        </div>
      )}

      {/* ── PDF: inline iframe viewer ── */}
      {isPdf && (
        <div style={{ marginBottom: 28 }}>
          <iframe
            src={content.url}
            title={content.title}
            style={{
              width: '100%',
              height: '70vh',
              borderRadius: 14,
              border: '1px solid rgba(204,255,0,0.15)',
              background: '#fff',
            }}
          />
          <a
            href={content.url}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '12px 16px', borderRadius: 12, textDecoration: 'none',
              background: 'rgba(204,255,0,0.06)', border: '1px solid rgba(204,255,0,0.12)',
              marginTop: 10,
            }}
          >
            <div style={{ fontSize: 12, fontWeight: 700, color: ACCENT }}>📄 Open PDF in browser</div>
            <div style={{ fontSize: 18, color: ACCENT }}>↗</div>
          </a>
        </div>
      )}

      {/* ── Image ── */}
      {isImage && (
        <img
          src={content.url}
          alt={content.title}
          style={{ width: '100%', borderRadius: 12, marginBottom: 24 }}
        />
      )}

      {/* ── Other link ── */}
      {isOther && (
        <a
          href={content.url}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: 'block', padding: '14px 20px', borderRadius: 12,
            background: 'rgba(204,255,0,0.08)', color: ACCENT,
            fontWeight: 700, fontSize: 13, textDecoration: 'none', textAlign: 'center',
            marginBottom: 24,
          }}
        >
          Open Content ↗
        </a>
      )}

    </div>
  )
}
