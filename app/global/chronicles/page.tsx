'use client'

import React from 'react'
import { useRouter } from 'next/navigation'
import { useStoryFeed } from '@/components/global/feed/useStoryFeed'
import { StoryFeedCard } from '@/components/global/feed/StoryFeedCard'
import { SkeletonGrid } from '@/components/global/shared/SkeletonGrid'
import { EmptyState } from '@/components/global/shared/EmptyState'

export default function ChroniclesPage() {
  const router = useRouter()
  const {
    stories, loading, error, hasMore,
    ageFilter, setAgeFilter,
    langFilter, setLangFilter,
    loadMore,
  } = useStoryFeed()

  const agePills = [
    { label: 'All Ages', value: 'all' as const },
    { label: '4-8',      value: '4-8' as const },
    { label: '9-12',     value: '9-12' as const },
    { label: '13+',      value: '13+' as const },
  ]

  const langPills = [
    { label: 'All',  value: 'all'   as const },
    { label: 'EN',   value: 'en'    as const },
    { label: 'SW',   value: 'sw'    as const },
    { label: 'Both', value: 'mixed' as const },
  ]

  const pillStyle = (active: boolean): React.CSSProperties => ({
    padding: '6px 14px', borderRadius: 24, fontSize: 12, fontWeight: 600,
    whiteSpace: 'nowrap', cursor: 'pointer',
    backgroundColor: active ? '#CCFF00' : '#1a2235',
    color: active ? '#090D16' : '#ffffff',
    border: '1px solid rgba(255,255,255,0.06)',
  })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div>
        <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0, color: '#ffffff' }}>📖 Chronicles</h1>
        <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13, margin: '4px 0 0 0' }}>
          Stories built for mobile minds.
        </p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ display: 'flex', gap: 8, overflowX: 'auto', scrollbarWidth: 'none', paddingBottom: 4 }}>
          {agePills.map((p) => (
            <button key={p.value} onClick={() => setAgeFilter(p.value)} style={pillStyle(ageFilter === p.value)}>
              {p.label}
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 8, overflowX: 'auto', scrollbarWidth: 'none', paddingBottom: 4 }}>
          {langPills.map((p) => (
            <button key={p.value} onClick={() => setLangFilter(p.value)} style={pillStyle(langFilter === p.value)}>
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {!!error && (
        <div style={{ backgroundColor: 'rgba(239,68,68,0.1)', border: '1px dashed rgba(239,68,68,0.2)', color: '#EF4444', borderRadius: 12, padding: 16, fontSize: 13, textAlign: 'center' }}>
          {error}
        </div>
      )}

      {loading && stories.length === 0 ? (
        <SkeletonGrid count={6} />
      ) : stories.length === 0 ? (
        <EmptyState title="No stories found" subtitle="Try different filters." action={{ label: 'Write a Story', href: '/global/create/story' }} />
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
            {stories.map((story) => (
              <StoryFeedCard key={story.id} story={story} onTap={(id) => router.push('/global/read/story/' + id)} />
            ))}
          </div>
          {hasMore && (
            <button
              onClick={loadMore}
              disabled={loading}
              style={{
                width: '100%', padding: 12, borderRadius: 12,
                backgroundColor: '#111827', border: '1px solid rgba(255,255,255,0.06)',
                color: '#ffffff', fontSize: 14, fontWeight: 600, cursor: 'pointer',
              }}
            >
              {loading ? 'Loading…' : 'Load More'}
            </button>
          )}
        </>
      )}
    </div>
  )
}
