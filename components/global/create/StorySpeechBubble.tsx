'use client'

import React, { useRef, useEffect } from 'react'
import { StorySpeechBubble as TStorySpeechBubble, BubbleShape } from '@/lib/storyTypes'

interface StorySpeechBubbleProps {
  bubble:          TStorySpeechBubble
  selected:        boolean
  characterName:   string | null
  onSelect:        () => void
  onChange:        (patch: Partial<TStorySpeechBubble>) => void
  onDelete:        () => void
  containerWidth:  number
  containerHeight: number
}

function getShapeStyles(
  bubble: TStorySpeechBubble,
  selected: boolean
): React.CSSProperties {
  const base: React.CSSProperties = {
    position:        'relative',
    width:           '100%',
    padding:         '12px 16px',
    backgroundColor: bubble.bgColor  || '#ffffff',
    color:           bubble.textColor || '#000000',
    boxSizing:       'border-box',
    transition:      'border 0.15s ease',
  }
  switch (bubble.shape) {
    case 'thought':
      return {
        ...base,
        borderRadius: 24,
        border:       selected ? '2px solid #CCFF00' : '2px dotted rgba(255,255,255,0.4)',
      }
    case 'shout':
      return {
        ...base,
        borderRadius: 0,
        border:       selected ? '2px solid #CCFF00' : '3px solid #ffffff',
        boxShadow:    '5px 5px 0px #FF1493, -5px -5px 0px #CCFF00',
      }
    case 'whisper':
      return {
        ...base,
        borderRadius: 16,
        border:       selected ? '2px solid #CCFF00' : '2px dashed rgba(255,255,255,0.3)',
        opacity:      0.85,
      }
    case 'speech':
    default:
      return {
        ...base,
        borderRadius: 16,
        border:       selected ? '2px solid #CCFF00' : '2px solid transparent',
      }
  }
}

function getTailStyle(
  direction: TStorySpeechBubble['tailDirection'],
  color: string
): React.CSSProperties {
  const base: React.CSSProperties = {
    position:    'absolute',
    width:       0,
    height:      0,
    borderStyle: 'solid',
  }
  switch (direction) {
    case 'left':
      return { ...base, left: -12, top: '50%', transform: 'translateY(-50%)', borderWidth: '8px 12px 8px 0', borderColor: `transparent ${color} transparent transparent` }
    case 'right':
      return { ...base, right: -12, top: '50%', transform: 'translateY(-50%)', borderWidth: '8px 0 8px 12px', borderColor: `transparent transparent transparent ${color}` }
    case 'up':
      return { ...base, top: -12, left: '50%', transform: 'translateX(-50%)', borderWidth: '0 8px 12px 8px', borderColor: `transparent transparent ${color} transparent` }
    case 'down':
    default:
      return { ...base, bottom: -12, left: '50%', transform: 'translateX(-50%)', borderWidth: '12px 8px 0 8px', borderColor: `${color} transparent transparent transparent` }
  }
}

export function StorySpeechBubble({
  bubble,
  selected,
  characterName,
  onSelect,
  onChange,
  onDelete,
  containerWidth,
  containerHeight,
}: StorySpeechBubbleProps) {
  const editableRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (editableRef.current && editableRef.current.innerText !== bubble.text) {
      editableRef.current.innerText = bubble.text
    }
  }, [bubble.text])

  const leftPx  = (bubble.x     / 100) * containerWidth
  const topPx   = (bubble.y     / 100) * containerHeight
  const widthPx = (bubble.width / 100) * containerWidth

  const handleBlur = () => {
    if (editableRef.current) onChange({ text: editableRef.current.innerText })
  }

  return (
    <>
      <style>{`.vibe-bubble-edit:empty::before{content:attr(placeholder);color:rgba(0,0,0,0.4);font-style:italic;display:block}`}</style>

      <div
        onClick={e => { e.stopPropagation(); onSelect() }}
        style={{
          position:      'absolute',
          left:          leftPx,
          top:           topPx,
          transform:     'translate(-50%, -50%)',
          width:         widthPx,
          zIndex:        selected ? 35 : 25,
          display:       'flex',
          flexDirection: 'column',
          alignItems:    'center',
          boxSizing:     'border-box',
        }}
      >
        {characterName && (
          <div style={{
            alignSelf:     'flex-start',
            backgroundColor: '#111827',
            color:         '#ffffff',
            fontSize:      10,
            fontWeight:    700,
            padding:       '2px 8px',
            borderRadius:  4,
            marginBottom:  4,
            border:        '1px solid #1a2235',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
          }}>
            {characterName}
          </div>
        )}

        <div style={getShapeStyles(bubble, selected)}>
          <div
            ref={editableRef}
            contentEditable
            suppressContentEditableWarning
            onBlur={handleBlur}
            data-placeholder="Type dialogue…"
            className="vibe-bubble-edit"
            style={{
              outline:    'none',
              wordBreak:  'break-word',
              whiteSpace: 'pre-wrap',
              cursor:     'text',
              fontFamily: 'system-ui, sans-serif',
              fontSize:   bubble.fontSize || 14,
              fontWeight: bubble.shape === 'shout'   ? 800 : 500,
              fontStyle:  bubble.shape === 'whisper' ? 'italic' : 'normal',
              textAlign:  'center',
              minHeight:  20,
              lineHeight: 1.3,
              caretColor: '#CCFF00',
            }}
          />

          {bubble.shape === 'speech' && (
            <div style={getTailStyle(bubble.tailDirection, bubble.bgColor || '#ffffff')} />
          )}

          {bubble.shape === 'thought' && (
            <div style={{
              position:        'absolute',
              bottom:          -10,
              left:            '35%',
              width:           8,
              height:          8,
              backgroundColor: bubble.bgColor || '#ffffff',
              borderRadius:    '50%',
            }} />
          )}
        </div>

        {selected && (
          <button
            onClick={e => { e.stopPropagation(); onDelete() }}
            style={{
              position:        'absolute',
              top:             -12,
              right:           -12,
              width:           24,
              height:          24,
              borderRadius:    '50%',
              backgroundColor: '#090D16',
              border:          '1px solid #CCFF00',
              color:           '#CCFF00',
              fontSize:        14,
              fontWeight:      700,
              display:         'flex',
              alignItems:      'center',
              justifyContent:  'center',
              cursor:          'pointer',
              zIndex:          50,
              padding:         0,
              lineHeight:      1,
            }}
          >
            ×
          </button>
        )}
      </div>
    </>
  )
}
