"use client";
'use client'

import React, { useState } from 'react'
import { VibeContent } from '@/lib/types'

interface VibesCardProps {
  item: VibeContent
  isLoggedIn: boolean
  onAuthPrompt: () => void
  onVibe: (id: string) => void
}

export function VibesCard({ item, isLoggedIn, onAuthPrompt, onVibe }: VibesCardProps) {
  const [pressed, setPressed] = useState<boolean>(false)

  const handleVibeClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!isLoggedIn) { onAuthPrompt(); return }
    onVibe(item.id)
  }

  return (
    <div
      onPointerDown={() => setPressed(true)}
      onPointerUp={() => setPressed(false)}
      onPointerLeave={() => setPressed(false)}
      style={{
        backgroundColor: '#1a2235', borderRadius: 16, padding: 12,
        border: '1px solid rgba(255,255,255,0.06)',
        display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
        minHeight: 160, cursor: 'pointer',
        transform: pressed ? 'scale(0.97)' : 'scale(1)',
        transition: 'transform 0.15s ease',
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{
            fontSize: 10, fontWeight: 700, padding: '2px 6px',
            backgroundColor: '#111827', borderRadius: 24,
            color: item.type === 'ebook' ? '#CCFF00' : '#ffffff',
          }}>
            {item.type === 'ebook' ? '📚' : '📄'} {item.type}
          </span>
          <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>👁 {item.view_count}</span>
        </div>
        <span style={{
          fontSize: 13, fontWeight: 600, color: '#ffffff', lineHeight: 1.3,
          overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
        }}>
          {item.title}
        </span>
        {item.source && (
          <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
            via {item.source}
          </span>
        )}
        {item.tags && item.tags.length > 0 && (
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {item.tags.slice(0, 3).map((tag, i) => (
              <span key={i} style={{ fontSize: 9, backgroundColor: 'rgba(255,255,255,0.04)', padding: '2px 6px', borderRadius: 24, color: 'rgba(255,255,255,0.5)' }}>
                #{tag}
              </span>
            ))}
          </div>
        )}
      </div>
      <button
        onClick={handleVibeClick}
        style={{
          width: '100%', backgroundColor: '#111827', border: '1px solid rgba(255,255,255,0.08)',
          color: '#CCFF00', fontSize: 11, fontWeight: 700, padding: '7px 0',
          borderRadius: 10, cursor: 'pointer', marginTop: 8,
        }}
      >
        ⚡ Vibe
      </button>
    </div>
  )
}
