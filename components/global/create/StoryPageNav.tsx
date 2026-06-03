"use client";
'use client'

import React, { useState, useRef } from 'react'
import { StoryPage } from '@/lib/storyTypes'

interface StoryPageNavProps {
  pages:       StoryPage[]
  activeIndex: number
  onSelect:    (index: number) => void
  onAdd:       () => void
  onDelete:    (index: number) => void
  onMove:      (from: number, to: number) => void
}

export function StoryPageNav({
  pages,
  activeIndex,
  onSelect,
  onAdd,
  onDelete,
  onMove,
}: StoryPageNavProps) {
  const [activeMenuIndex, setActiveMenuIndex] = useState<number | null>(null)
  const pressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handlePressStart = (index: number) => {
    if (pressTimerRef.current) clearTimeout(pressTimerRef.current)
    pressTimerRef.current = setTimeout(() => setActiveMenuIndex(index), 500)
  }

  const handlePressEnd = (index: number) => {
    if (pressTimerRef.current) {
      clearTimeout(pressTimerRef.current)
      pressTimerRef.current = null
    }
    if (activeMenuIndex === null) onSelect(index)
  }

  const closeMenu = (e: React.MouseEvent) => {
    e.stopPropagation()
    setActiveMenuIndex(null)
  }

  return (
    <div
      onClick={() => setActiveMenuIndex(null)}
      style={{
        position:        'relative',
        width:           '100%',
        maxWidth:        480,
        height:          80,
        backgroundColor: '#090D16',
        borderTop:       '1px solid #1a2235',
        display:         'flex',
        alignItems:      'center',
        boxSizing:       'border-box',
        overflow:        'visible',
      }}
    >
      <style>{`::-webkit-scrollbar{display:none}`}</style>

      <div style={{
        width:                    '100%',
        height:                   '100%',
        display:                  'flex',
        alignItems:               'center',
        gap:                      12,
        padding:                  '0 16px',
        overflowX:                'auto',
        overflowY:                'visible',
        WebkitOverflowScrolling:  'touch',
        scrollbarWidth:           'none',
        boxSizing:                'border-box',
      }}>
        {pages.map((page, index) => {
          const isSelected = index === activeIndex
          const isMenuOpen = activeMenuIndex === index

          return (
            <div
              key={page.id}
              onClick={e => { e.stopPropagation(); handlePressEnd(index) }}
              onMouseDown={() => handlePressStart(index)}
              onMouseUp={() => { if (pressTimerRef.current) clearTimeout(pressTimerRef.current) }}
              onMouseLeave={() => { if (pressTimerRef.current) clearTimeout(pressTimerRef.current) }}
              onTouchStart={() => handlePressStart(index)}
              onTouchEnd={() => handlePressEnd(index)}
              style={{
                position:        'relative',
                width:           56,
                height:          42,
                flexShrink:      0,
                backgroundColor: page.backgroundColor || '#111827',
                borderRadius:    6,
                border:          isSelected ? '2px solid #CCFF00' : '1px solid #1a2235',
                boxSizing:       'border-box',
                cursor:          'pointer',
                overflow:        'visible',
                boxShadow:       isSelected ? '0 0 8px rgba(204,255,0,0.3)' : 'none',
              }}
            >
              {page.illustrationUrl && (
                <img
                  src={page.illustrationUrl}
                  alt=""
                  style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 4 }}
                />
              )}

              <div style={{
                position:        'absolute',
                bottom:          2,
                left:            '50%',
                transform:       'translateX(-50%)',
                backgroundColor: 'rgba(9,13,22,0.75)',
                color:           isSelected ? '#CCFF00' : '#ffffff',
                fontSize:        9,
                fontWeight:      700,
                padding:         '1px 4px',
                borderRadius:    3,
                zIndex:          2,
                pointerEvents:   'none',
              }}>
                {index + 1}
              </div>

              {isMenuOpen && (
                <div
                  onClick={e => e.stopPropagation()}
                  style={{
                    position:        'absolute',
                    bottom:          52,
                    left:            '50%',
                    transform:       'translateX(-50%)',
                    backgroundColor: '#111827',
                    border:          '1px solid #1a2235',
                    borderRadius:    8,
                    boxShadow:       '0 10px 25px -5px rgba(0,0,0,0.9)',
                    display:         'flex',
                    alignItems:      'center',
                    padding:         4,
                    zIndex:          999,
                    gap:             4,
                  }}
                >
                  <button
                    disabled={index === 0}
                    onClick={e => { closeMenu(e); onMove(index, index - 1) }}
                    style={{
                      backgroundColor: index === 0 ? 'transparent' : '#1a2235',
                      color:           index === 0 ? '#374151' : '#ffffff',
                      border:          'none',
                      padding:         '6px 8px',
                      borderRadius:    4,
                      fontSize:        11,
                      fontWeight:      700,
                      cursor:          index === 0 ? 'not-allowed' : 'pointer',
                    }}
                  >◀</button>

                  <button
                    disabled={index === pages.length - 1}
                    onClick={e => { closeMenu(e); onMove(index, index + 1) }}
                    style={{
                      backgroundColor: index === pages.length - 1 ? 'transparent' : '#1a2235',
                      color:           index === pages.length - 1 ? '#374151' : '#ffffff',
                      border:          'none',
                      padding:         '6px 8px',
                      borderRadius:    4,
                      fontSize:        11,
                      fontWeight:      700,
                      cursor:          index === pages.length - 1 ? 'not-allowed' : 'pointer',
                    }}
                  >▶</button>

                  <button
                    disabled={pages.length <= 1}
                    onClick={e => { closeMenu(e); onDelete(index) }}
                    style={{
                      backgroundColor: pages.length <= 1 ? 'transparent' : 'rgba(127,29,29,0.5)',
                      color:           pages.length <= 1 ? '#374151' : '#FF4D4D',
                      border:          'none',
                      padding:         '6px 8px',
                      borderRadius:    4,
                      fontSize:        11,
                      fontWeight:      700,
                      cursor:          pages.length <= 1 ? 'not-allowed' : 'pointer',
                    }}
                  >🗑️</button>
                </div>
              )}
            </div>
          )
        })}

        <button
          onClick={e => { e.stopPropagation(); onAdd() }}
          style={{
            width:           56,
            height:          42,
            flexShrink:      0,
            backgroundColor: '#111827',
            border:          '1px dashed rgba(255,255,255,0.2)',
            borderRadius:    6,
            display:         'flex',
            alignItems:      'center',
            justifyContent:  'center',
            color:           '#CCFF00',
            fontSize:        18,
            fontWeight:      700,
            cursor:          'pointer',
            boxSizing:       'border-box',
          }}
        >+</button>
      </div>
    </div>
  )
}
