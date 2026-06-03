
"use client";

import React, { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'

interface FormatCardConfig {
  icon:        string
  title:       string
  subtitle:    string
  description: string
  accentColor: string
  isActive:    boolean
  route?:      string
}

const FORMAT_CARDS: FormatCardConfig[] = [
  {
    icon:        '📖',
    title:       'VibeChronicles',
    subtitle:    'Stories & Comics',
    description: 'Illustrated tales, comics, and chapter stories for young readers',
    accentColor: '#FF6B6B',
    isActive:    true,
    route:       '/global/create/story',
  },
  {
    icon:        '📰',
    title:       'VibePress',
    subtitle:    'Magazine & Articles',
    description: 'Long-form articles, revision guides, and editorial content',
    accentColor: '#4ECDC4',
    isActive:    true,
    route:       '/global/create/press',
  },
  {
    icon:        '🎙️',
    title:       'VibeVoice',
    subtitle:    'Audio-First Learning',
    description: 'Chaptered audio lessons, pods, and voice stories',
    accentColor: '#45B7D1',
    isActive:    false,
  },
  {
    icon:        '🔬',
    title:       'VibeResearch',
    subtitle:    'Academic Publications',
    description: 'Structured research with hypothesis, method, results',
    accentColor: '#96CEB4',
    isActive:    false,
  },
  {
    icon:        '🎮',
    title:       'VibeLab',
    subtitle:    'Interactive Challenges',
    description: 'Embedded questions, simulations, and knowledge challenges',
    accentColor: '#FFEAA7',
    isActive:    false,
  },
]

export default function FormatSelectorPage() {
  const router   = useRouter()
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
    supabase.auth.getUser().then(({ data: { user }, error }) => {
      if (error || !user) router.replace('/global/signin')
      else setLoading(false)
    })
  }, [router])

  if (loading) {
    return (
      <div style={{
        minHeight:       '100dvh',
        backgroundColor: '#090D16',
        display:         'flex',
        alignItems:      'center',
        justifyContent:  'center',
        color:           'rgba(255,255,255,0.4)',
        fontSize:        14,
        fontWeight:      500,
      }}>
        Loading…
      </div>
    )
  }

  return (
    <div style={{
      minHeight:       '100dvh',
      backgroundColor: '#090D16',
      padding:         '20px 16px 100px 16px',
      boxSizing:       'border-box',
      display:         'flex',
      flexDirection:   'column',
      alignItems:      'center',
    }}>
      <div style={{ width: '100%', maxWidth: 448, display: 'flex', flexDirection: 'column' }}>

        {/* Back */}
        <button
          onClick={() => router.push('/global/dashboard')}
          style={{
            alignSelf:       'flex-start',
            backgroundColor: 'transparent',
            border:          'none',
            color:           '#ffffff',
            fontSize:        24,
            cursor:          'pointer',
            padding:         '0 0 20px 0',
          }}
        >
          ←
        </button>

        <h1 style={{
          color:         '#ffffff',
          fontSize:      24,
          fontWeight:    900,
          margin:        0,
          letterSpacing: '-0.03em',
        }}>
          Create
        </h1>
        <p style={{
          color:       'rgba(255,255,255,0.4)',
          fontSize:    13,
          fontWeight:  500,
          margin:      '4px 0 24px 0',
        }}>
          Choose your format
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {FORMAT_CARDS.map((card, index) => {
            const iconBg   = card.accentColor + '1A'
            const badgeBg  = card.accentColor + '26'

            return (
              <div
                key={index}
                onClick={() => card.isActive && card.route && router.push(card.route)}
                style={{
                  position:        'relative',
                  display:         'flex',
                  flexDirection:   'row',
                  gap:             16,
                  backgroundColor: '#111827',
                  borderRadius:    16,
                  padding:         16,
                  boxSizing:       'border-box',
                  borderWidth:     1,
                  borderStyle:     'solid',
                  borderColor:     card.isActive ? card.accentColor : '#1a2235',
                  opacity:         card.isActive ? 1 : 0.5,
                  cursor:          card.isActive ? 'pointer' : 'not-allowed',
                }}
              >
                {!card.isActive && (
                  <div style={{
                    position:        'absolute',
                    top:             14,
                    right:           14,
                    fontSize:        10,
                    fontWeight:      700,
                    backgroundColor: badgeBg,
                    color:           card.accentColor,
                    padding:         '3px 10px',
                    borderRadius:    20,
                  }}>
                    Coming Soon
                  </div>
                )}

                <div style={{
                  width:           48,
                  height:          48,
                  borderRadius:    '50%',
                  backgroundColor: iconBg,
                  display:         'flex',
                  alignItems:      'center',
                  justifyContent:  'center',
                  fontSize:        24,
                  flexShrink:      0,
                }}>
                  {card.icon}
                </div>

                <div style={{
                  display:       'flex',
                  flexDirection: 'column',
                  paddingRight:  card.isActive ? 0 : 70,
                }}>
                  <div style={{ color: '#ffffff',       fontSize: 15, fontWeight: 700, lineHeight: 1.2 }}>
                    {card.title}
                  </div>
                  <div style={{ color: card.accentColor, fontSize: 12, fontWeight: 700, marginTop: 2 }}>
                    {card.subtitle}
                  </div>
                  <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12, fontWeight: 500, lineHeight: 1.4, marginTop: 4 }}>
                    {card.description}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
