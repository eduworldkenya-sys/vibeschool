"use client";
'use client'

import React, { useState } from 'react'
import { StoryCharacter } from '@/lib/storyTypes'

interface StoryToolbarProps {
  onAddText:      () => void
  onAddBubble:    (characterId: string | null) => void
  characters:     StoryCharacter[]
  onAddCharacter: () => void
  onSave:         () => void
  onPublish:      () => Promise<boolean>
  saving:         boolean
}

export function StoryToolbar({
  onAddText,
  onAddBubble,
  characters,
  onAddCharacter,
  onSave,
  onPublish,
  saving,
}: StoryToolbarProps) {
  const [showCastPicker, setShowCastPicker] = useState(false)
  const [publishing,     setPublishing]     = useState(false)

  const handlePublish = async (e: React.MouseEvent) => {
    e.stopPropagation()
    if (publishing || saving) return
    setPublishing(true)
    try { await onPublish() }
    catch (err) { console.error('Publish failed:', err) }
    finally { setPublishing(false) }
  }

  return (
    <div
      onClick={() => setShowCastPicker(false)}
      style={{
        position:        'fixed',
        bottom:          96,
        left:            '50%',
        transform:       'translateX(-50%)',
        width:           'calc(100% - 32px)',
        maxWidth:        448,
        backgroundColor: '#111827',
        border:          '1px solid #1a2235',
        borderRadius:    16,
        padding:         '12px 16px',
        boxSizing:       'border-box',
        display:         'flex',
        alignItems:      'center',
        justifyContent:  'space-between',
        zIndex:          500,
        boxShadow:       '0 20px 40px -5px rgba(0,0,0,0.8)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <button
          onClick={e => { e.stopPropagation(); onAddText() }}
          style={{
            backgroundColor: '#1a2235',
            color:           '#ffffff',
            border:          '1px solid rgba(255,255,255,0.05)',
            padding:         '10px 14px',
            borderRadius:    10,
            fontSize:        13,
            fontWeight:      600,
            cursor:          'pointer',
            display:         'flex',
            alignItems:      'center',
            gap:             6,
          }}
        >
          📝 Text
        </button>

        <div style={{ position: 'relative' }}>
          <button
            onClick={e => { e.stopPropagation(); setShowCastPicker(p => !p) }}
            style={{
              backgroundColor: '#1a2235',
              color:           '#CCFF00',
              border:          '1px solid rgba(204,255,0,0.15)',
              padding:         '10px 14px',
              borderRadius:    10,
              fontSize:        13,
              fontWeight:      600,
              cursor:          'pointer',
              display:         'flex',
              alignItems:      'center',
              gap:             6,
            }}
          >
            💬 Bubble
          </button>

          {showCastPicker && (
            <div
              onClick={e => e.stopPropagation()}
              style={{
                position:        'absolute',
                bottom:          54,
                left:            0,
                backgroundColor: '#111827',
                border:          '1px solid #1a2235',
                borderRadius:    12,
                padding:         8,
                width:           220,
                boxShadow:       '0 10px 30px rgba(0,0,0,0.75)',
                display:         'flex',
                flexDirection:   'column',
                gap:             4,
                zIndex:          600,
              }}
            >
              <div style={{
                fontSize:      10,
                color:         'rgba(255,255,255,0.4)',
                fontWeight:    700,
                padding:       '4px 6px',
                letterSpacing: '0.05em',
                textTransform: 'uppercase',
              }}>
                Assign Speaker
              </div>

              <button
                onClick={() => { onAddBubble(null); setShowCastPicker(false) }}
                style={{
                  backgroundColor: 'transparent',
                  color:           '#ffffff',
                  border:          'none',
                  padding:         8,
                  borderRadius:    6,
                  textAlign:       'left',
                  fontSize:        12,
                  fontWeight:      500,
                  cursor:          'pointer',
                  display:         'flex',
                  alignItems:      'center',
                  gap:             8,
                }}
              >
                👤 Narrator
              </button>

              {characters.map(char => (
                <button
                  key={char.id}
                  onClick={() => { onAddBubble(char.id); setShowCastPicker(false) }}
                  style={{
                    backgroundColor: 'transparent',
                    color:           '#ffffff',
                    border:          'none',
                    padding:         8,
                    borderRadius:    6,
                    textAlign:       'left',
                    fontSize:        12,
                    fontWeight:      500,
                    cursor:          'pointer',
                    display:         'flex',
                    alignItems:      'center',
                    gap:             8,
                  }}
                >
                  <span style={{
                    width:           20,
                    height:          20,
                    borderRadius:    '50%',
                    backgroundColor: char.color,
                    display:         'flex',
                    alignItems:      'center',
                    justifyContent:  'center',
                    fontSize:        11,
                    flexShrink:      0,
                  }}>
                    {char.emoji}
                  </span>
                  <span style={{
                    overflow:     'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace:   'nowrap',
                  }}>
                    {char.name || 'Unnamed'}
                  </span>
                </button>
              ))}

              <div style={{ height: 1, backgroundColor: '#1a2235', margin: '4px 0' }} />

              <button
                onClick={() => { onAddCharacter(); setShowCastPicker(false) }}
                style={{
                  backgroundColor: 'rgba(204,255,0,0.06)',
                  color:           '#CCFF00',
                  border:          '1px dashed rgba(204,255,0,0.3)',
                  padding:         8,
                  borderRadius:    6,
                  fontSize:        11,
                  fontWeight:      700,
                  cursor:          'pointer',
                  textAlign:       'center',
                }}
              >
                + New Character
              </button>
            </div>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <button
          onClick={e => { e.stopPropagation(); onSave() }}
          disabled={saving}
          style={{
            backgroundColor: 'transparent',
            color:           saving ? '#CCFF00' : 'rgba(255,255,255,0.4)',
            border:          'none',
            padding:         8,
            cursor:          saving ? 'not-allowed' : 'pointer',
            fontSize:        16,
          }}
        >
          {saving ? '⏳' : '💾'}
        </button>

        <button
          onClick={handlePublish}
          disabled={saving || publishing}
          style={{
            backgroundColor: '#CCFF00',
            color:           '#090D16',
            border:          'none',
            padding:         '10px 18px',
            borderRadius:    10,
            fontSize:        13,
            fontWeight:      700,
            cursor:          (saving || publishing) ? 'not-allowed' : 'pointer',
            opacity:         (saving || publishing) ? 0.6 : 1,
            transition:      'opacity 0.15s ease',
          }}
        >
          {publishing ? 'Publishing…' : 'Publish 🚀'}
        </button>
      </div>
    </div>
  )
}
