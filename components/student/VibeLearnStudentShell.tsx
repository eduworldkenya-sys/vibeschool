"use client";
'use client'

import { useEffect, useCallback } from 'react'
import type { ReactNode } from 'react'

interface VibeLearnStudentShellProps {
  isOpen: boolean
  onClose: () => void
  title?: string
  children: ReactNode
}

export default function VibeLearnStudentShell({
  isOpen,
  onClose,
  title = 'VibeLearn',
  children
}: VibeLearnStudentShellProps) {

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') onClose()
  }, [onClose])

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
      window.addEventListener('keydown', handleKeyDown)
    }
    return () => {
      document.body.style.overflow = ''
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen, handleKeyDown])

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Student Learning Environment"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        backgroundColor: '#090D16',
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        transform: isOpen ? 'translateY(0)' : 'translateY(100vh)',
        transition: 'transform 350ms cubic-bezier(0.34, 1.56, 0.64, 1)',
        pointerEvents: isOpen ? 'auto' : 'none'
      }}
    >

      {/* Header */}
      <header style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '16px 24px',
        borderBottom: '1px solid rgba(255,255,255,0.08)',
        flexShrink: 0,
        height: '60px'
      }}>

        <button
          onClick={onClose}
          aria-label="Exit learning environment"
          style={{
            background: 'rgba(255,255,255,0.05)',
            border: 'none',
            color: '#FFFFFF',
            padding: '10px 16px',
            borderRadius: '12px',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            minWidth: '80px'
          }}
        >
          ← Back
        </button>

        <h1 style={{
          color: '#CCFF00',
          fontSize: '14px',
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: '0.1em',
          margin: 0
        }}>
          {title}
        </h1>

        {/* Balanced spacer matching button minWidth */}
        <div style={{ minWidth: '80px' }} />

      </header>

      {/* Scrollable content — no padding, children own their spacing */}
      <main style={{
        flex: 1,
        overflowY: 'auto',
        WebkitOverflowScrolling: 'touch'
      }}>
        {children}
      </main>

    </div>
  )
}
