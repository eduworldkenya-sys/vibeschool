'use client'

import React from 'react'
import { VibeStory } from '@/lib/storyTypes'

interface StoryReaderCoverProps {
  story: VibeStory
  pageCount: number
  onStart: () => void
}

const PULSE_KEYFRAMES = '@keyframes coverPulse { 0% { box-shadow: 0 8px 24px rgba(204,255,0,0.3); } 50% { box-shadow: 0 12px 36px rgba(204,255,0,0.55); } 100% { box-shadow: 0 8px 24px rgba(204,255,0,0.3); } }'

export function StoryReaderCover({ story, pageCount, onStart }: StoryReaderCoverProps) {
  const readingMinutes = Math.max(1, Math.round(pageCount * 0.5))

  let languageLabel = 'English'
  if (story.language === 'sw') languageLabel = 'Kiswahili'
  else if (story.language === 'mixed') languageLabel = 'English & Kiswahili'

  return (
    <div style={{
      position:      'fixed',
      inset:         0,
      backgroundColor: '#090D16',
      zIndex:        500,
      display:       'flex',
      flexDirection: 'column',
      alignItems:    'center',
      justifyContent: 'space-between',
      paddingTop:    48,
      paddingBottom: 64,
      paddingLeft:   32,
      paddingRight:  32,
      boxSizing:     'border-box',
      overflowY:     'auto',
    }}>
      <style dangerouslySetInnerHTML={{ __html: PULSE_KEYFRAMES }} />

      {story.coverImageUrl ? (
        <>
          <div style={{
            position:           'absolute',
            inset:              0,
            backgroundImage:    'url(' + story.coverImageUrl + ')',
            backgroundSize:     'cover',
            backgroundPosition: 'center',
            zIndex:             1,
          }} />
          <div style={{
            position:        'absolute',
            inset:           0,
            backgroundColor: 'rgba(0,0,0,0.55)',
            zIndex:          2,
          }} />
        </>
      ) : (
        <div style={{
          position: 'absolute',
          inset:    0,
          background: 'linear-gradient(160deg, #111827, #090D16)',
          zIndex:   1,
        }} />
      )}

      {/* Badges */}
      <div style={{
        position:       'relative',
        zIndex:         10,
        width:          '100%',
        maxWidth:       440,
        display:        'flex',
        alignItems:     'center',
        justifyContent: 'space-between',
      }}>
        <span style={{
          backgroundColor: 'rgba(204,255,0,0.15)',
          color:           '#CCFF00',
          fontSize:        11,
          fontWeight:      800,
          textTransform:   'uppercase',
          letterSpacing:   '0.06em',
          borderRadius:    20,
          paddingTop:      6,
          paddingBottom:   6,
          paddingLeft:     14,
          paddingRight:    14,
          border:          '1px solid rgba(204,255,0,0.2)',
        }}>
          {story.ageRange || '4-8'}
        </span>

        <span style={{
          backgroundColor: 'rgba(255,255,255,0.06)',
          color:           'rgba(255,255,255,0.8)',
          fontSize:        11,
          fontWeight:      700,
          borderRadius:    20,
          paddingTop:      6,
          paddingBottom:   6,
          paddingLeft:     14,
          paddingRight:    14,
          border:          '1px solid rgba(255,255,255,0.05)',
        }}>
          {languageLabel}
        </span>
      </div>

      {/* Title block */}
      <div style={{
        position:     'relative',
        zIndex:       10,
        width:        '100%',
        maxWidth:     440,
        textAlign:    'center',
        marginTop:    'auto',
        marginBottom: 'auto',
        paddingTop:   24,
        paddingBottom: 24,
      }}>
        <h1 style={{
          fontSize:      32,
          fontWeight:    900,
          color:         '#FFFFFF',
          lineHeight:    1.2,
          margin:        '0 0 12px 0',
          letterSpacing: '-0.02em',
        }}>
          {story.title || 'Untitled Story'}
        </h1>

        <div style={{
          display:        'flex',
          alignItems:     'center',
          justifyContent: 'center',
          gap:            8,
          color:          'rgba(255,255,255,0.4)',
          fontSize:       12,
          fontWeight:     600,
          marginTop:      12,
        }}>
          <span>{pageCount} pages</span>
          <span style={{ color: 'rgba(255,255,255,0.15)' }}>•</span>
          <span>{readingMinutes} min read</span>
        </div>
      </div>

      {/* Start button */}
      <div style={{
        position:  'relative',
        zIndex:    10,
        width:     '100%',
        maxWidth:  320,
        textAlign: 'center',
      }}>
        <button
          onClick={onStart}
          style={{
            width:           '100%',
            backgroundColor: '#CCFF00',
            color:           '#090D16',
            fontSize:        16,
            fontWeight:      900,
            borderRadius:    16,
            paddingTop:      18,
            paddingBottom:   18,
            paddingLeft:     24,
            paddingRight:    24,
            cursor:          'pointer',
            border:          'none',
            outline:         'none',
            letterSpacing:   '0.01em',
            animationName:      'coverPulse',
            animationDuration:  '2s',
            animationTimingFunction: 'ease-in-out',
            animationIterationCount: 'infinite',
          }}
        >
          📖 Start Reading
        </button>
      </div>
    </div>
  )
}
