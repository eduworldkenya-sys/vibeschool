'use client'

import React, { useState, useRef, useEffect } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import {
  StoryPage,
  StoryCharacter,
  StoryTextBlock,
  StorySpeechBubble,
  emptyTextBlock,
  emptySpeechBubble,
} from '@/lib/storyTypes'
import { StoryIllustrationSlot } from './StoryIllustrationSlot'
import { StoryTextBlock as TextBlockComponent } from './StoryTextBlock'
import { StorySpeechBubble as SpeechBubbleComponent } from './StorySpeechBubble'

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

interface StoryPageBlockProps {
  page:               StoryPage
  characters:         StoryCharacter[]
  isActive:           boolean
  onPageUpdate:       (patch: Partial<StoryPage>) => void
  onAddTextBlock:     () => void
  onAddSpeechBubble:  (characterId: string | null) => void
}

export function StoryPageBlock({
  page,
  characters,
  isActive,
  onPageUpdate,
  onAddTextBlock,
  onAddSpeechBubble,
}: StoryPageBlockProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [dimensions, setDimensions] = useState({ width: 480, height: 360 })
  const [selectedId, setSelectedId] = useState<{ id: string; type: 'text' | 'bubble' } | null>(null)
  const [uploading,  setUploading]  = useState(false)

  useEffect(() => {
    if (!containerRef.current) return
    const ro = new ResizeObserver(entries => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect
        if (width > 0 && height > 0) setDimensions({ width, height })
      }
    })
    ro.observe(containerRef.current)
    return () => ro.disconnect()
  }, [])

  if (!isActive) return null

  const handleImageUpload = async (file: File) => {
    setUploading(true)
    try {
      const ext       = file.name.split('.').pop() || 'jpg'
      const path      = `stories/${page.storyId}/page-${page.pageNumber}-${Date.now()}.${ext}`
      const { error } = await supabase.storage
        .from('vibelearn-content')
        .upload(path, file, { cacheControl: '3600', upsert: true })
      if (error) throw error
      const { data } = supabase.storage.from('vibelearn-content').getPublicUrl(path)
      if (!data?.publicUrl) throw new Error('No public URL returned')
      onPageUpdate({ illustrationUrl: data.publicUrl })
    } catch (err: unknown) {
      console.error('Image upload failed:', err)
    } finally {
      setUploading(false)
    }
  }

  const handleTextChange = (id: string, patch: Partial<StoryTextBlock>) => {
    onPageUpdate({
      textBlocks: page.textBlocks.map(b => b.id === id ? { ...b, ...patch } : b)
    })
  }

  const handleTextDelete = (id: string) => {
    onPageUpdate({ textBlocks: page.textBlocks.filter(b => b.id !== id) })
    setSelectedId(null)
  }

  const handleBubbleChange = (id: string, patch: Partial<StorySpeechBubble>) => {
    onPageUpdate({
      speechBubbles: page.speechBubbles.map(b => b.id === id ? { ...b, ...patch } : b)
    })
  }

  const handleBubbleDelete = (id: string) => {
    onPageUpdate({ speechBubbles: page.speechBubbles.filter(b => b.id !== id) })
    setSelectedId(null)
  }

  const resolveCharacterName = (characterId: string | null): string | null => {
    if (!characterId) return null
    return characters.find(c => c.id === characterId)?.name ?? null
  }

  const handleAddText = () => {
    const block = emptyTextBlock()
    onPageUpdate({ textBlocks: [...page.textBlocks, block] })
    setSelectedId({ id: block.id, type: 'text' })
    onAddTextBlock()
  }

  const handleAddBubble = (characterId: string | null) => {
    const bubble = emptySpeechBubble(characterId)
    onPageUpdate({ speechBubbles: [...page.speechBubbles, bubble] })
    setSelectedId({ id: bubble.id, type: 'bubble' })
    onAddSpeechBubble(characterId)
  }

  return (
    <div
      onClick={() => setSelectedId(null)}
      style={{
        position:        'relative',
        width:           '100%',
        maxWidth:        480,
        aspectRatio:     '4 / 3',
        backgroundColor: page.backgroundColor || '#111827',
        borderRadius:    16,
        overflow:        'hidden',
        boxSizing:       'border-box',
        boxShadow:       '0 25px 50px -12px rgba(0,0,0,0.7)',
      }}
    >
      {/* Illustration layer */}
      <div
        ref={containerRef}
        style={{ position: 'absolute', inset: 0, zIndex: 1, width: '100%', height: '100%' }}
      >
        <StoryIllustrationSlot
          illustrationUrl={page.illustrationUrl}
          illustrationPrompt={page.illustrationPrompt}
          backgroundColor={page.backgroundColor}
          onImageUpload={handleImageUpload}
          onPromptChange={prompt => onPageUpdate({ illustrationPrompt: prompt })}
          uploading={uploading}
        />
      </div>

      {/* Interactive overlay layer */}
      <div style={{ position: 'absolute', inset: 0, zIndex: 5, pointerEvents: 'none' }}>
        {page.textBlocks.map(block => (
          <div key={block.id} style={{ pointerEvents: 'auto' }}>
            <TextBlockComponent
              block={block}
              selected={selectedId?.type === 'text' && selectedId.id === block.id}
              onSelect={() => setSelectedId({ id: block.id, type: 'text' })}
              onChange={patch => handleTextChange(block.id, patch)}
              onDelete={() => handleTextDelete(block.id)}
              containerWidth={dimensions.width}
              containerHeight={dimensions.height}
            />
          </div>
        ))}

        {page.speechBubbles.map(bubble => (
          <div key={bubble.id} style={{ pointerEvents: 'auto' }}>
            <SpeechBubbleComponent
              bubble={bubble}
              selected={selectedId?.type === 'bubble' && selectedId.id === bubble.id}
              characterName={resolveCharacterName(bubble.characterId)}
              onSelect={() => setSelectedId({ id: bubble.id, type: 'bubble' })}
              onChange={patch => handleBubbleChange(bubble.id, patch)}
              onDelete={() => handleBubbleDelete(bubble.id)}
              containerWidth={dimensions.width}
              containerHeight={dimensions.height}
            />
          </div>
        ))}
      </div>

      {/* Add controls — bottom right */}
      <div style={{
        position:      'absolute',
        bottom:        12,
        right:         12,
        zIndex:        20,
        display:       'flex',
        flexDirection: 'column',
        gap:           8,
        pointerEvents: 'auto',
      }}>
        <button
          onClick={e => { e.stopPropagation(); handleAddText() }}
          style={{
            width:           36,
            height:          36,
            borderRadius:    '50%',
            backgroundColor: 'rgba(9,13,22,0.9)',
            border:          '1px solid rgba(204,255,0,0.4)',
            color:           '#CCFF00',
            fontSize:        18,
            display:         'flex',
            alignItems:      'center',
            justifyContent:  'center',
            cursor:          'pointer',
          }}
          title="Add text"
        >
          T
        </button>
        <button
          onClick={e => { e.stopPropagation(); handleAddBubble(null) }}
          style={{
            width:           36,
            height:          36,
            borderRadius:    '50%',
            backgroundColor: 'rgba(9,13,22,0.9)',
            border:          '1px solid rgba(204,255,0,0.4)',
            color:           '#CCFF00',
            fontSize:        16,
            display:         'flex',
            alignItems:      'center',
            justifyContent:  'center',
            cursor:          'pointer',
          }}
          title="Add speech bubble"
        >
          💬
        </button>
      </div>
    </div>
  )
}
