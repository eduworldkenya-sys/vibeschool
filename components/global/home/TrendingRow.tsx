'use client'

import React, { useState, useEffect } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { useRouter } from 'next/navigation'
import { VibeStory, AgeRange, StoryLanguage, StoryStatus, StoryCharacter } from '@/lib/storyTypes'

interface DatabaseStory {
  id: string
  author_id: string | null
  title: string | null
  cover_image_url: string | null
  description: string | null
  language: string | null
  age_range: string | null
  tags: string[] | null
  characters: unknown[] | null
  status: string | null
  page_count: number | null
  view_count: number | null
  vibe_count: number | null
  earnings_ksh: number | null
  created_at: string | null
  updated_at: string | null
  published_at: string | null
}

function mapStory(row: DatabaseStory): VibeStory {
  return {
    id: row.id,
    authorId: row.author_id || '',
    title: row.title || 'Untitled',
    coverImageUrl: row.cover_image_url || null,
    description: row.description || null,
    language: (row.language as StoryLanguage) || 'en',
    ageRange: (row.age_range as AgeRange) || '4-8',
    tags: row.tags || [],
    characters: (row.characters || []) as StoryCharacter[],
    status: (row.status as StoryStatus) || 'published',
    pageCount: row.page_count || 0,
    viewCount: row.view_count || 0,
    vibeCount: row.vibe_count || 0,
    earningsKsh: row.earnings_ksh || 0,
    createdAt: row.created_at || '',
    updatedAt: row.updated_at || '',
    publishedAt: row.published_at || null,
  }
}

export function TrendingRow() {
  const router = useRouter()
  const [stories, setStories] = useState<VibeStory[]>([])
  const [loading, setLoading] = useState<boolean>(true)

  useEffect(() => {
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
    supabase
      .from('vibe_stories')
      .select('*')
      .eq('status', 'published')
      .order('vibe_count', { ascending: false })
      .limit(3)
      .then(({ data }) => {
        if (data) setStories((data as DatabaseStory[]).map(mapStory))
        setLoading(false)
      })
  }, [])

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
