"use client";
'use client'

import React, { useState } from 'react'
import { VibeStory } from '@/lib/storyTypes'

interface StoryFeedCardProps {
  story: VibeStory
  onTap: (id: string) => void
}

export function StoryFeedCard({ story, onTap }: StoryFeedCardProps) {
  const [isPressed, setIsPressed] = useState<boolean>(false)

  const handlePointerDown = () => setIsPressed(true)
  const handlePointerUp = () => setIsPressed(false)
  const handlePointerLeave = () => setIsPressed(false)

  let languageAbbreviation = 'EN'
  if (story.language === 'sw') {
    languageAbbreviation = 'SW'
  } else if (story.language === 'mixed') {
    languageAbbreviation = 'EN+SW'
  }

  const coverUrl = story.coverImageUrl || ''

  return (
    <div
      onClick={() => onTap(story.id)}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerLeave}
      style={{
        backgroundColor: '#1a2235',
        borderRadius: 16,
        overflow: 'hidden',
        cursor: 'pointer',
        display: 'flex',
        flexDirection: 'column',
        userSelect: 'none',
        transform: isPressed ? 'scale(0.97)' : 'scale(1)',
        transition: 'transform 0.15s cubic-bezier(0.16, 1, 0.3, 1)',
        boxShadow: '0 4px 16px rgba(0,0,0,0.25)',
      }}
    >
      <div style={{ position: 'relative', width: '100%', height: 160 }}>
        {coverUrl ? (
          <img
            src={coverUrl}
            alt={story.title}
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          />
        ) : (
          <div style={{
            width: '100%',
            height: '100%',
            backgroundColor: '#111827',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 40,
          }}>
            📖
          </div>
        )}
        <span style={{
          position: 'absolute',
          top: 0,
          right: 0,
          marginTop: 8,
          marginRight: 8,
          backgroundColor: 'rgba(9,13,22,0.85)',
          color: '#CCFF00',
          fontSize: 10,
          fontWeight: 700,
          paddingTop: 4,
          paddingBottom: 4,
          paddingLeft: 8,
          paddingRight: 8,
          borderRadius: 20,
          backdropFilter: 'blur(4px)',
          zIndex: 2,
        }}>
          {story.ageRange || '4-8'}
        </span>
      </div>

      <div style={{
        paddingTop: 12,
        paddingBottom: 12,
        paddingLeft: 12,
        paddingRight: 12,
        display: 'flex',
        flexDirection: 'column',
        flexGrow: 1,
        justifyContent: 'space-between',
      }}>
        <h3 style={{
          color: '#FFFFFF',
          fontSize: 15,
          fontWeight: 800,
          lineHeight: 1.3,
          margin: 0,
          overflow: 'hidden',
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
        }}>
          {story.title}
        </h3>

        <div style={{
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginTop: 6,
        }}>
          <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, fontWeight: 500 }}>
              📄 {story.pageCount} pages
            </span>
            <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, fontWeight: 500 }}>
              ⭐ {story.vibeCount}
            </span>
          </div>
          <span style={{
            backgroundColor: 'rgba(255,255,255,0.05)',
            color: 'rgba(255,255,255,0.4)',
            fontSize: 10,
            fontWeight: 700,
            borderRadius: 4,
            paddingTop: 2,
            paddingBottom: 2,
            paddingLeft: 6,
            paddingRight: 6,
          }}>
            {languageAbbreviation}
          </span>
        </div>
      </div>
    </div>
  )
}
