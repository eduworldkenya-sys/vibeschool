"use client";
'use client'

import React, { useRef } from 'react'

interface StoryIllustrationSlotProps {
  illustrationUrl:    string | null
  illustrationPrompt: string | null
  backgroundColor:    string
  onImageUpload:      (file: File) => Promise<void>
  onPromptChange:     (prompt: string) => void
  uploading:          boolean
}

export function StoryIllustrationSlot({
  illustrationUrl,
  illustrationPrompt,
  backgroundColor,
  onImageUpload,
  onPromptChange,
  uploading,
}: StoryIllustrationSlotProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleContainerTap = () => {
    if (!uploading && !illustrationUrl) fileInputRef.current?.click()
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) onImageUpload(file)
  }

  return (
    <>
      <style>{`@keyframes spin{0%{transform:rotate(0deg)}100%{transform:rotate(360deg)}}`}</style>

      <div
        onClick={handleContainerTap}
        style={{
          position:        'relative',
          width:           '100%',
          maxWidth:        '480px',
          aspectRatio:     '4 / 3',
          backgroundColor: backgroundColor || '#111827',
          borderRadius:    16,
          overflow:        'hidden',
          display:         'flex',
          flexDirection:   'column',
          alignItems:      'center',
          justifyContent:  'center',
          cursor:          uploading ? 'not-allowed' : 'pointer',
          border:          illustrationUrl ? 'none' : '2px dashed rgba(255,255,255,0.1)',
        }}
      >
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          accept="image/*"
          disabled={uploading}
          style={{ display: 'none' }}
        />

        {/* Upload spinner overlay */}
        {uploading && (
          <div style={{
            position:        'absolute',
            inset:           0,
            backgroundColor: 'rgba(9,13,22,0.85)',
            display:         'flex',
            flexDirection:   'column',
            alignItems:      'center',
            justifyContent:  'center',
            zIndex:          10,
          }}>
            <div style={{
              width:        28,
              height:       28,
              border:       '3px solid #1a2235',
              borderTop:    '3px solid #CCFF00',
              borderRadius: '50%',
              animation:    'spin 1s linear infinite',
            }} />
            <div style={{
              marginTop:   10,
              fontSize:    11,
              color:       '#CCFF00',
              fontWeight:  700,
              letterSpacing: '0.05em',
            }}>
              Uploading…
            </div>
          </div>
        )}

        {/* Image exists */}
        {illustrationUrl ? (
          <>
            <img
              src={illustrationUrl}
              alt="Story illustration"
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
            <button
              onClick={e => { e.stopPropagation(); fileInputRef.current?.click() }}
              disabled={uploading}
              style={{
                position:        'absolute',
                bottom:          12,
                right:           12,
                backgroundColor: 'rgba(9,13,22,0.9)',
                color:           '#CCFF00',
                border:          '1px solid rgba(204,255,0,0.3)',
                padding:         '6px 12px',
                borderRadius:    20,
                fontSize:        11,
                fontWeight:      700,
                cursor:          'pointer',
              }}
            >
              🔄 Replace
            </button>
          </>
        ) : (
          /* Empty state */
          <div style={{
            display:       'flex',
            flexDirection: 'column',
            alignItems:    'center',
            justifyContent:'center',
            padding:       24,
            textAlign:     'center',
            width:         '100%',
            boxSizing:     'border-box',
          }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>🎨</div>
            <div style={{ fontSize: 13, color: '#ffffff', fontWeight: 500, marginBottom: 16 }}>
              Tap to upload illustration
            </div>
            <input
              type="text"
              value={illustrationPrompt || ''}
              onChange={e => onPromptChange(e.target.value)}
              onClick={e => e.stopPropagation()}
              placeholder="Describe the illustration…"
              disabled={uploading}
              style={{
                width:           '90%',
                backgroundColor: '#090D16',
                border:          '1px solid rgba(255,255,255,0.08)',
                color:           '#ffffff',
                padding:         '10px 14px',
                borderRadius:    8,
                fontSize:        12,
                outline:         'none',
                boxSizing:       'border-box',
              }}
            />
          </div>
        )}
      </div>
    </>
  )
}
