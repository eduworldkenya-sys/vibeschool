"use client";
'use client'

import React, { useEffect, useRef, useState } from 'react'
import { VibeContent } from '@/lib/types'

const TEXT   = '#e8e6e0'
const MUTED  = 'rgba(255,255,255,0.4)'
const ACCENT = '#CCFF00'
const CARD   = 'rgba(255,255,255,0.04)'
const BORDER = 'rgba(255,255,255,0.08)'

interface Props {
  content: VibeContent
  active:  boolean
}

// ── Structured block parser ──────────────────────────────────────────────
type Block =
  | { kind: 'heading';  text: string; level: 1 | 2 }
  | { kind: 'bullets';  items: string[] }
  | { kind: 'numbered'; items: string[] }
  | { kind: 'table';    rows: string[][] }
  | { kind: 'figure';   text: string }
  | { kind: 'warning';  title: string; text: string }
  | { kind: 'paragraph'; text: string }

function isNumberedLine(line: string): boolean {
  return /^\d+[.)]\s*\t?\s*/.test(line.trim())
}
function stripNumberedPrefix(line: string): string {
  return line.trim().replace(/^\d+[.)]\s*\t?\s*/, '')
}
function isBulletLine(line: string): boolean {
  return /^[•\-]\s*\t?\s*/.test(line.trim())
}
function stripBulletPrefix(line: string): string {
  return line.trim().replace(/^[•\-]\s*\t?\s*/, '')
}
function isTableLine(line: string): boolean {
  const stripped = line.replace(/^\t+/, '')
  if (isNumberedLine(stripped) || isBulletLine(stripped)) return false
  return (stripped.match(/\t/g) || []).length >= 1
}
function stripLeadingTabs(line: string): string {
  return line.replace(/^\t+/, '')
}
function isFigureLine(line: string): boolean {
  return /^Figure\s+[\d.]+/i.test(line.trim())
}
function isWarningLine(line: string): boolean {
  return /^(Watch Out!|Warning:|Caution:|Important:)/i.test(line.trim())
}
function isHeadingLine(line: string): boolean {
  if (/^\t/.test(line)) return false
  const t = line.trim()
  if (!t || t.length > 70) return false
  if (isBulletLine(t) || isNumberedLine(t) || isTableLine(t) || isFigureLine(t) || isWarningLine(t)) return false
  if (/[.?!]$/.test(t)) return false
  if (t.includes('=')) return false
  return /^[A-Z0-9]/.test(t)
}

function parseBlocks(raw: string): Block[] {
  const normalized = raw.replace(/\\n/g, '\n').replace(/\r\n/g, '\n')
  const lines = normalized.split('\n')
  const blocks: Block[] = []
  let i = 0

  while (i < lines.length) {
    const line = lines[i]
    const trimmed = line.trim()

    if (!trimmed) { i++; continue }

    if (isWarningLine(trimmed)) {
      const match = trimmed.match(/^([^!]+!)\s*(.*)$/)
      let title = match ? match[1] : 'Note'
      let text  = match ? match[2] : trimmed
      i++
      while (i < lines.length && lines[i].trim() &&
        !isHeadingLine(lines[i]) && !isBulletLine(lines[i]) && !isNumberedLine(lines[i])) {
        text += ' ' + lines[i].trim()
        i++
      }
      blocks.push({ kind: 'warning', title, text })
      continue
    }

    if (isFigureLine(trimmed)) {
      blocks.push({ kind: 'figure', text: trimmed })
      i++
      continue
    }

    if (isNumberedLine(trimmed)) {
      const items: string[] = []
      while (i < lines.length && isNumberedLine(lines[i])) {
        items.push(stripNumberedPrefix(lines[i]))
        i++
      }
      blocks.push({ kind: 'numbered', items })
      continue
    }

    if (isBulletLine(trimmed)) {
      const items: string[] = []
      while (i < lines.length && isBulletLine(lines[i])) {
        items.push(stripBulletPrefix(lines[i]))
        i++
      }
      blocks.push({ kind: 'bullets', items })
      continue
    }

    if (isTableLine(line)) {
      const rows: string[][] = []
      while (i < lines.length && isTableLine(lines[i])) {
        rows.push(stripLeadingTabs(lines[i]).split('\t').map(c => c.trim()).filter(c => c.length > 0))
        i++
      }
      blocks.push({ kind: 'table', rows })
      continue
    }

    if (isHeadingLine(line)) {
      const isTop = trimmed === trimmed.toUpperCase()
      blocks.push({ kind: 'heading', text: trimmed, level: isTop ? 1 : 2 })
      i++
      continue
    }

    let text = trimmed
    i++
    while (
      i < lines.length && lines[i].trim() &&
      !isTableLine(lines[i]) && !isBulletLine(lines[i]) && !isNumberedLine(lines[i]) &&
      !isHeadingLine(lines[i]) && !isFigureLine(lines[i]) && !isWarningLine(lines[i])
    ) {
      text += ' ' + lines[i].trim()
      i++
    }
    blocks.push({ kind: 'paragraph', text })
  }

  return blocks
}

