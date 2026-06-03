"use client";
'use client'

import React, { useState, useEffect } from 'react'
import { VibeStory } from '@/lib/storyTypes'

interface StoryReaderEndProps {
  story: VibeStory
  isVibed: boolean
  onVibe: () => void
  onReadAgain: () => void
}

interface EndParticle {
  id: number
  left: number
  color: string
  delay: number
}

const CONFETTI_KEYFRAMES = '@keyframes endConfettiFall { 0% { transform: translateY(-20px) rotate(0deg); opacity: 1; } 100% { transform: translateY(110dvh) rotate(360deg); opacity: 0; } }'

export function StoryReaderEnd({ story, isVibed, onVibe, onReadAgain }: StoryReaderEndProps) {
  const [particles, setParticles] = useState<EndParticle[]>([])
  const [scaled,    setScaled]    = useState(false)

  useEffect(() => {
    const palette = ['#CCFF00','#FF6B6B','#4ECDC4','#45B7D1','#FFEAA7']
    setParticles(Array.from({ length: 30 }).map((_, i) => ({
      id:    i,
      left:  Math.random() * 100,
      color: palette[Math.floor(Math.random() * 5)],
      delay: Math.random() * 2,
    })))
  }, [])

  const handleVibeClick = () => {
    if (isVibed) return
    setScaled(true)
    onVibe()
    setTimeout(() => setScaled(false), 200)
  }

  const handleWhatsAppShare = () => {
    const url  = typeof window !== 'undefined' ? window.location.href : ''
    const text = encodeURIComponent('📚 I just finished reading "' + (story.title || 'a story') + '" on VibeSchool! Read it here: ' + url)
    if (typeof window !== 'undefined') window.open('https://api.whatsapp.com/send?text=' + text, '_blank')
  }

  return (
    <div style={{
      position:       'fixed',
      inset:          0,
      backgroundColor: '#090D16',
      zIndex:         1000,
      display:        'flex',
      flexDirection:  'column',
      alignItems:     'center',
      justifyContent: 'center',
      paddingTop:     24,
      paddingBottom:  24,
      paddingLeft:    32,
      paddingRight:   32,
      boxSizing:      'border-box',
      overflowY:      'auto',
    }}>
      <style dangerouslySetInnerHTML={{ __html: CONFETTI_KEYFRAMES }} />

      {particles.map((p) => (
        <div
          key={p.id}
          style={{
            position:              'absolute',
            top:                   -20,
            left:                  p.left + '%',
            width:                 8,
            height:                8,
            borderRadius:          '50%',
            backgroundColor:       p.color,
            animationName:         'endConfettiFall',
            animationDuration:     '3.5s',
            animationTimingFunction: 'linear',
            animationIterationCount: 'infinite',
            animationDelay:        p.delay + 's',
          }}
        />
      ))}

      <div style={{ textAlign: 'center', marginBottom: 32, zIndex: 10 }}>
        <div style={{ fontSize: 64, marginBottom: 16 }}>🏆</div>
        <h2 style={{ fontSize: 24, fontWeight: 800, color: '#FFFFFF', margin: '0 0 6px 0', letterSpacing: '-0.02em' }}>
          Story Complete!
        </h2>
        <h1 style={{ fontSize: 20, fontWeight: 900, color: '#CCFF00', margin: '0 0 12px 0', lineHeight: 1.3 }}>
          {story.title || 'Untitled Story'}
        </h1>
        <div style={{
          display:         'inline-block',
          backgroundColor: 'rgba(34,197,94,0.15)',
          color:           '#4ADE80',
          fontSize:        13,
          fontWeight:      700,
          paddingTop:      6,
          paddingBottom:   6,
          paddingLeft:     14,
          paddingRight:    14,
          borderRadius:    20,
          border:          '1px solid rgba(74,222,128,0.2)',
        }}>
          ✨ +10 Reading Points
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 48, zIndex: 10 }}>
        <button
          onClick={handleVibeClick}
          style={{
            width:           80,
            height:          80,
            borderRadius:    40,
            backgroundColor: isVibed ? '#CCFF00' : '#1a2235',
            border:          '2px solid #CCFF00',
            fontSize:        36,
            display:         'flex',
            alignItems:      'center',
            justifyContent:  'center',
            cursor:          isVibed ? 'default' : 'pointer',
            outline:         'none',
            boxShadow:       isVibed ? '0 8px 24px rgba(204,255,0,0.3)' : 'none',
            transform:       scaled ? 'scale(1.15)' : 'scale(1)',
            transition:      'transform 0.15s ease, background-color 0.2s ease',
            padding:         0,
          }}
        >
          ⭐
        </button>
        <span style={{
          color:         isVibed ? '#CCFF00' : 'rgba(255,255,255,0.5)',
          fontSize:      12,
          fontWeight:    700,
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          marginTop:     10,
        }}>
          {isVibed ? 'Vibed!' : 'Vibe this story'}
        </span>
      </div>

      <div style={{ width: '100%', maxWidth: 320, display: 'flex', flexDirection: 'column', gap: 12, zIndex: 10 }}>
        <button
          onClick={handleWhatsAppShare}
          style={{
            width:           '100%',
            backgroundColor: 'rgba(37,211,102,0.15)',
            color:           '#25D366',
            border:          '1px solid #25D366',
            borderRadius:    12,
            paddingTop:      14,
            paddingBottom:   14,
            paddingLeft:     16,
            paddingRight:    16,
            fontSize:        14,
            fontWeight:      700,
            cursor:          'pointer',
            outline:         'none',
          }}
        >
          💬 Share to WhatsApp
        </button>

        <button
          onClick={onReadAgain}
          style={{
            width:           '100%',
            backgroundColor: 'transparent',
            color:           '#CCFF00',
            border:          '1px solid rgba(204,255,0,0.3)',
            borderRadius:    12,
            paddingTop:      14,
            paddingBottom:   14,
            paddingLeft:     16,
            paddingRight:    16,
            fontSize:        14,
            fontWeight:      700,
            cursor:          'pointer',
            outline:         'none',
          }}
        >
          🔄 Read Again
        </button>
      </div>
    </div>
  )
}
