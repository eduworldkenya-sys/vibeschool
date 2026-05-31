'use client'

import React from 'react'
import { StoryCharacter } from '@/lib/storyTypes'

interface StoryCharacterDrawerProps {
  characters: StoryCharacter[]
  isOpen:     boolean
  onClose:    () => void
  onAdd:      () => void
  onUpdate:   (id: string, patch: Partial<StoryCharacter>) => void
  onRemove:   (id: string) => void
}

const EMOJI_POOL = ['🦁','🐘','🦊','🐬','🦋','🐸','🦉','🐼','🦒','🐧','🐯','🦓','🦔','🐲','🧒','👧','👦','👩','👨','🧙']
const COLOR_POOL = ['#FF6B6B','#4ECDC4','#45B7D1','#96CEB4','#FFEAA7','#DDA0DD','#98D8C8','#FF8C42','#6BCB77','#4D96FF']

export function StoryCharacterDrawer({
  characters,
  isOpen,
  onClose,
  onAdd,
  onUpdate,
  onRemove,
}: StoryCharacterDrawerProps) {

  const handleEmojiCycle = (id: string, currentEmoji: string) => {
    const currentIndex = EMOJI_POOL.indexOf(currentEmoji)
    const nextIndex = (currentIndex + 1) % EMOJI_POOL.length
    onUpdate(id, { emoji: EMOJI_POOL[nextIndex] })
  }

  const handleColorCycle = (id: string, currentColor: string) => {
    const currentIndex = COLOR_POOL.indexOf(currentColor)
    const nextIndex = (currentIndex + 1) % COLOR_POOL.length
    onUpdate(id, { color: COLOR_POOL[nextIndex] })
  }

  return (
    <>
      <div
        onClick={onClose}
        style={{
          position:        'fixed',
          inset:           0,
          backgroundColor: 'rgba(0,0,0,0.75)',
          backdropFilter:  'blur(4px)',
          zIndex:          900,
          display:         isOpen ? 'block' : 'none',
          transition:      'opacity 0.25s ease',
        }}
      />

      <div
        style={{
          position:             'fixed',
          bottom:               0,
          left:                 '50%',
          transform:            isOpen ? 'translateX(-50%) translateY(0)' : 'translateX(-50%) translateY(100%)',
          width:                '100%',
          maxWidth:             480,
          height:               '60%',
          backgroundColor:      '#111827',
          borderTopLeftRadius:  24,
          borderTopRightRadius: 24,
          borderTop:            '1px solid #1a2235',
          zIndex:               951,
          display:              'flex',
          flexDirection:        'column',
          boxSizing:            'border-box',
          transition:           'transform 0.3s cubic-bezier(0.16,1,0.3,1)',
          overflow:             'hidden',
          boxShadow:            '0 -10px 40px rgba(0,0,0,0.8)',
        }}
      >
        <div style={{
          width:           36,
          height:          4,
          backgroundColor: '#1a2235',
          borderRadius:    2,
          margin:          '12px auto 4px auto',
          flexShrink:      0,
        }} />

        <div style={{
          display:        'flex',
          alignItems:     'center',
          justifyContent: 'space-between',
          padding:        '8px 20px 16px 20px',
          borderBottom:   '1px solid rgba(255,255,255,0.04)',
          flexShrink:     0,
        }}>
          <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#ffffff', letterSpacing: '-0.02em' }}>
            Story Cast
          </h3>
          <button
            onClick={onClose}
            style={{
              backgroundColor: '#1a2235',
              color:           '#CCFF00',
              border:          '1px solid #1a2235',
              width:           28,
              height:          28,
              borderRadius:    '50%',
              fontSize:        16,
              display:         'flex',
              alignItems:      'center',
              justifyContent:  'center',
              cursor:          'pointer',
              padding:         0,
            }}
          >
            ×
          </button>
        </div>

        <div style={{
          flex:          1,
          overflowY:     'auto',
          padding:       '16px 20px',
          boxSizing:     'border-box',
          display:       'flex',
          flexDirection: 'column',
          gap:           14,
        }}>
          {characters.length === 0 ? (
            <div style={{
              display:        'flex',
              flexDirection:  'column',
              alignItems:     'center',
              justifyContent: 'center',
              padding:        '40px 0',
              textAlign:      'center',
            }}>
              <span style={{ fontSize: 36, marginBottom: 12 }}>🎭</span>
              <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13, margin: 0 }}>
                No characters yet
              </p>
            </div>
          ) : (
            characters.map((char) => (
              <div
                key={char.id}
                style={{
                  display:         'flex',
                  alignItems:      'center',
                  backgroundColor: '#1a2235',
                  border:          '1px solid #1a2235',
                  borderRadius:    12,
                  padding:         '8px 12px',
                  gap:             12,
                  boxSizing:       'border-box',
                }}
              >
                <button
                  onClick={() => handleEmojiCycle(char.id, char.emoji)}
                  style={{
                    backgroundColor: char.color,
                    border:          'none',
                    borderRadius:    '50%',
                    width:           32,
                    height:          32,
                    fontSize:        18,
                    display:         'flex',
                    alignItems:      'center',
                    justifyContent:  'center',
                    cursor:          'pointer',
                    padding:         0,
                    flexShrink:      0,
                  }}
                >
                  {char.emoji}
                </button>

                <input
                  type="text"
                  value={char.name}
                  onChange={(e) => onUpdate(char.id, { name: e.target.value })}
                  placeholder="Character name..."
                  style={{
                    flex:            1,
                    backgroundColor: '#090D16',
                    border:          '1px solid #1a2235',
                    color:           '#ffffff',
                    fontSize:        13,
                    fontWeight:      600,
                    outline:         'none',
                    padding:         '8px 12px',
                    borderRadius:    8,
                  }}
                />

                <button
                  onClick={() => handleColorCycle(char.id, char.color)}
                  style={{
                    width:           20,
                    height:          20,
                    borderRadius:    '50%',
                    backgroundColor: char.color,
                    border:          '2px solid #090D16',
                    boxShadow:       '0 0 0 1px rgba(255,255,255,0.1)',
                    cursor:          'pointer',
                    padding:         0,
                    flexShrink:      0,
                  }}
                />

                <button
                  disabled={characters.length <= 1}
                  onClick={() => onRemove(char.id)}
                  style={{
                    backgroundColor: 'transparent',
                    color:           characters.length <= 1 ? '#1a2235' : '#FF4D4D',
                    border:          'none',
                    fontSize:        18,
                    fontWeight:      700,
                    cursor:          characters.length <= 1 ? 'not-allowed' : 'pointer',
                    opacity:         characters.length <= 1 ? 0.3 : 1,
                    padding:         '0 4px',
                    display:         'flex',
                    alignItems:      'center',
                    justifyContent:  'center',
                  }}
                >
                  ×
                </button>
              </div>
            ))
          )}
        </div>

        <div style={{
          padding:         '16px 20px 24px 20px',
          borderTop:       '1px solid rgba(255,255,255,0.04)',
          backgroundColor: '#111827',
          flexShrink:      0,
        }}>
          <button
            onClick={onAdd}
            style={{
              width:           '100%',
              backgroundColor: 'rgba(204,255,0,0.08)',
              color:           '#CCFF00',
              border:          '1px dashed rgba(204,255,0,0.3)',
              padding:         '14px',
              borderRadius:    12,
              fontSize:        14,
              fontWeight:      700,
              cursor:          'pointer',
              display:         'flex',
              alignItems:      'center',
              justifyContent:  'center',
              gap:             8,
            }}
          >
            <span>✨</span> Add New Character
          </button>
        </div>
      </div>
    </>
  )
}
