'use client'

import React from 'react'
import { useRouter } from 'next/navigation'
import { useStoryFeed } from '@/components/global/feed/useStoryFeed'
import { StoryFeedCard } from '@/components/global/feed/StoryFeedCard'

export default function GlobalFeedPage() {
  const router = useRouter()
  const {
    stories, loading, error, hasMore,
    ageFilter, setAgeFilter,
    langFilter, setLangFilter,
    loadMore,
  } = useStoryFeed()

  const SHIMMER = '@keyframes feedShimmerEffect { 0% { opacity: 0.3; } 50% { opacity: 0.6; } 100% { opacity: 0.3; } }'

  const pillStyle = (active: boolean): React.CSSProperties => ({
    fontSize: 11,
    fontWeight: 700,
    borderRadius: 20,
    border: 'none',
    paddingTop: 6,
    paddingBottom: 6,
    paddingLeft: 14,
    paddingRight: 14,
    cursor: 'pointer',
    outline: 'none',
    whiteSpace: 'nowrap',
    backgroundColor: active ? '#CCFF00' : '#1a2235',
    color: active ? '#090D16' : 'rgba(255,255,255,0.5)',
    transition: 'all 0.15s ease',
  })

  const skeletonStyle: React.CSSProperties = {
    backgroundColor: '#1a2235',
    borderRadius: 16,
    height: 220,
    animationName: 'feedShimmerEffect',
    animationDuration: '1.5s',
    animationIterationCount: 'infinite',
    animationTimingFunction: 'ease-in-out',
  }

  return (
    <div style={{
      backgroundColor: '#090D16',
      minHeight: '100dvh',
      width: '100vw',
      display: 'flex',
      flexDirection: 'column',
      fontFamily: 'system-ui, -apple-system, sans-serif',
    }}>
      <style dangerouslySetInnerHTML={{ __html: SHIMMER }} />

      <header style={{
        position: 'sticky',
        top: 0,
        zIndex: 100,
        backgroundColor: 'rgba(9,13,22,0.95)',
        backdropFilter: 'blur(12px)',
        borderBottom: '1px solid rgba(255,255,255,0.05)',
        paddingTop: 16,
        paddingBottom: 16,
        paddingLeft: 20,
        paddingRight: 20,
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ color: '#CCFF00', fontSize: 18, fontWeight: 900, letterSpacing: '-0.02em' }}>
            VibeSchool
          </span>
          <span style={{
            color: '#FFFFFF',
            fontSize: 13,
            fontWeight: 700,
            backgroundColor: 'rgba(255,255,255,0.04)',
            paddingTop: 4,
            paddingBottom: 4,
            paddingLeft: 10,
            paddingRight: 10,
            borderRadius: 8,
          }}>
            📚 Stories
          </span>
        </div>

        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
          overflowX: 'auto',
          msOverflowStyle: 'none',
          scrollbarWidth: 'none',
        }}>
          <div style={{ display: 'flex', gap: 6 }}>
            <button onClick={() => setAgeFilter('all')}   style={pillStyle(ageFilter === 'all')}>All Ages</button>
            <button onClick={() => setAgeFilter('4-8')}   style={pillStyle(ageFilter === '4-8')}>4-8</button>
            <button onClick={() => setAgeFilter('9-12')}  style={pillStyle(ageFilter === '9-12')}>9-12</button>
            <button onClick={() => setAgeFilter('13+')}   style={pillStyle(ageFilter === '13+')}>13+</button>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button onClick={() => setLangFilter('all')}   style={pillStyle(langFilter === 'all')}>All Langs</button>
            <button onClick={() => setLangFilter('en')}    style={pillStyle(langFilter === 'en')}>EN</button>
            <button onClick={() => setLangFilter('sw')}    style={pillStyle(langFilter === 'sw')}>SW</button>
            <button onClick={() => setLangFilter('mixed')} style={pillStyle(langFilter === 'mixed')}>Both</button>
          </div>
        </div>
      </header>

      <main style={{ flexGrow: 1, padding: 16 }}>
        {!!error && (
          <div style={{
            backgroundColor: 'rgba(239,68,68,0.1)',
            border: '1px dashed rgba(239,68,68,0.2)',
            color: '#EF4444',
            borderRadius: 12,
            padding: 16,
            fontSize: 13,
            fontWeight: 600,
            textAlign: 'center',
            marginBottom: 16,
          }}>
            {error}
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
          {stories.map((story) => (
            <StoryFeedCard
              key={story.id}
              story={story}
              onTap={(id) => router.push('/global/read/story/' + id)}
            />
          ))}
          {loading && (
            <>
              <div style={skeletonStyle} />
              <div style={skeletonStyle} />
              <div style={skeletonStyle} />
              <div style={skeletonStyle} />
            </>
          )}
        </div>

        {!loading && stories.length === 0 && !error && (
          <div style={{ paddingTop: 60, paddingBottom: 60, paddingLeft: 20, paddingRight: 20, textAlign: 'center' }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>📭</div>
            <h4 style={{ color: '#FFFFFF', fontSize: 16, fontWeight: 700, margin: 0 }}>No stories yet</h4>
            <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13, marginTop: 4, marginBottom: 0 }}>
              Be the first to publish one!
            </p>
          </div>
        )}

        {!loading && hasMore && stories.length >= 12 && (
          <div style={{ width: '100%', textAlign: 'center', marginTop: 32, marginBottom: 32 }}>
            <button
              onClick={loadMore}
              style={{
                backgroundColor: 'transparent',
                border: '1px solid rgba(204,255,0,0.3)',
                color: '#CCFF00',
                fontSize: 13,
                fontWeight: 700,
                borderRadius: 20,
                paddingTop: 10,
                paddingBottom: 10,
                paddingLeft: 28,
                paddingRight: 28,
                cursor: 'pointer',
                outline: 'none',
                display: 'inline-block',
              }}
            >
              Load More Stories
            </button>
          </div>
        )}
      </main>
    </div>
  )
}
