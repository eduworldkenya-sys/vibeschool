'use client'

import React, { useState, useEffect } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { useRouter } from 'next/navigation'
import { VibeContent } from '@/lib/types'

export function FeaturedSection() {
  const router = useRouter()
  const [content, setContent] = useState<VibeContent[]>([])
  const [loading, setLoading] = useState<boolean>(true)

  useEffect(() => {
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
    supabase
      .from('vibelearn_content')
      .select('id,title,description,subject_id,type,url,thumbnail_url,tags,source,view_count,created_at')
      .eq('status', 'live')
      .order('view_count', { ascending: false })
      .limit(4)
      .then(({ data }) => {
        if (data) setContent(data as unknown as VibeContent[])
        setLoading(false)
      })
  }, [])

  if (!loading && content.length === 0) return null

  return (
    <div>
      <h2 style={{ fontSize: 16, fontWeight: 800, margin: '0 0 12px 0', color: '#ffffff' }}>⚡ Vibe Drops</h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} style={{
              height: 110, borderRadius: 16, backgroundColor: '#1a2235',
              backgroundImage: 'linear-gradient(90deg,#1a2235 25%,#243044 50%,#1a2235 75%)',
              backgroundSize: '200% 100%', animation: 'shimmer 1.5s infinite linear',
            }} />
          ))
        ) : (
          content.map((item) => (
            <div
              key={item.id}
              onClick={() => router.push('/global/read/' + item.id)}
              style={{
                backgroundColor: '#1a2235', borderRadius: 16, padding: 12,
                border: '1px solid rgba(255,255,255,0.06)', height: 110,
                display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
                cursor: 'pointer',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{
                  fontSize: 10, fontWeight: 700, padding: '2px 6px',
                  backgroundColor: '#111827', borderRadius: 24,
                  color: item.type === 'ebook' ? '#CCFF00' : '#ffffff',
                }}>
                  {item.type === 'ebook' ? '📚' : '📄'} {item.type}
                </span>
                <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>👁 {item.view_count}</span>
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#ffffff', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                  {item.title}
                </div>
                {item.source && (
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 2, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
                    by {item.source}
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