function BlockView({ block }: { block: Block }) {
  switch (block.kind) {
    case 'heading':
      return (
        <div style={{
          fontSize: block.level === 1 ? 19 : 16,
          fontWeight: 800,
          color: block.level === 1 ? '#ffffff' : ACCENT,
          marginTop: block.level === 1 ? 28 : 22,
          marginBottom: 10,
          paddingBottom: block.level === 1 ? 8 : 0,
          borderBottom: block.level === 1 ? `1px solid ${BORDER}` : 'none',
        }}>
          {block.text}
        </div>
      )
    case 'bullets':
      return (
        <ul style={{ margin: '0 0 16px', padding: 0, listStyle: 'none' }}>
          {block.items.map((item, i) => (
            <li key={i} style={{ display: 'flex', gap: 10, marginBottom: 8, fontSize: 16, color: TEXT, lineHeight: 1.7 }}>
              <span style={{ color: ACCENT, flexShrink: 0 }}>•</span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
      )
    case 'numbered':
      return (
        <ol style={{ margin: '0 0 16px', padding: 0, listStyle: 'none', counterReset: 'item' }}>
          {block.items.map((item, i) => (
            <li key={i} style={{ display: 'flex', gap: 10, marginBottom: 8, fontSize: 16, color: TEXT, lineHeight: 1.7 }}>
              <span style={{ color: ACCENT, fontWeight: 700, flexShrink: 0, minWidth: 20 }}>{i + 1}.</span>
              <span>{item}</span>
            </li>
          ))}
        </ol>
      )
    case 'table':
      return (
        <div style={{ overflowX: 'auto', marginBottom: 16, borderRadius: 10, border: `1px solid ${BORDER}` }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
            <tbody>
              {block.rows.map((row, ri) => (
                <tr key={ri} style={{ background: ri === 0 ? 'rgba(204,255,0,0.06)' : ri % 2 === 0 ? 'transparent' : CARD }}>
                  {row.map((cell, ci) => (
                    <td key={ci} style={{
                      padding: '8px 12px',
                      color: ri === 0 ? ACCENT : TEXT,
                      fontWeight: ri === 0 ? 700 : 400,
                      borderBottom: `1px solid ${BORDER}`,
                      whiteSpace: 'nowrap',
                    }}>
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )
    case 'figure':
      return (
        <div style={{
          display: 'flex', gap: 10, alignItems: 'flex-start',
          padding: '12px 14px', borderRadius: 10, marginBottom: 16,
          border: `1px dashed ${BORDER}`, background: 'rgba(255,255,255,0.02)',
        }}>
          <span style={{ fontSize: 18, flexShrink: 0 }}>🖼️</span>
          <span style={{ fontSize: 13, color: MUTED, fontStyle: 'italic', lineHeight: 1.6 }}>{block.text}</span>
        </div>
      )
    case 'warning':
      return (
        <div style={{
          display: 'flex', gap: 10, alignItems: 'flex-start',
          padding: '12px 14px', borderRadius: 10, marginBottom: 16,
          borderLeft: `3px solid ${ACCENT}`, background: 'rgba(204,255,0,0.05)',
        }}>
          <span style={{ fontSize: 16, flexShrink: 0 }}>⚠️</span>
          <span style={{ fontSize: 14, color: TEXT, lineHeight: 1.7 }}>
            <strong style={{ color: ACCENT }}>{block.title}</strong> {block.text}
          </span>
        </div>
      )
    case 'paragraph':
    default:
      return (
        <p style={{ fontSize: 16, color: TEXT, lineHeight: 1.9, marginBottom: 16 }}>{block.text}</p>
      )
  }
}

export default function ScrollSurface({ content, active }: Props) {
  const wrapRef                 = useRef<HTMLDivElement>(null)
  const [progress, setProgress] = useState(0)

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

  const bodyText: string | null = content.body ?? content.description ?? null
  const blocks = bodyText ? parseBlocks(bodyText) : []

  const isPdf   = content.url && /\.pdf$/i.test(content.url)
  const isImage = content.url && /\.(png|jpg|jpeg|webp)$/i.test(content.url)
  const isOther = content.url && !isPdf && !isImage

  return (
    <div ref={wrapRef} style={{ padding: '20px 20px 0' }}>

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

      <h1 style={{ fontSize: 22, fontWeight: 900, color: '#ffffff', lineHeight: 1.3, marginBottom: 8 }}>
        {content.title}
      </h1>

      <div style={{ fontSize: 12, color: MUTED, marginBottom: 24 }}>
        {content.source} · {content.type.toUpperCase()}
        {content.tags?.length > 0 && ' · ' + content.tags.slice(0, 3).join(', ')}
      </div>

      {blocks.length > 0 && (
        <div style={{ marginBottom: 28 }}>
          {blocks.map((block, i) => <BlockView key={i} block={block} />)}
        </div>
      )}

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

      {isImage && (
        <img
          src={content.url}
          alt={content.title}
          style={{ width: '100%', borderRadius: 12, marginBottom: 24 }}
        />
      )}

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
