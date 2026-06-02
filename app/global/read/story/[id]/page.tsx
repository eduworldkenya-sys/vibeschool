
import React from 'react'
import { useParams } from 'next/navigation'
import { StoryReader } from '@/components/global/read/StoryReader'

export default function GlobalStoryReaderPage() {
  const params  = useParams()
  const storyId = params?.id as string

  if (!storyId) {
    return (
      <div style={{
        position:        'fixed',
        inset:           0,
        backgroundColor: '#090D16',
        display:         'flex',
        flexDirection:   'column',
        alignItems:      'center',
        justifyContent:  'center',
        paddingTop:      24,
        paddingBottom:   24,
        paddingLeft:     24,
        paddingRight:    24,
        boxSizing:       'border-box',
      }}>
        <div style={{ fontSize: 40, marginBottom: 16 }}>⚠️</div>
        <div style={{ color: '#FFFFFF', fontSize: 16, fontWeight: 700 }}>Story not found</div>
      </div>
    )
  }

  return (
    <div style={{
      position:        'fixed',
      inset:           0,
      backgroundColor: '#000000',
      width:           '100vw',
      height:          '100dvh',
      overflow:        'hidden',
    }}>
      <StoryReader storyId={storyId} />
    </div>
  )
}
