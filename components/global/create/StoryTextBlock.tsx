'use client'

import React, { useRef, useEffect } from 'react'
import { StoryTextBlock as TStoryTextBlock, FontFamily } from '@/lib/storyTypes'

interface StoryTextBlockProps {
  block:           TStoryTextBlock
  selected:        boolean
  onSelect:        () => void
  onChange:        (patch: Partial<TStoryTextBlock>) => void
  onDelete:        () => void
  containerWidth:  number
  containerHeight: number
}

const FONT_MAP: Record<FontFamily, string> = {
  rounded:     'system-ui, -apple-system, BlinkMacSystemFont, sans-serif',
  bold:        '"Arial Black", Impact, sans-serif',
  handwritten: '"Comic Sans MS", cursive, sans-serif',
  serif:       'Georgia, Cambria, "Times New Roman", serif',
}

export function StoryTextBlock({
  block,
  selected,
  onSelect,
  onChange,
  onDelete,
  containerWidth,
  containerHeight,
}: StoryTextBlockProps) {
  const editableRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (editableRef.current && editableRef.current.innerText !== block.text) {
      editableRef.current.innerText = block.text
    }
  }, [block.text])

  const leftPx = (block.x / 100) * containerWidth
  const topPx  = (block.y / 100) * containerHeight

  const handleBlur = () => {
    if (editableRef.current) onChange({ text: editableRef.current.innerText })
  }

  return (
    <>
      <style>{`.vibe-editable:empty::before{content:attr(placeholder);color:rgba(255,255,255,0.35);font-style:italic;display:block}`}</style>

      <div
        onClick={e => { e.stopPropagation(); onSelect() }}
        style={{
          position:        'absolute',
          left:            leftPx,
          top:             topPx,
          transform:       'translate(-50%, -50%)',
          width:           '85%',
          maxWidth:        400,
          zIndex:          selected ? 30 : 20,
          boxSizing:       'border-box',
          padding:         '8px 12px',
          borderRadius:    8,
          border:          selected ? '1px solid #CCFF00' : '1px solid transparent',
          backgroundColor: selected ? 'rgba(26,34,53,0.4)' : 'transparent',
          transition:      'border 0.15s ease, background-color 0.15s ease',
        }}
      >
        {selected && (
          <button
            onClick={e => { e.stopPropagation(); onDelete() }}
            style={{
              position:        'absolute',
              top:             -10,
              right:           -10,
              width:           22,
              height:          22,
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
              padding:         0,
              lineHeight:      1,
              zIndex:          40,
            }}
          >
            ×
          </button>
        )}

        <div
          ref={editableRef}
          contentEditable
          suppressContentEditableWarning
          onBlur={handleBlur}
          data-data-placeholder="Tap to add text…"
          className="vibe-editable"
          style={{
            outline:    'none',
            wordBreak:  'break-word',
            whiteSpace: 'pre-wrap',
            cursor:     'text',
            fontFamily: FONT_MAP[block.fontFamily] ?? FONT_MAP.rounded,
            fontSize:   block.fontSize,
            color:      block.color || '#ffffff',
            fontWeight: block.bold   ? 'bold'   : 'normal',
            fontStyle:  block.italic ? 'italic' : 'normal',
            textAlign:  block.align  ?? 'center',
            minHeight:  24,
            caretColor: '#CCFF00',
          }}
        />
      </div>
    </>
  )
}
