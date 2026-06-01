'use client'

import { useEffect, useState } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { VibeStory, StoryPage } from '@/lib/storyTypes'

export function useStoryReader(storyId: string) {
  const [story, setStory] = useState<VibeStory | null>(null)
  const [pages, setPages] = useState<StoryPage[]>([])
  const [activeIndex, setActiveIndex] = useState<number>(0)
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)
  const [isVibed, setIsVibed] = useState<boolean>(false)

  useEffect(() => {
    if (!storyId) return

    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )

    async function initializeReaderPipeline() {
      try {
        const { data: storyData, error: storyErr } = await supabase
          .from('vibe_stories')
          .select('*')
          .eq('id', storyId)
          .eq('status', 'published')
          .single()

        if (storyErr || !storyData) {
          throw new Error('This story is unavailable or has not been published yet.')
        }

        const { data: pagesData, error: pagesErr } = await supabase
          .from('vibe_story_pages')
          .select('*')
          .eq('story_id', storyId)
          .order('page_number', { ascending: true })

        if (pagesErr || !pagesData) {
          throw new Error('Failed to retrieve the story layout layers.')
        }

        setStory(storyData as VibeStory)
        setPages(pagesData as StoryPage[])

        await supabase.rpc('increment_story_views', { story_id: storyId })

        const savedProgress = localStorage.getItem('vibe-story-resume-' + storyId)
        if (savedProgress) {
          const parsedIndex = parseInt(savedProgress, 10)
          if (parsedIndex >= 0 && parsedIndex < pagesData.length) {
            setActiveIndex(parsedIndex)
          }
        }

        const likedToken = localStorage.getItem('vibe-liked-' + storyId)
        if (likedToken === 'true') {
          setIsVibed(true)
        }

        setLoading(false)
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown reader initialization exception'
        console.error('Reader data pipeline failure:', err)
        setError(message)
        setLoading(false)
      }
    }

    initializeReaderPipeline()
  }, [storyId])

  useEffect(() => {
    if (loading || !!error) return
    localStorage.setItem('vibe-story-resume-' + storyId, String(activeIndex))
  }, [activeIndex, storyId, loading, error])

  useEffect(() => {
    if (pages.length === 0) return

    const prefetchTargets = [activeIndex + 1, activeIndex + 2]
    prefetchTargets.forEach((targetIndex) => {
      if (targetIndex < pages.length) {
        const pageAsset = pages[targetIndex]
        if (pageAsset && pageAsset.illustrationUrl) {
          const img = new Image()
          img.src = pageAsset.illustrationUrl
        }
      }
    })
  }, [activeIndex, pages])

  const handleVibe = async () => {
    if (isVibed || !storyId) return

    setIsVibed(true)
    localStorage.setItem('vibe-liked-' + storyId, 'true')

    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )

    try {
      await supabase.rpc('increment_story_likes', { story_id: storyId })
    } catch (err) {
      console.error('Failed to register vibe:', err)
    }
  }

  return {
    story,
    pages,
    activeIndex,
    setActiveIndex,
    loading,
    error,
    isVibed,
    handleVibe,
  }
}
