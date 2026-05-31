'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useStoryDraft } from '@/components/global/create/useStoryDraft'
import { useStoryCharacters } from '@/components/global/create/useStoryCharacters'
import { StoryPageBlock } from '@/components/global/create/StoryPageBlock'
import { StoryPageNav } from '@/components/global/create/StoryPageNav'
import { StoryToolbar } from '@/components/global/create/StoryToolbar'
import { StoryCharacterDrawer } from '@/components/global/create/StoryCharacterDrawer'
import { StoryPreviewMode } from '@/components/global/create/StoryPreviewMode'
import { StoryPublishDrawer } from '@/components/global/create/StoryPublishDrawer'
import { emptyTextBlock, emptySpeechBubble } from '@/lib/storyTypes'

interface StoryCanvasProps {
  authorId: string
}

export function StoryCanvas({ authorId }: StoryCanvasProps) {
  const router = useRouter()

  const {
    story,
    pages,
    activePage,
    activeIndex,
    saving,
    lastSaved,
    error,
    updateStory,
    updatePage,
    addPage,
    deletePage,
    movePage,
    setActiveIndex,
    publishStory,
    saveNow,
  } = useStoryDraft(authorId)

  const { characters, addCharacter, updateCharacter, removeCharacter } =
    useStoryCharacters(story?.characters ?? [], updateStory)

  const [characterDrawerOpen, setCharacterDrawerOpen] = useState(false)
  const [previewOpen,         setPreviewOpen]         = useState(false)
  const [publishDrawerOpen,   setPublishDrawerOpen]   = useState(false)

  if (!story) {
    return (
      <div style={{
        minHeight:       '100dvh',
        backgroundColor: '#090D16',
        display:         'flex',
        alignItems:      'center',
        justifyContent:  'center',
        color:           'rgba(255,255,255,0.4)',
        fontSize:        14,
        fontWeight:      500,
      }}>
        Initializing…
      </div>
    )
  }

  const handleAddText = () => {
    if (!activePage) return
    updatePage(activePage.id, {
      textBlocks: [...(activePage.textBlocks || []), emptyTextBlock()],
    })
  }

  const handleAddBubble = (characterId: string | null) => {
    if (!activePage) return
    updatePage(activePage.id, {
      speechBubbles: [...(activePage.speechBubbles || []), emptySpeechBubble(characterId)],
    })
  }

  const getSaveLabel = () => {
    if (saving) return 'Saving…'
    if (error)  return 'Save error'
    if (lastSaved) {
      const diff = Math.floor((Date.now() - lastSaved.getTime()) / 60000)
      if (diff < 1) return 'Saved just now'
      return 'Saved ' + diff + ' min' + (diff === 1 ? '' : 's') + ' ago'
    }
    return ''
  }

  return (
    <div style={{
      minHeight:       '100dvh',
      backgroundColor: '#090D16',
      display:         'flex',
      flexDirection:   'column',
      boxSizing:       'border-box',
      position:        'relative',
      overflowX:       'hidden',
    }}>

      {/* Top bar */}
      <div style={{
        position:        'sticky',
        top:             0,
        zIndex:          100,
        backgroundColor: '#111827',
        borderBottom:    '1px solid #1a2235',
        height:          56,
        display:         'flex',
        alignItems:      'center',
        justifyContent:  'space-between',
        padding:         '0 16px',
        boxSizing:       'border-box',
      }}>
        <button
          onClick={() => router.push('/global/create')}
          style={{
            backgroundColor: 'transparent',
            border:          'none',
            color:           '#ffffff',
            fontSize:        20,
            cursor:          'pointer',
            padding:         '4px 8px',
          }}
        >
          ←
        </button>

        <input
          type="text"
          value={story.title || ''}
          onChange={(e) => updateStory({ title: e.target.value })}
          placeholder="Untitled Story"
          style={{
            flex:            1,
            backgroundColor: 'transparent',
            border:          'none',
            color:           '#ffffff',
            fontSize:        16,
            fontWeight:      700,
            textAlign:       'center',
            outline:         'none',
            padding:         '0 12px',
            boxSizing:       'border-box',
          }}
        />

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button
            onClick={() => setPreviewOpen(true)}
            style={{
              backgroundColor: 'transparent',
              border:          'none',
              color:           '#CCFF00',
              fontSize:        18,
              cursor:          'pointer',
              padding:         4,
            }}
          >
            👁
          </button>
          <button
            onClick={() => setCharacterDrawerOpen(true)}
            style={{
              backgroundColor: 'transparent',
              border:          'none',
              color:           '#ffffff',
              fontSize:        18,
              cursor:          'pointer',
              padding:         4,
            }}
          >
            🎭
          </button>
        </div>
      </div>

      {/* Save status */}
      <div style={{
        width:        '100%',
        padding:      '6px 0',
        textAlign:    'center',
        flexShrink:   0,
      }}>
        <span style={{
          fontSize:   11,
          fontWeight: 600,
          color:      error ? '#FF4D4D' : saving ? '#CCFF00' : 'rgba(255,255,255,0.35)',
        }}>
          {getSaveLabel()}
        </span>
      </div>

      {/* Main scroll area */}
      <div style={{
        flex:          1,
        overflowY:     'auto',
        display:       'flex',
        flexDirection: 'column',
        alignItems:    'center',
        padding:       16,
        paddingBottom: 200,
        boxSizing:     'border-box',
      }}>
        {activePage && (
          <StoryPageBlock
            page={activePage}
            characters={characters}
            isActive={true}
            onPageUpdate={(patch) => updatePage(activePage.id, patch)}
            onAddTextBlock={handleAddText}
            onAddSpeechBubble={handleAddBubble}
          />
        )}
      </div>

      {/* Fixed bottom controls */}
      <div style={{
        position:  'fixed',
        bottom:    0,
        left:      '50%',
        transform: 'translateX(-50%)',
        width:     '100%',
        maxWidth:  480,
        zIndex:    200,
        boxSizing: 'border-box',
      }}>
        <StoryToolbar
          onAddText={handleAddText}
          onAddBubble={handleAddBubble}
          characters={characters}
          onAddCharacter={() => setCharacterDrawerOpen(true)}
          onSave={saveNow}
          onPublish={() => { setPublishDrawerOpen(true); return Promise.resolve(true) }}
          saving={saving}
        />
        <StoryPageNav
          pages={pages}
          activeIndex={activeIndex}
          onSelect={setActiveIndex}
          onAdd={addPage}
          onDelete={(index) => deletePage(pages[index].id)}
          onMove={movePage}
        />
      </div>

      {/* Drawers */}
      <StoryCharacterDrawer
        characters={characters}
        isOpen={characterDrawerOpen}
        onClose={() => setCharacterDrawerOpen(false)}
        onAdd={addCharacter}
        onUpdate={updateCharacter}
        onRemove={removeCharacter}
      />

      <StoryPreviewMode
        pages={pages}
        characters={characters}
        storyTitle={story.title}
        isOpen={previewOpen}
        onClose={() => setPreviewOpen(false)}
      />

      <StoryPublishDrawer
        story={story}
        isOpen={publishDrawerOpen}
        onClose={() => setPublishDrawerOpen(false)}
        onUpdateStory={updateStory}
        onPublish={publishStory}
        pageCount={pages.length}
      />
    </div>
  )
}
