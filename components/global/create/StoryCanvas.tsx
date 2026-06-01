'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useStoryDraft } from '@/components/global/create/useStoryDraft'
import { useStoryCharacters } from '@/components/global/create/useStoryCharacters'
import { useOnboarding } from '@/components/global/create/useOnboarding'
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

const HINT_STYLE: React.CSSProperties = {
  backgroundColor: '#CCFF00',
  color:           '#090D16',
  padding:         '6px 12px',
  borderRadius:    6,
  fontSize:        11,
  fontWeight:      700,
  boxShadow:       '0 8px 24px rgba(0,0,0,0.4)',
  pointerEvents:   'auto',
}

const KEYFRAMES = '@keyframes pulseGlow { 0% { box-shadow: 0 0 0 0 rgba(204,255,0,0.4); } 70% { box-shadow: 0 0 0 10px rgba(204,255,0,0.0); } 100% { box-shadow: 0 0 0 0 rgba(204,255,0,0.0); } } @keyframes slideInUp { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }'

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

  const { hints, dismissHint, completeOnboarding } = useOnboarding(authorId)

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
        fontWeight:      600,
        letterSpacing:   '0.02em',
      }}>
        Initializing…
      </div>
    )
  }

  const handleAddText = () => {
    if (!activePage) return
    dismissHint('text')
    updatePage(activePage.id, {
      textBlocks: [...(activePage.textBlocks || []), emptyTextBlock()],
    })
  }

  const handleAddBubble = (characterId: string | null) => {
    if (!activePage) return
    dismissHint('bubble')
    updatePage(activePage.id, {
      speechBubbles: [...(activePage.speechBubbles || []), emptySpeechBubble(characterId)],
    })
  }

  const getSaveLabel = () => {
    if (saving) return 'Saving changes…'
    if (error)  return 'Sync error occurred'
    if (lastSaved) {
      const diff = Math.floor((Date.now() - lastSaved.getTime()) / 60000)
      return diff < 1 ? 'Saved to cloud' : 'Saved ' + diff + 'm ago'
    }
    return 'Ready'
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

      <style dangerouslySetInnerHTML={{ __html: KEYFRAMES }} />

      {/* Top bar */}
      <header style={{
        position:        'sticky',
        top:             0,
        zIndex:          400,
        backgroundColor: '#0E131F',
        borderBottom:    '1px solid rgba(255,255,255,0.06)',
        backdropFilter:  'blur(12px)',
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
            color:           'rgba(255,255,255,0.8)',
            fontSize:        22,
            cursor:          'pointer',
            padding:         '4px 12px',
            display:         'flex',
            alignItems:      'center',
          }}
        >
          ‹
        </button>

        <div style={{ flex: 1, position: 'relative', maxWidth: '60%' }}>
          <input
            type="text"
            value={story.title || ''}
            onChange={(e) => { updateStory({ title: e.target.value }); dismissHint('title') }}
            placeholder="Untitled Story"
            style={{
              width:           '100%',
              backgroundColor: 'transparent',
              border:          'none',
              color:           '#ffffff',
              fontSize:        15,
              fontWeight:      600,
              textAlign:       'center',
              outline:         'none',
              padding:         '6px 0',
              letterSpacing:   '-0.01em',
            }}
          />
          {hints.title && (
            <div style={{
              position:        'absolute',
              top:             '140%',
              left:            '50%',
              transform:       'translateX(-50%)',
              backgroundColor: '#CCFF00',
              borderRadius:    6,
              padding:         '6px 10px',
              fontSize:        11,
              fontWeight:      700,
              color:           '#090D16',
              whiteSpace:      'nowrap',
              zIndex:          500,
              boxShadow:       '0 12px 32px rgba(0,0,0,0.4)',
              pointerEvents:   'none',
              animation:       'slideInUp 0.3s ease forwards',
            }}>
              ✏️ Tap here to name your story
            </div>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <button
            onClick={() => setPreviewOpen(true)}
            style={{
              backgroundColor: 'transparent',
              border:          'none',
              color:           'rgba(255,255,255,0.6)',
              fontSize:        16,
              cursor:          'pointer',
              padding:         8,
            }}
          >
            👁
          </button>

          <div style={{ position: 'relative', display: 'inline-block' }}>
            <button
              onClick={() => { setCharacterDrawerOpen(true); dismissHint('characters') }}
              style={{
                backgroundColor: hints.characters ? 'rgba(204,255,0,0.1)' : 'transparent',
                border:          hints.characters ? '1px solid #CCFF00' : 'none',
                borderRadius:    6,
                color:           '#ffffff',
                fontSize:        16,
                cursor:          'pointer',
                padding:         hints.characters ? '7px' : '8px',
                display:         'flex',
                alignItems:      'center',
                animation:       hints.characters ? 'pulseGlow 2s infinite' : 'none',
                transition:      'background-color 0.2s ease',
              }}
            >
              🎭
            </button>
            {hints.characters && (
              <div style={{
                position:        'absolute',
                top:             '140%',
                right:           0,
                backgroundColor: '#CCFF00',
                borderRadius:    6,
                padding:         '6px 10px',
                fontSize:        11,
                fontWeight:      700,
                color:           '#090D16',
                whiteSpace:      'nowrap',
                zIndex:          500,
                boxShadow:       '0 12px 32px rgba(0,0,0,0.4)',
                pointerEvents:   'none',
                animation:       'slideInUp 0.3s ease forwards',
              }}>
                🎭 Add your story characters
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Save status */}
      <div style={{
        width:           '100%',
        backgroundColor: '#090D16',
        padding:         '8px 0 4px 0',
        textAlign:       'center',
        flexShrink:      0,
        borderBottom:    '1px solid rgba(255,255,255,0.02)',
      }}>
        <span style={{
          fontSize:      11,
          fontWeight:    600,
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          color:         error ? '#FF4D4D' : saving ? '#CCFF00' : 'rgba(255,255,255,0.3)',
          transition:    'color 0.2s ease',
        }}>
          {getSaveLabel()}
        </span>
      </div>

      {/* Main canvas */}
      <main style={{
        flex:          1,
        overflowY:     'auto',
        display:       'flex',
        flexDirection: 'column',
        alignItems:    'center',
        padding:       16,
        paddingBottom: 240,
        boxSizing:     'border-box',
      }}>
        {activePage && (
          <div style={{ position: 'relative', width: '100%', maxWidth: 448 }}>
            <StoryPageBlock
              page={activePage}
              characters={characters}
              isActive={true}
              onPageUpdate={(patch) => {
                updatePage(activePage.id, patch)
                if (patch.illustrationUrl || patch.illustrationPrompt) {
                  dismissHint('illustration')
                }
              }}
              onAddTextBlock={handleAddText}
              onAddSpeechBubble={handleAddBubble}
            />

            {hints.illustration && !activePage.illustrationUrl && (
              <div style={{
                position:        'absolute',
                top:             '50%',
                left:            '50%',
                transform:       'translate(-50%, -50%)',
                backgroundColor: 'rgba(204,255,0,0.96)',
                color:           '#090D16',
                padding:         '12px 16px',
                borderRadius:    8,
                fontSize:        12,
                fontWeight:      700,
                textAlign:       'center',
                boxShadow:       '0 16px 40px rgba(0,0,0,0.6)',
                zIndex:          50,
                pointerEvents:   'none',
                width:           '75%',
                animation:       'slideInUp 0.3s ease forwards',
              }}>
                📸 Tap the canvas to upload your illustration
              </div>
            )}
          </div>
        )}
      </main>

      {/* Fixed footer */}
      <footer style={{
        position:      'fixed',
        bottom:        0,
        left:          '50%',
        transform:     'translateX(-50%)',
        width:         '100%',
        maxWidth:      480,
        zIndex:        300,
        boxSizing:     'border-box',
        display:       'flex',
        flexDirection: 'column',
        pointerEvents: 'none',
      }}>

        {/* Sequential hint strip */}
        <div style={{
          padding:        '0 16px 8px 16px',
          boxSizing:      'border-box',
          display:        'flex',
          justifyContent: 'center',
          width:          '100%',
        }}>
          {hints.text && !hints.illustration && (
            <div style={HINT_STYLE}>
              📝 Tap Text to add a caption or heading
            </div>
          )}
          {hints.bubble && !hints.text && !hints.illustration && (
            <div style={HINT_STYLE}>
              💬 Tap Bubble to give a character a voice
            </div>
          )}
          {hints.publish && !hints.bubble && !hints.text && !hints.illustration && (
            <div style={HINT_STYLE}>
              🚀 Tap Publish when your story is ready
            </div>
          )}
          {hints.pages && pages.length < 2 && !hints.illustration && !hints.text && !hints.bubble && (
            <div style={HINT_STYLE}>
              📄 Tap + to add your next page
            </div>
          )}
        </div>

        {/* Controls */}
        <div style={{ pointerEvents: 'auto', backgroundColor: '#090D16' }}>
          <StoryToolbar
            onAddText={handleAddText}
            onAddBubble={handleAddBubble}
            characters={characters}
            onAddCharacter={() => { setCharacterDrawerOpen(true); dismissHint('characters') }}
            onSave={saveNow}
            onPublish={() => { setPublishDrawerOpen(true); dismissHint('publish'); return Promise.resolve(true) }}
            saving={saving}
          />
          <StoryPageNav
            pages={pages}
            activeIndex={activeIndex}
            onSelect={(i) => { setActiveIndex(i); dismissHint('pages') }}
            onAdd={() => { addPage(); dismissHint('pages') }}
            onDelete={(index) => deletePage(pages[index].id)}
            onMove={movePage}
          />
        </div>
      </footer>

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
        onPublish={async () => { const ok = await publishStory(); if (ok) completeOnboarding(); return ok }}
        pageCount={pages.length}
      />
    </div>
  )
}
