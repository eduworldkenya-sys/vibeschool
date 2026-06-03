"use client";
'use client'

import React, { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useStoryReader } from '@/components/global/read/useStoryReader'
import { StoryReaderCover } from '@/components/global/read/StoryReaderCover'
import { StoryReaderPage } from '@/components/global/read/StoryReaderPage'
import { StoryReaderEnd } from '@/components/global/read/StoryReaderEnd'
import { useReadAloud } from '@/components/global/read/useReadAloud'

interface StoryReaderProps {
  storyId: string
}

export function StoryReader({ storyId }: StoryReaderProps) {
  const router = useRouter()

  const { story, pages, activeIndex, setActiveIndex, loading, error, isVibed, handleVibe } =
    useStoryReader(storyId)

  const [showCover,  setShowCover]  = useState(true)
  const [showEnd,    setShowEnd]    = useState(false)
  const [chromeVisible, setChromeVisible] = useState(true)
  const [direction,  setDirection]  = useState<'left' | 'right' | 'none'>('none')
  const [fontScale,   setFontScale]   = useState<1 | 1.2 | 1.4>(1)

  const activePage = pages[activeIndex] || null
  const { status: readStatus, toggle: toggleRead } = useReadAloud(activePage)

  const chromeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const touchStartXRef = useRef<number>(0)

  const resetChromeTimer = useCallback(() => {
    setChromeVisible(true)
    if (chromeTimerRef.current) clearTimeout(chromeTimerRef.current)
    chromeTimerRef.current = setTimeout(() => setChromeVisible(false), 2500)
  }, [])

  useEffect(() => {
    if (!showCover && !showEnd) resetChromeTimer()
    return () => { if (chromeTimerRef.current) clearTimeout(chromeTimerRef.current) }
  }, [showCover, showEnd, activeIndex, resetChromeTimer])

  const handleNext = () => {
    if (pages.length === 0) return
    if (activeIndex === pages.length - 1) {
      setDirection('none')
      setShowEnd(true)
    } else {
      setDirection('right')
      setActiveIndex(activeIndex + 1)
    }
  }

  const handlePrev = () => {
    if (activeIndex === 0) {
      setDirection('none')
      setShowCover(true)
    } else {
      setDirection('left')
      setActiveIndex(activeIndex - 1)
    }
  }

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartXRef.current = e.touches[0].clientX
    resetChromeTimer()
  }

  const handleTouchEnd = (e: React.TouchEvent) => {
    const deltaX = e.changedTouches[0].clientX - touchStartXRef.current
    if (deltaX < -50) handleNext()
    else if (deltaX > 50) handlePrev()
  }

  const handleReadAgain = () => {
    setActiveIndex(0)
    setDirection('none')
    setShowEnd(false)
    setShowCover(false)
  }

  if (loading) {
    return (
      <div style={{
        position:        'fixed',
        inset:           0,
        backgroundColor: '#090D16',
        display:         'flex',
        flexDirection:   'column',
        alignItems:      'center',
        justifyContent:  'center',
        gap:             16,
        zIndex:          2000,
      }}>
        <style dangerouslySetInnerHTML={{ __html: '@keyframes readerSpin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }' }} />
        <div style={{
          width:                   36,
          height:                  36,
          borderWidth:             3,
          borderStyle:             'solid',
          borderColor:             'rgba(255,255,255,0.05)',
          borderTopColor:          '#CCFF00',
          borderRadius:            '50%',
          animationName:           'readerSpin',
          animationDuration:       '0.8s',
          animationTimingFunction: 'linear',
          animationIterationCount: 'infinite',
        }} />
        <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13, fontWeight: 500 }}>
          Opening book…
        </div>
      </div>
    )
  }

  if (error || !story) {
    return (
      <div style={{
        position:        'fixed',
        inset:           0,
        backgroundColor: '#090D16',
        display:         'flex',
        flexDirection:   'column',
        alignItems:      'center',
        justifyContent:  'center',
        padding:         32,
        textAlign:       'center',
        zIndex:          2000,
      }}>
        <div style={{ fontSize: 40, marginBottom: 16 }}>⚠️</div>
        <div style={{ color: '#FFFFFF', fontSize: 16, fontWeight: 700, marginBottom: 8 }}>Unable to load book</div>
        <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13, marginBottom: 24, maxWidth: 280 }}>
          {error || 'This story is unavailable or private.'}
        </div>
        <button
          onClick={() => router.back()}
          style={{
            backgroundColor: '#111827',
            border:          '1px solid #1a2235',
            color:           '#ffffff',
            borderRadius:    8,
            padding:         '10px 20px',
            fontSize:        13,
            fontWeight:      600,
            cursor:          'pointer',
          }}
        >
          Go Back
        </button>
      </div>
    )
  }

  if (showCover) {
    return <StoryReaderCover story={story} pageCount={pages.length} onStart={() => setShowCover(false)} />
  }

  if (showEnd) {
    return <StoryReaderEnd story={story} isVibed={isVibed} onVibe={handleVibe} onReadAgain={handleReadAgain} />
  }

  const currentPage = pages[activeIndex]

  return (
    <div
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onClick={resetChromeTimer}
      style={{
        position:        'fixed',
        inset:           0,
        backgroundColor: '#000000',
        width:           '100vw',
        height:          '100dvh',
        overflow:        'hidden',
      }}
    >
      {activePage && (
        <StoryReaderPage
          page={activePage}
          fontScale={fontScale}
          characters={story.characters}
          isActive={true}
          direction={direction}
          onNext={handleNext}
          onPrev={handlePrev}
          onToggleChrome={resetChromeTimer}
        />
      )}

      {/* Top HUD */}
      <div style={{
        position:      'absolute',
        top:           0,
        left:          0,
        right:         0,
        zIndex:        300,
        paddingTop:    16,
        paddingBottom: 16,
        paddingLeft:   20,
        paddingRight:  20,
        transition:    'opacity 0.3s ease, transform 0.3s ease',
        opacity:       chromeVisible ? 1 : 0,
        transform:     chromeVisible ? 'translateY(0)' : 'translateY(-12px)',
        pointerEvents: chromeVisible ? 'auto' : 'none',
      }}>
        <div style={{
          display:         'flex',
          alignItems:      'center',
          justifyContent:  'space-between',
          backgroundColor: 'rgba(9,13,22,0.8)',
          backdropFilter:  'blur(16px)',
          borderRadius:    14,
          paddingTop:      10,
          paddingBottom:   10,
          paddingLeft:     16,
          paddingRight:    16,
          border:          '1px solid rgba(255,255,255,0.05)',
        }}>
          <button
            onClick={(e) => { e.stopPropagation(); setShowCover(true) }}
            style={{
              backgroundColor: 'transparent',
              border:          'none',
              color:           '#ffffff',
              fontSize:        18,
              fontWeight:      700,
              cursor:          'pointer',
              padding:         0,
            }}
          >
            ←
          </button>
          <div style={{ color: 'rgba(255,255,255,0.8)', fontSize: 13, fontWeight: 700 }}>
            {(activeIndex + 1) + ' of ' + pages.length}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button
              onClick={(e) => {
                e.stopPropagation()
                setFontScale((prev) => prev === 1 ? 1.2 : prev === 1.2 ? 1.4 : 1)
              }}
              style={{
                backgroundColor: 'rgba(255,255,255,0.08)',
                border:          'none',
                color:           '#ffffff',
                fontSize:        11,
                fontWeight:      800,
                borderRadius:    8,
                paddingTop:      4,
                paddingBottom:   4,
                paddingLeft:     8,
                paddingRight:    8,
                cursor:          'pointer',
              }}
            >
              {fontScale === 1 ? 'A' : fontScale === 1.2 ? 'A+' : 'A++'}
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); toggleRead() }}
              style={{
                backgroundColor: 'transparent',
                border:          'none',
                fontSize:        16,
                cursor:          readStatus === 'unsupported' ? 'not-allowed' : 'pointer',
                opacity:         readStatus === 'unsupported' ? 0.2 : 1,
                color:           readStatus === 'playing' ? '#CCFF00' : 'rgba(255,255,255,0.6)',
                padding:         0,
              }}
            >
              {readStatus === 'playing' ? '⏸' : readStatus === 'paused' ? '▶️' : '🔊'}
            </button>
          </div>
        </div>
      </div>

      {/* Bottom progress dots */}
      <div style={{
        position:      'absolute',
        bottom:        0,
        left:          0,
        right:         0,
        zIndex:        300,
        paddingBottom: 24,
        display:       'flex',
        justifyContent: 'center',
        transition:    'opacity 0.3s ease, transform 0.3s ease',
        opacity:       chromeVisible ? 1 : 0,
        transform:     chromeVisible ? 'translateY(0)' : 'translateY(12px)',
        pointerEvents: chromeVisible ? 'auto' : 'none',
      }}>
        <div style={{
          display:         'flex',
          gap:             6,
          alignItems:      'center',
          backgroundColor: 'rgba(9,13,22,0.8)',
          backdropFilter:  'blur(12px)',
          paddingTop:      8,
          paddingBottom:   8,
          paddingLeft:     14,
          paddingRight:    14,
          borderRadius:    20,
          border:          '1px solid rgba(255,255,255,0.04)',
        }}>
          {pages.map((_, idx) => (
            <div
              key={idx}
              style={{
                width:           idx === activeIndex ? 14 : 6,
                height:          6,
                borderRadius:    3,
                backgroundColor: idx === activeIndex ? '#CCFF00' : 'rgba(255,255,255,0.2)',
                transition:      'all 0.25s ease',
              }}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
