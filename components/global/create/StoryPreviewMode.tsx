"use client";
'use client'

import React, { useState, useRef, useEffect } from 'react'
import { StoryPage, StoryCharacter, StorySpeechBubble } from '@/lib/storyTypes'

interface StoryPreviewModeProps {
  pages:      StoryPage[]
  characters: StoryCharacter[]
  storyTitle: string
  isOpen:     boolean
  onClose:    () => void
}

export function StoryPreviewMode({
  pages,
  characters,
  storyTitle,
  isOpen,
  onClose,
}: StoryPreviewModeProps) {
  const [activeIndex, setActiveIndex] = useState(0)
  const [fade,        setFade]        = useState(1)
  const [dimensions,  setDimensions]  = useState({ width: 480, height: 360 })

  const containerRef   = useRef<HTMLDivElement>(null)
  const touchStartXRef = useRef<number | null>(null)

  useEffect(() => {
    if (!containerRef.current) return
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect
        if (width > 0 && height > 0) setDimensions({ width, height })
      }
    })
    ro.observe(containerRef.current)
    return () => ro.disconnect()
  }, [isOpen])

  if (!isOpen || pages.length === 0) return null

  const activePage = pages[activeIndex] || pages[0]

  const changePage = (nextIndex: number) => {
    if (nextIndex < 0 || nextIndex >= pages.length) return
    setFade(0)
    setTimeout(() => { setActiveIndex(nextIndex); setFade(1) }, 150)
  }

  const handleTouchStart = (e: React.TouchEvent) => {
    const touch = e.touches[0]
    if (touch) touchStartXRef.current = touch.clientX
  }

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartXRef.current === null) return
    const touch = e.changedTouches[0]
    if (!touch) return
    const diffX = touchStartXRef.current - touch.clientX
    if (Math.abs(diffX) > 50) {
      if (diffX > 0) changePage(activeIndex + 1)
      else           changePage(activeIndex - 1)
    }
    touchStartXRef.current = null
  }

  const resolveCharacterName = (characterId: string | null): string | null => {
    if (!characterId) return null
    return characters.find((c) => c.id === characterId)?.name ?? null
  }

  const getShapeStyles = (bubble: StorySpeechBubble): React.CSSProperties => {
    const core: React.CSSProperties = {
      position:        'relative',
      width:           '100%',
      padding:         '12px 16px',
      backgroundColor: bubble.bgColor || '#ffffff',
      color:           bubble.textColor || '#000000',
      boxSizing:       'border-box',
    }
    switch (bubble.shape) {
      case 'thought':
        return { ...core, borderRadius: '24px', border: '2px dotted rgba(0,0,0,0.2)' }
      case 'shout':
        return { ...core, borderRadius: '0px', border: '3px solid #000000', boxShadow: '5px 5px 0px #FF1493' }
      case 'whisper':
        return { ...core, borderRadius: '16px', border: '1px dashed rgba(0,0,0,0.3)', fontStyle: 'italic', opacity: 0.9 }
      case 'speech':
      default:
        return { ...core, borderRadius: '16px', border: '2px solid rgba(0,0,0,0.1)' }
    }
  }

  const getTailStyle = (
    direction: StorySpeechBubble['tailDirection'],
    color: string
  ): React.CSSProperties => {
    const base: React.CSSProperties = {
      position:    'absolute',
      width:       '0px',
      height:      '0px',
      borderStyle: 'solid',
    }
    const c = color || '#ffffff'
    switch (direction) {
      case 'left':
        return { ...base, left: '-12px', top: '50%', transform: 'translateY(-50%)', borderWidth: '8px 12px 8px 0', borderColor: 'transparent ' + c + ' transparent transparent' }
      case 'right':
        return { ...base, right: '-12px', top: '50%', transform: 'translateY(-50%)', borderWidth: '8px 0 8px 12px', borderColor: 'transparent transparent transparent ' + c }
      case 'up':
        return { ...base, top: '-12px', left: '50%', transform: 'translateX(-50%)', borderWidth: '0 8px 12px 8px', borderColor: 'transparent transparent ' + c + ' transparent' }
      case 'down':
      default:
        return { ...base, bottom: '-12px', left: '50%', transform: 'translateX(-50%)', borderWidth: '12px 8px 0 8px', borderColor: c + ' transparent transparent transparent' }
    }
  }

  return (
    <div
      style={{
        position:        'fixed',
        inset:           0,
        zIndex:          1000,
        backgroundColor: '#090D16',
        display:         'flex',
        flexDirection:   'column',
        boxSizing:       'border-box',
      }}
    >
      {/* Header */}
      <div
        style={{
          width:           '100%',
          height:          '56px',
          borderBottom:    '1px solid #1a2235',
          display:         'flex',
          alignItems:      'center',
          justifyContent:  'space-between',
          padding:         '0 16px',
          boxSizing:       'border-box',
          backgroundColor: '#111827',
        }}
      >
        <button
          onClick={onClose}
          style={{
            backgroundColor: 'transparent',
            border:          'none',
            color:           '#CCFF00',
            fontSize:        '22px',
            cursor:          'pointer',
            padding:         '4px 8px',
          }}
        >
          ←
        </button>
        <div
          style={{
            color:        '#ffffff',
            fontSize:     '15px',
            fontWeight:   700,
            maxWidth:     '220px',
            overflow:     'hidden',
            textOverflow: 'ellipsis',
            whiteSpace:   'nowrap',
          }}
        >
          {storyTitle || 'Untitled Story'}
        </div>
        <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '12px', fontWeight: 500 }}>
          Page {activeIndex + 1} of {pages.length}
        </div>
      </div>

      {/* Canvas */}
      <div
        style={{
          flex:           1,
          display:        'flex',
          alignItems:     'center',
          justifyContent: 'center',
          padding:        '16px',
          boxSizing:      'border-box',
        }}
      >
        <div
          ref={containerRef}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
          style={{
            position:        'relative',
            width:           '100%',
            maxWidth:        '480px',
            aspectRatio:     '4 / 3',
            backgroundColor: activePage.backgroundColor || '#111827',
            borderRadius:    '16px',
            overflow:        'hidden',
            boxSizing:       'border-box',
            boxShadow:       '0 20px 40px rgba(0,0,0,0.6)',
            opacity:         fade,
            transition:      'opacity 0.15s ease-in-out',
          }}
        >
          {activePage.illustrationUrl && (
            <img
              src={activePage.illustrationUrl}
              alt=""
              style={{
                position:      'absolute',
                inset:         0,
                width:         '100%',
                height:        '100%',
                objectFit:     'cover',
                pointerEvents: 'none',
              }}
            />
          )}

          <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
            {activePage.textBlocks.map((block) => {
              const leftPx = (block.x / 100) * dimensions.width
              const topPx  = (block.y / 100) * dimensions.height
              const fontStack =
                block.fontFamily === 'bold'        ? '"Arial Black", Impact, sans-serif' :
                block.fontFamily === 'handwritten' ? '"Comic Sans MS", cursive, sans-serif' :
                block.fontFamily === 'serif'       ? 'Georgia, Cambria, serif' :
                'system-ui, sans-serif'
              return (
                <div
                  key={block.id}
                  style={{
                    position:   'absolute',
                    left:       leftPx,
                    top:        topPx,
                    transform:  'translate(-50%, -50%)',
                    width:      '85%',
                    boxSizing:  'border-box',
                    fontFamily: fontStack,
                    fontSize:   block.fontSize,
                    color:      block.color || '#ffffff',
                    fontWeight: block.bold   ? 'bold'   : 'normal',
                    fontStyle:  block.italic ? 'italic' : 'normal',
                    textAlign:  block.align  || 'center',
                    wordBreak:  'break-word',
                    whiteSpace: 'pre-wrap',
                  }}
                >
                  {block.text}
                </div>
              )
            })}

            {activePage.speechBubbles.map((bubble) => {
              const leftPx      = (bubble.x     / 100) * dimensions.width
              const topPx       = (bubble.y     / 100) * dimensions.height
              const widthPx     = (bubble.width / 100) * dimensions.width
              const charName    = resolveCharacterName(bubble.characterId)
              return (
                <div
                  key={bubble.id}
                  style={{
                    position:      'absolute',
                    left:          leftPx,
                    top:           topPx,
                    transform:     'translate(-50%, -50%)',
                    width:         widthPx,
                    display:       'flex',
                    flexDirection: 'column',
                    alignItems:    'center',
                    boxSizing:     'border-box',
                  }}
                >
                  {charName && (
                    <div style={{
                      alignSelf:       'flex-start',
                      backgroundColor: '#111827',
                      color:           '#ffffff',
                      fontSize:        '9px',
                      fontWeight:      700,
                      padding:         '1px 6px',
                      borderRadius:    '3px',
                      marginBottom:    '3px',
                      border:          '1px solid #1a2235',
                      textTransform:   'uppercase',
                    }}>
                      {charName}
                    </div>
                  )}
                  <div style={getShapeStyles(bubble)}>
                    <div
                      style={{
                        fontFamily: 'system-ui, sans-serif',
                        fontSize:   bubble.fontSize,
                        fontWeight: bubble.shape === 'shout'   ? 800   : 500,
                        fontStyle:  bubble.shape === 'whisper' ? 'italic' : 'normal',
                        textAlign:  'center',
                        wordBreak:  'break-word',
                        whiteSpace: 'pre-wrap',
                        lineHeight: 1.3,
                      }}
                    >
                      {bubble.text}
                    </div>
                    {bubble.shape === 'speech' && (
                      <div style={getTailStyle(bubble.tailDirection, bubble.bgColor)} />
                    )}
                    {bubble.shape === 'thought' && (
                      <div style={{
                        position:        'absolute',
                        bottom:          '-9px',
                        left:            '35%',
                        width:           '7px',
                        height:          '7px',
                        backgroundColor: bubble.bgColor || '#ffffff',
                        borderRadius:    '50%',
                      }} />
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div
        style={{
          width:           '100%',
          backgroundColor: '#111827',
          borderTop:       '1px solid #1a2235',
          padding:         '16px 24px 24px 24px',
          boxSizing:       'border-box',
          display:         'flex',
          flexDirection:   'column',
          alignItems:      'center',
          gap:             '16px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '48px' }}>
          <button
            disabled={activeIndex === 0}
            onClick={() => changePage(activeIndex - 1)}
            style={{
              backgroundColor: activeIndex === 0 ? 'transparent' : '#1a2235',
              color:           activeIndex === 0 ? '#374151' : '#CCFF00',
              border:          activeIndex === 0 ? 'none' : '1px solid rgba(204,255,0,0.2)',
              width:           '44px',
              height:          '44px',
              borderRadius:    '50%',
              fontSize:        '18px',
              fontWeight:      'bold',
              cursor:          activeIndex === 0 ? 'not-allowed' : 'pointer',
              display:         'flex',
              alignItems:      'center',
              justifyContent:  'center',
            }}
          >
            ←
          </button>
          <button
            disabled={activeIndex === pages.length - 1}
            onClick={() => changePage(activeIndex + 1)}
            style={{
              backgroundColor: activeIndex === pages.length - 1 ? 'transparent' : '#1a2235',
              color:           activeIndex === pages.length - 1 ? '#374151' : '#CCFF00',
              border:          activeIndex === pages.length - 1 ? 'none' : '1px solid rgba(204,255,0,0.2)',
              width:           '44px',
              height:          '44px',
              borderRadius:    '50%',
              fontSize:        '18px',
              fontWeight:      'bold',
              cursor:          activeIndex === pages.length - 1 ? 'not-allowed' : 'pointer',
              display:         'flex',
              alignItems:      'center',
              justifyContent:  'center',
            }}
          >
            →
          </button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {pages.map((_, idx) => (
            <div
              key={idx}
              style={{
                width:           idx === activeIndex ? '10px' : '6px',
                height:          idx === activeIndex ? '10px' : '6px',
                borderRadius:    '50%',
                backgroundColor: idx === activeIndex ? '#CCFF00' : 'rgba(255,255,255,0.2)',
                transition:      'all 0.15s ease-in-out',
              }}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
