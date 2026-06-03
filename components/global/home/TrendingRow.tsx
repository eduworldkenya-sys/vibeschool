"use client";
'use client'

import React from 'react'
import { useRouter } from 'next/navigation'
import { VibeStory } from '@/lib/storyTypes'

interface Props {
  stories: VibeStory[]
  loading: boolean
}

export function TrendingRow({ stories, loading }: Props) {
  const router = useRouter()

  return (
    <div>
      <h2 style={{ fontSize: 16, fontWeight: 800, margin: '0 0 12px 0', color: '#ffffff' }}>🔥 Vibe Rising</h2>
      <div style={{ display: 'flex', gap: 12, overflowX: 'auto', paddingBottom: 8, scrollbarWidth: 'none' }}>
        {loading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} style={{
              flexShrink: 0, width: 140, height: 180, borderRadius: 16,
              backgroundColor: '#1a2235',
              backgroundImage: 'linear-gradient(90deg,#1a2235 25%,#243044 50%,#1a2235 75%)',
              backgroundSize: '200% 100%',
              animation: 'shimmer 1.5s infinite linear',
            }} />
          ))
        ) : (
          stories.map((story) => (
            <div
              key={story.id}
              onClick={() => router.push('/global/read/story/' + story.id)}
              style={{
                flexShrink: 0, width: 140, height: 180,
                backgroundColor: '#1a2235', borderRadius: 16,
                overflow: 'hidden', position: 'relative', cursor: 'pointer',
                border: '1px solid rgba(255,255,255,0.06)',
              }}
            >
              {story.coverImageUrl ? (
                <img src={story.coverImageUrl} alt={story.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32, backgroundColor: '#111827' }}>📖</div>
              )}
              <div style={{
                position: 'absolute', bottom: 0, left: 0, right: 0,
                background: 'linear-gradient(to top, rgba(9,13,22,0.95), transparent)',
                padding: '20px 8px 8px 8px',
              }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#ffffff', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
                  {story.title}
                </div>
                <div style={{ fontSize: 11, color: '#CCFF00', marginTop: 2 }}>⚡ {story.vibeCount}</div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
