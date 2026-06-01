'use client'

import React from 'react'
import { useRouter } from 'next/navigation'

interface GlobalHeaderProps {
  isLoggedIn: boolean
  userName: string | null
}

export function GlobalHeader({ isLoggedIn, userName }: GlobalHeaderProps) {
  const router = useRouter()

  const initials = userName
    ? userName.split(' ').map((n: string) => n[0]).join('').substring(0, 2).toUpperCase()
    : 'U'

  return (
    <header style={{
      position: 'sticky',
      top: 0,
      zIndex: 100,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '12px 16px',
      backgroundColor: 'rgba(9,13,22,0.92)',
      backdropFilter: 'blur(12px)',
      borderBottom: '1px solid rgba(255,255,255,0.06)',
    }}>
      <span
        onClick={() => router.push('/global')}
        style={{ fontSize: 20, fontWeight: 800, color: '#CCFF00', letterSpacing: '-0.5px', cursor: 'pointer' }}
      >
        VibeSchool
      </span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        {isLoggedIn ? (
          <>
            <div
              onClick={() => router.push('/global/dashboard')}
              style={{
                backgroundColor: '#CCFF00', color: '#090D16',
                fontSize: 12, fontWeight: 700, padding: '6px 12px', borderRadius: 24, cursor: 'pointer',
              }}
            >
              Dashboard
            </div>
            <div
              onClick={() => router.push('/global/profile')}
              style={{
                width: 32, height: 32, borderRadius: '50%',
                backgroundColor: '#1a2235', border: '1px solid rgba(255,255,255,0.2)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#ffffff', fontSize: 12, fontWeight: 600, cursor: 'pointer',
              }}
            >
              {initials}
            </div>
          </>
        ) : (
          <div
            onClick={() => router.push('/global/signin')}
            style={{
              border: '1px solid #CCFF00', color: '#CCFF00',
              fontSize: 13, fontWeight: 600, padding: '6px 14px',
              borderRadius: 12, cursor: 'pointer',
            }}
          >
            Sign In
          </div>
        )}
      </div>
    </header>
  )
}
