'use client'

import { useCallback } from 'react'

const SURFACE = '#111827'
const ACCENT  = '#CCFF00'
const MUTED   = 'rgba(255,255,255,0.4)'
const GREEN   = '#10b981'

interface VibeActionDockProps {
  contentId:    string
  isSaved:      boolean
  isCompleted:  boolean
  onToggleSave: (contentId: string) => void
  onComplete:   (contentId: string) => void
}

export default function VibeActionDock({
  contentId,
  isSaved,
  isCompleted,
  onToggleSave,
  onComplete,
}: VibeActionDockProps) {

  const handleSave = useCallback(() => {
    onToggleSave(contentId)
  }, [contentId, onToggleSave])

  const handleComplete = useCallback(() => {
    if (isCompleted) return
    onComplete(contentId)
  }, [contentId, isCompleted, onComplete])

  return (
    <div style={{
      display: 'flex',
      borderTop: '1px solid rgba(255,255,255,0.06)',
      background: SURFACE,
      flexShrink: 0,
      height: 72,
    }}>
      <button
        onClick={handleSave}
        aria-label={isSaved ? 'Remove from library' : 'Save to library'}
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 5,
          border: 'none',
          borderRight: '1px solid rgba(255,255,255,0.06)',
          background: isSaved ? 'rgba(204,255,0,0.06)' : 'none',
          cursor: 'pointer',
          padding: 0,
        }}
      >
        <span style={{ fontSize: 22 }}>{isSaved ? '🔖' : '📌'}</span>
        <span style={{
          fontSize: 10,
          fontWeight: 700,
          color: isSaved ? ACCENT : MUTED,
          letterSpacing: 0.4,
        }}>
          {isSaved ? 'Saved' : 'Save'}
        </span>
      </button>

      <button
        onClick={handleComplete}
        aria-label={isCompleted ? 'Already marked complete' : 'Mark as complete'}
        disabled={isCompleted}
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 5,
          border: 'none',
          background: isCompleted ? 'rgba(16,185,129,0.06)' : 'none',
          cursor: isCompleted ? 'default' : 'pointer',
          padding: 0,
          opacity: isCompleted ? 0.8 : 1,
        }}
      >
        <span style={{ fontSize: 22 }}>{isCompleted ? '✅' : '☑️'}</span>
        <span style={{
          fontSize: 10,
          fontWeight: 700,
          color: isCompleted ? GREEN : MUTED,
          letterSpacing: 0.4,
        }}>
          {isCompleted ? 'Completed' : 'Complete'}
        </span>
      </button>
    </div>
  )
}
