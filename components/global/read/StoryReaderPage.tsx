'use client'

import React from 'react'
import { StoryPage, StoryCharacter } from '@/lib/storyTypes'

interface StoryReaderPageProps {
  page: StoryPage
  characters: StoryCharacter[]
  isActive: boolean
  direction: 'left' | 'right' | 'none'
  onNext: () => void
  onPrev: () => void
  onToggleChrome: () => void
}

const ENTRY_RIGHT = '@keyframes entryFromRight { from { transform: translateX(100%); } to { transform: translateX(0); } }'
const ENTRY_LEFT  = '@keyframes entryFromLeft { from { transform: translateX(-100%); } to { transform: translateX(0); } }'
const KEYFRAMES   = ENTRY_RIGHT + ' ' + ENTRY_LEFT

export function StoryReaderPage({
  page,
  characters,
  isActive,
  direction,
  onNext,
  onPrev,
  onToggleChrome,
}: StoryReaderPageProps) {
  if (!isActive) return null

  const imageUrl  = page.illustrationUrl  || ''
  const defaultBg = page.backgroundColor || '#090D16'

  const animationName =
    direction === 'right' ? 'entryFromRight' :
    direction === 'left'  ? 'entryFromLeft'  : 'none'

  return (
    <div style={{
      position:        'fixed',
      inset:           0,
      zIndex:          100,
      overflow:        'hidden',
      userSelect:      'none',
      backgroundColor: imageUrl ? '#000000' : defaultBg,
    }}>
      <style dangerouslySetInnerHTML={{ __html: KEYFRAMES }} />

      <div style={{
        position:           'absolute',
        inset:              0,
        width:              '100%',
        height:             '100%',
        backgroundImage:    imageUrl ? 'url(' + imageUrl + ')' : 'none',
        backgroundSize:     'cover',
        backgroundPosition: 'center',
        animationName:           direction !== 'none' ? animationName : undefined,
        animationDuration:       '0.35s',
        animationTimingFunction: 'cubic-bezier(0.2,0.8,0.2,1)',
        animationFillMode:       'forwards',
      }}>

        {!!imageUrl && (
          <div style={{
            position:        'absolute',
            inset:           0,
            backgroundColor: 'rgba(0,0,0,0.25)',
            zIndex:          1,
          }} />
        )}

        {/* Text blocks */}
        <div style={{ position: 'absolute', inset: 0, zIndex: 10, pointerEvents: 'none' }}>
          {page.textBlocks?.map((block) => (
            <div
              key={block.id}
              style={{
                position:        'absolute',
                left:            block.x + '%',
                top:             block.y + '%',
                color:           block.color || '#FFFFFF',
                fontSize:        block.fontSize || 18,
                fontWeight:      block.bold ? 700 : 400,
                fontStyle:       block.italic ? 'italic' : 'normal',
                fontFamily:      block.fontFamily === 'handwritten' ? 'cursive' : block.fontFamily === 'serif' ? 'serif' : 'system-ui',
                lineHeight:      1.4,
                maxWidth:        '80%',
                backgroundColor: 'rgba(9,13,22,0.85)',
                backdropFilter:  'blur(8px)',
                paddingTop:      12,
                paddingBottom:   12,
                paddingLeft:     18,
                paddingRight:    18,
                borderRadius:    14,
                border:          '1px solid rgba(255,255,255,0.08)',
                boxShadow:       '0 8px 24px rgba(0,0,0,0.35)',
              }}
            >
              {block.text}
            </div>
          ))}

          {/* Speech bubbles */}
          {page.speechBubbles?.map((bubble) => {
            const character = characters.find((c) => c.id === bubble.characterId)

            let borderStyle: React.CSSProperties['border'] = 'none'
            let boxShadow = '0 6px 18px rgba(0,0,0,0.15)'
            let fontWeight: React.CSSProperties['fontWeight'] = 700
            let fontStyle: React.CSSProperties['fontStyle']   = 'normal'

            if (bubble.shape === 'thought') {
              borderStyle = '3px dotted #9CA3AF'
            } else if (bubble.shape === 'shout') {
              borderStyle = '4px solid #000000'
              boxShadow   = '0 12px 28px rgba(0,0,0,0.4)'
              fontWeight  = 900
            } else if (bubble.shape === 'whisper') {
              borderStyle = '2px dashed #D1D5DB'
              fontStyle   = 'italic'
              fontWeight  = 500
            }

            return (
              <div
                key={bubble.id}
                style={{
                  position: 'absolute',
                  left:     bubble.x + '%',
                  top:      bubble.y + '%',
                  maxWidth: '65%',
                }}
              >
                {!!character?.name && (
                  <div style={{
                    backgroundColor: '#111827',
                    color:           '#FFFFFF',
                    fontSize:        11,
                    fontWeight:      700,
                    paddingTop:      3,
                    paddingBottom:   3,
                    paddingLeft:     8,
                    paddingRight:    8,
                    borderRadius:    6,
                    display:         'inline-block',
                    marginBottom:    4,
                    marginLeft:      8,
                  }}>
                    {character.name}
                  </div>
                )}

                <div style={{
                  backgroundColor: bubble.bgColor || '#FFFFFF',
                  paddingTop:      12,
                  paddingBottom:   12,
                  paddingLeft:     16,
                  paddingRight:    16,
                  borderRadius:    18,
                  border:          borderStyle,
                  boxShadow:       boxShadow,
                  position:        'relative',
                }}>
                  <div style={{
                    color:      bubble.textColor || '#090D16',
                    fontSize:   bubble.fontSize  || 15,
                    fontWeight: fontWeight,
                    fontStyle:  fontStyle,
                    lineHeight: 1.3,
                  }}>
                    {bubble.text}
                  </div>

                  {bubble.shape !== 'thought' && (
                    <div style={{
                      position:        'absolute',
                      bottom:          -6,
                      left:            24,
                      width:           12,
                      height:          12,
                      backgroundColor: bubble.bgColor || '#FFFFFF',
                      transform:       'rotate(45deg)',
                      zIndex:          -1,
                    }} />
                  )}
                </div>
              </div>
            )
          })}
        </div>

        {/* Tap zones */}
        <div style={{ position: 'absolute', inset: 0, zIndex: 20, display: 'flex' }}>
          <div
            onClick={(e) => { e.stopPropagation(); onPrev() }}
            style={{ width: '30%', height: '100%', cursor: 'w-resize' }}
          />
          <div
            onClick={(e) => { e.stopPropagation(); onToggleChrome() }}
            style={{ width: '40%', height: '100%' }}
          />
          <div
            onClick={(e) => { e.stopPropagation(); onNext() }}
            style={{ width: '30%', height: '100%', cursor: 'e-resize' }}
          />
        </div>
      </div>
    </div>
  )
}
