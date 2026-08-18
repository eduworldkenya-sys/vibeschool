
"use client";

import React, { useState, useEffect } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { useRouter } from 'next/navigation'
import { useGlobalAuth } from '@/components/global/shared/GlobalAuthContext'
import { TrendingRow } from '@/components/global/home/TrendingRow'
import { FeaturedSection } from '@/components/global/home/FeaturedSection'
import { StoryFeedCard } from '@/components/global/feed/StoryFeedCard'
import { SkeletonGrid } from '@/components/global/shared/SkeletonGrid'
import { VibeStory, AgeRange, StoryLanguage, StoryStatus, StoryCharacter } from '@/lib/storyTypes'
import { VibeContent } from '@/lib/types'

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

export default function GlobalHomePage() {
  const { isLoggedIn, userName } = useGlobalAuth()
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [trendingStories, setTrendingStories] = useState<VibeStory[]>([])
  const [featuredContent, setFeaturedContent] = useState<VibeContent[]>([])
  const [latestStories, setLatestStories] = useState<VibeStory[]>([])

  useEffect(() => {
    const sb = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
    Promise.all([
      sb.from('vibe_stories').select('*').eq('status', 'published').order('vibe_count', { ascending: false }).limit(3),
      sb.from('vibelearn_content').select('id,title,description,subject_id,type,url,thumbnail_url,tags,source,view_count,created_at').eq('status', 'live').order('view_count', { ascending: false }).limit(4),
      sb.from('vibe_stories').select('*').eq('status', 'published').order('published_at', { ascending: false }).limit(4),
    ]).then(([trending, featured, latest]) => {
      if (trending.data) setTrendingStories((trending.data as DatabaseStory[]).map(mapStory))
      if (featured.data) setFeaturedContent(featured.data as unknown as VibeContent[])
      if (latest.data)   setLatestStories((latest.data as DatabaseStory[]).map(mapStory))
      setLoading(false)
    })
  }, [])

  const firstName = userName ? userName.split(' ')[0] : ''

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <section>
        <h1 style={{ fontSize: 24, fontWeight: 800, margin: 0, letterSpacing: '-0.5px', color: '#ffffff' }}>
          {isLoggedIn ? 'Vibe, ' + firstName + ' ✦' : 'Explore free. Learn everywhere.'}
        </h1>
        <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 14, marginTop: 4, marginBottom: 0 }}>
          {isLoggedIn ? 'Welcome back to your learning hub.' : 'No account needed to browse.'}
        </p>
      </section>

      <section onClick={() => router.push('/global/store')} style={{ cursor:'pointer',background:'linear-gradient(135deg,#121827 0%,#14200d 100%)',border:'1px solid rgba(204,255,0,.18)',borderRadius:18,padding:'18px 20px',display:'grid',gridTemplateColumns:'1fr auto',gap:18,alignItems:'center' }}>
        <div><div style={{ color:'#CCFF00',fontSize:10,fontWeight:900,letterSpacing:'.12em' }}>LEARNING PRODUCTS</div><h2 style={{ color:'#fff',fontSize:20,margin:'6px 0 7px' }}>Sample first. Pay with M-Pesa only when the product earns it.</h2><p style={{ color:'rgba(255,255,255,.48)',fontSize:12.5,lineHeight:1.55,margin:0 }}>Browse rights-cleared textbooks and curriculum products with transparent KES pricing and durable access.</p></div>
        <div style={{ width:42,height:42,borderRadius:13,display:'grid',placeItems:'center',background:'#CCFF00',color:'#090D16',fontSize:20,fontWeight:950 }}>→</div>
      </section>

      <TrendingRow stories={trendingStories} loading={loading} />
      <FeaturedSection content={featuredContent} loading={loading} />

      <section>
        <h2 style={{ fontSize: 16, fontWeight: 800, margin: '0 0 12px 0', color: '#ffffff' }}>📖 Latest Stories</h2>
        {loading ? (
          <SkeletonGrid count={4} />
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
            {latestStories.map((story) => (
              <StoryFeedCard
                key={story.id}
                story={story}
                onTap={(id) => router.push('/global/read/story/' + id)}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
