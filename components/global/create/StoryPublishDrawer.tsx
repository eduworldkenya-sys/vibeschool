'use client'

import React, { useState, useRef } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { VibeStory, AgeRange, StoryLanguage } from '@/lib/storyTypes'

interface StoryPublishDrawerProps {
  story:         VibeStory
  isOpen:        boolean
  onClose:       () => void
  onUpdateStory: (patch: Partial<VibeStory>) => void
  onPublish:     () => Promise<boolean>
  pageCount:     number
}

const AGE_RANGES: AgeRange[] = ['4-8', '9-12', '13+']
const LANGUAGES: { value: StoryLanguage; label: string }[] = [
  { value: 'en',    label: 'English'   },
  { value: 'sw',    label: 'Kiswahili' },
  { value: 'mixed', label: 'Both'      },
]

export function StoryPublishDrawer({
  story,
  isOpen,
  onClose,
  onUpdateStory,
  onPublish,
  pageCount,
}: StoryPublishDrawerProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploading,  setUploading]  = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [success,    setSuccess]    = useState(false)
  const [tagInput,   setTagInput]   = useState('')

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  if (!isOpen) return null

  const handleCoverUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const ext  = file.name.split('.').pop() || 'jpg'
      const path = 'stories/' + story.id + '/cover.' + ext
      const { error: uploadError } = await supabase.storage
        .from('vibelearn-content')
        .upload(path, file, { cacheControl: '3600', upsert: true })
      if (uploadError) throw uploadError
      const { data: publicUrlData } = supabase.storage
        .from('vibelearn-content')
        .getPublicUrl(path)
      if (!publicUrlData?.publicUrl) throw new Error('Cover resolution error')
      onUpdateStory({ coverImageUrl: publicUrlData.publicUrl })
    } catch (err: unknown) {
      console.error('Cover upload failed:', err)
    } finally {
      setUploading(false)
    }
  }

  const handleAddTag = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter' || !tagInput.trim()) return
    e.preventDefault()
    const currentTags = story.tags || []
    if (currentTags.length >= 10) return
    if (!currentTags.includes(tagInput.trim())) {
      onUpdateStory({ tags: [...currentTags, tagInput.trim()] })
    }
    setTagInput('')
  }

  const handleRemoveTag = (tagToRemove: string) => {
    onUpdateStory({ tags: (story.tags || []).filter((t) => t !== tagToRemove) })
  }

  const handlePublishSubmit = async () => {
    if (!story.title?.trim() || publishing) return
    setPublishing(true)
    try {
      const result = await onPublish()
      if (result) setSuccess(true)
    } catch (err: unknown) {
      console.error('Publish failed:', err)
    } finally {
      setPublishing(false)
    }
  }

  const getPillStyle = (selected: boolean): React.CSSProperties => ({
    flex:            1,
    padding:         '10px 0',
    borderRadius:    20,
    fontSize:        12,
    fontWeight:      700,
    textAlign:       'center',
    cursor:          'pointer',
    border:          'none',
    backgroundColor: selected ? '#CCFF00' : '#1a2235',
    color:           selected ? '#090D16' : 'rgba(255,255,255,0.6)',
    transition:      'all 0.15s ease-in-out',
  })

  const labelStyle: React.CSSProperties = {
    color:          'rgba(255,255,255,0.4)',
    fontSize:       11,
    fontWeight:     700,
    textTransform:  'uppercase',
    letterSpacing:  '0.05em',
  }

  return (
    <>
      <style>{`@keyframes spin{0%{transform:rotate(0deg)}100%{transform:rotate(360deg)}}`}</style>

      <div
        onClick={onClose}
        style={{
          position:        'fixed',
          inset:           0,
          backgroundColor: 'rgba(9,13,22,0.8)',
          backdropFilter:  'blur(4px)',
          zIndex:          1000,
        }}
      />

      <div
        style={{
          position:             'fixed',
          bottom:               0,
          left:                 '50%',
          transform:            'translateX(-50%)',
          width:                '100%',
          maxWidth:             480,
          height:               '75vh',
          backgroundColor:      '#111827',
          borderTopLeftRadius:  20,
          borderTopRightRadius: 20,
          borderTop:            '1px solid #1a2235',
          padding:              20,
          boxSizing:            'border-box',
          zIndex:               1001,
          display:              'flex',
          flexDirection:        'column',
          boxShadow:            '0 -10px 40px rgba(0,0,0,0.5)',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexShrink: 0 }}>
          <div style={{ color: '#ffffff', fontSize: 16, fontWeight: 700 }}>
            {success ? 'Success!' : 'Publish Story'}
          </div>
          <button
            onClick={onClose}
            style={{
              backgroundColor: 'transparent',
              border:          'none',
              color:           '#CCFF00',
              fontSize:        20,
              cursor:          'pointer',
              padding:         4,
            }}
          >
            ×
          </button>
        </div>

        {success ? (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: 20 }}>
            <div style={{ width: 64, height: 64, borderRadius: '50%', backgroundColor: 'rgba(107,203,119,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
              <span style={{ fontSize: 32 }}>✅</span>
            </div>
            <div style={{ color: '#ffffff', fontSize: 18, fontWeight: 700, marginBottom: 8 }}>
              Story Published!
            </div>
            <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13, margin: '0 0 24px 0', lineHeight: 1.4 }}>
              Your story is now live for readers.
            </p>
            <div style={{ width: '100%', backgroundColor: '#090D16', border: '1px solid #1a2235', padding: '12px 14px', borderRadius: 10, boxSizing: 'border-box', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ color: '#CCFF00', fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '80%' }}>
                vibeschool.app/story/{story.id}
              </span>
              <button
                onClick={() => navigator.clipboard.writeText('https://vibeschool.app/story/' + story.id)}
                style={{ backgroundColor: '#1a2235', border: 'none', color: '#ffffff', fontSize: 11, fontWeight: 700, padding: '6px 12px', borderRadius: 6, cursor: 'pointer' }}
              >
                Copy
              </button>
            </div>
          </div>
        ) : (
          <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 20, paddingBottom: 24 }}>

            {/* Cover */}
            <div
              onClick={() => !uploading && fileInputRef.current?.click()}
              style={{
                position:        'relative',
                width:           '100%',
                height:          160,
                backgroundColor: '#090D16',
                borderRadius:    12,
                border:          story.coverImageUrl ? 'none' : '2px dashed #1a2235',
                overflow:        'hidden',
                display:         'flex',
                flexDirection:   'column',
                alignItems:      'center',
                justifyContent:  'center',
                cursor:          uploading ? 'not-allowed' : 'pointer',
              }}
            >
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleCoverUpload}
                accept="image/*"
                style={{ display: 'none' }}
                disabled={uploading}
              />
              {uploading && (
                <div style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(9,13,22,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10 }}>
                  <div style={{ width: 24, height: 24, border: '3px solid #1a2235', borderTop: '3px solid #CCFF00', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                </div>
              )}
              {story.coverImageUrl ? (
                <>
                  <img src={story.coverImageUrl} alt="Cover" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  <div style={{ position: 'absolute', bottom: 10, right: 10, backgroundColor: 'rgba(9,13,22,0.8)', padding: '6px 12px', borderRadius: 20, color: '#CCFF00', fontSize: 11, fontWeight: 700 }}>
                    Change Cover
                  </div>
                </>
              ) : (
                <>
                  <span style={{ fontSize: 28, marginBottom: 6 }}>📷</span>
                  <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12, fontWeight: 500 }}>Add Cover Image</span>
                </>
              )}
            </div>

            {/* Description */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={labelStyle}>Description</label>
              <textarea
                rows={3}
                value={story.description || ''}
                onChange={(e) => onUpdateStory({ description: e.target.value })}
                placeholder="What is this story about?"
                style={{
                  backgroundColor: '#090D16',
                  border:          '1px solid #1a2235',
                  color:           '#ffffff',
                  borderRadius:    10,
                  padding:         12,
                  fontSize:        13,
                  outline:         'none',
                  fontFamily:      'system-ui, sans-serif',
                  resize:          'none',
                  boxSizing:       'border-box',
                  width:           '100%',
                }}
              />
            </div>

            {/* Age Range */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={labelStyle}>Age Range</label>
              <div style={{ display: 'flex', gap: 8 }}>
                {AGE_RANGES.map((range) => (
                  <button
                    key={range}
                    type="button"
                    onClick={() => onUpdateStory({ ageRange: range })}
                    style={getPillStyle(story.ageRange === range)}
                  >
                    {range}
                  </button>
                ))}
              </div>
            </div>

            {/* Language */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={labelStyle}>Language</label>
              <div style={{ display: 'flex', gap: 8 }}>
                {LANGUAGES.map((lang) => (
                  <button
                    key={lang.value}
                    type="button"
                    onClick={() => onUpdateStory({ language: lang.value })}
                    style={getPillStyle(story.language === lang.value)}
                  >
                    {lang.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Tags */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={labelStyle}>Tags ({story.tags?.length || 0}/10)</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 4 }}>
                {(story.tags || []).map((tag) => (
                  <div
                    key={tag}
                    style={{ backgroundColor: '#1a2235', color: '#ffffff', borderRadius: 6, padding: '4px 8px', fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }}
                  >
                    <span>#{tag}</span>
                    <button
                      onClick={() => handleRemoveTag(tag)}
                      style={{ backgroundColor: 'transparent', border: 'none', color: '#FF4D4D', padding: 0, fontSize: 14, cursor: 'pointer' }}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
              <input
                type="text"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={handleAddTag}
                placeholder="Type tag and press Enter..."
                style={{
                  backgroundColor: '#090D16',
                  border:          '1px solid #1a2235',
                  color:           '#ffffff',
                  borderRadius:    8,
                  padding:         '10px 12px',
                  fontSize:        12,
                  outline:         'none',
                  boxSizing:       'border-box',
                  width:           '100%',
                }}
              />
            </div>

            {/* Stats */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#090D16', padding: '12px 16px', borderRadius: 10, border: '1px solid #1a2235' }}>
              <div style={{ color: '#ffffff', fontSize: 13, fontWeight: 600 }}>
                {pageCount} Pages
              </div>
              <div style={{
                backgroundColor: story.status === 'published' ? 'rgba(204,255,0,0.15)' : 'rgba(255,255,255,0.05)',
                color:           story.status === 'published' ? '#CCFF00' : 'rgba(255,255,255,0.4)',
                fontSize:        11,
                fontWeight:      700,
                textTransform:   'uppercase',
                padding:         '4px 8px',
                borderRadius:    4,
              }}>
                {story.status || 'Draft'}
              </div>
            </div>

            {/* Publish button */}
            <button
              onClick={handlePublishSubmit}
              disabled={!story.title?.trim() || publishing}
              style={{
                width:           '100%',
                backgroundColor: '#CCFF00',
                color:           '#090D16',
                border:          'none',
                padding:         14,
                borderRadius:    12,
                fontSize:        15,
                fontWeight:      900,
                cursor:          (!story.title?.trim() || publishing) ? 'not-allowed' : 'pointer',
                opacity:         (!story.title?.trim() || publishing) ? 0.5 : 1,
                transition:      'opacity 0.15s ease',
                flexShrink:      0,
              }}
            >
              {publishing ? 'Publishing…' : 'Publish Story 🚀'}
            </button>
          </div>
        )}
      </div>
    </>
  )
}
