'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { VibesCard } from '@/components/global/vibes/VibesCard'
import { SkeletonGrid } from '@/components/global/shared/SkeletonGrid'
import { EmptyState } from '@/components/global/shared/EmptyState'
import { VibeContent } from '@/lib/types'

type FilterType = 'all' | 'epage' | 'ebook'

interface VibesFeedProps {
  isLoggedIn: boolean
  onAuthPrompt: () => void
}

const PAGE_SIZE = 12

export function VibesFeed({ isLoggedIn, onAuthPrompt }: VibesFeedProps) {
  const [filter, setFilter] = useState<FilterType>('all')
  const [items, setItems] = useState<VibeContent[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [page, setPage] = useState<number>(0)
  const [hasMore, setHasMore] = useState<boolean>(true)

  const fetchVibes = useCallback(async (currentPage: number, currentFilter: FilterType, reset: boolean) => {
    setLoading(true)
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
    let query = supabase
      .from('vibelearn_content')
      .select('id,title,description,subject_id,type,url,thumbnail_url,tags,source,view_count,created_at')
      .eq('status', 'live')
      .order('created_at', { ascending: false })
      .range(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE - 1)

    if (currentFilter !== 'all') query = query.eq('type', currentFilter)

    const { data } = await query
    const rows = (data || []) as VibeContent[]
    setItems((prev) => reset ? rows : [...prev, ...rows])
    setHasMore(rows.length === PAGE_SIZE)
    setLoading(false)
  }, [])

  useEffect(() => {
    setItems([])
    setPage(0)
    setHasMore(true)
    fetchVibes(0, filter, true)
  }, [filter, fetchVibes])

  const handleVibe = async (id: string) => {
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
    await supabase.rpc('increment_vibe_count', { content_id: id })
  }

  const filters: { label: string; value: FilterType }[] = [
    { label: 'All',       value: 'all' },
    { label: '📄 Epages', value: 'epage' },
    { label: '📚 Ebooks', value: 'ebook' },
  ]

  const pillStyle = (active: boolean): React.CSSProperties => ({
    padding: '6px 14px', borderRadius: 24, fontSize: 12, fontWeight: 600,
    cursor: 'pointer', border: '1px solid rgba(255,255,255,0.06)',
    backgroundColor: active ? '#CCFF00' : '#1a2235',
    color: active ? '#090D16' : '#ffffff',
  })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', gap: 8, overflowX: 'auto', scrollbarWidth: 'none' }}>
        {filters.map((f) => (
          <button key={f.value} onClick={() => setFilter(f.value)} style={pillStyle(filter === f.value)}>
            {f.label}
          </button>
        ))}
      </div>

      {loading && items.length === 0 ? (
        <SkeletonGrid count={6} />
      ) : items.length === 0 ? (
        <EmptyState title="No Vibes yet" subtitle="Check back soon for new drops." />
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
            {items.map((item) => (
              <VibesCard
                key={item.id}
                item={item}
                isLoggedIn={isLoggedIn}
                onAuthPrompt={onAuthPrompt}
                onVibe={handleVibe}
              />
            ))}
          </div>
          {hasMore && (
            <button
              onClick={() => { const next = page + 1; setPage(next); fetchVibes(next, filter, false) }}
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
