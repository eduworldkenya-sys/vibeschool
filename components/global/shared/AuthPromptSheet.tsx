"use client";
'use client'

import React from 'react'
import { useRouter } from 'next/navigation'

interface AuthPromptSheetProps {
  isOpen: boolean
  onClose: () => void
  action: 'write' | 'vibe' | 'save' | 'create'
}

const titles: Record<string, string> = {
  write:  'Sign in to write a story',
  vibe:   'Sign in to vibe',
  save:   'Sign in to save content',
  create: 'Sign in to create',
}

export function AuthPromptSheet({ isOpen, onClose, action }: AuthPromptSheetProps) {
  const router = useRouter()
  if (!isOpen) return null

  return (
    <>
      <div
        onClick={onClose}
        style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', zIndex: 200, animation: 'fadeIn 0.2s ease' }}
      />
      <div style={{
        position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)',
        width: '100%', maxWidth: 480,
        backgroundColor: '#111827', borderTop: '1px solid rgba(255,255,255,0.08)',
        borderTopLeftRadius: 24, borderTopRightRadius: 24,
        padding: '24px 20px 40px', zIndex: 210,
        boxShadow: '0 -8px 32px rgba(0,0,0,0.5)',
        animation: 'slideUp 0.3s cubic-bezier(0.16,1,0.3,1)',
        boxSizing: 'border-box',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h3 style={{ fontSize: 18, fontWeight: 700, margin: 0, color: '#ffffff' }}>{titles[action]}</h3>
          <button onClick={onClose} style={{ border: 'none', backgroundColor: 'rgba(255,255,255,0.06)', width: 28, height: 28, borderRadius: '50%', color: '#ffffff', fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>✕</button>
        </div>
        <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', margin: '0 0 24px', lineHeight: 1.5 }}>
          Free account. No school required. Join the global learning wave.
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <button onClick={() => { onClose(); router.push('/global/signup') }} style={{ width: '100%', padding: 14, backgroundColor: '#CCFF00', color: '#090D16', border: 'none', borderRadius: 12, fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
            Create Account →
          </button>
          <button onClick={() => { onClose(); router.push('/global/signin') }} style={{ width: '100%', padding: 14, backgroundColor: 'transparent', color: '#ffffff', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 12, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
            Sign In →
          </button>
        </div>
      </div>
    </>
  )
}
