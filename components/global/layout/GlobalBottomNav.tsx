'use client'

import React from 'react'
import { usePathname, useRouter } from 'next/navigation'

interface GlobalBottomNavProps {
  isLoggedIn: boolean
  onAuthPrompt: () => void
}

interface NavTab {
  label: string
  path: string
  icon: string
  isCenter?: boolean
}

export function GlobalBottomNav({ isLoggedIn, onAuthPrompt }: GlobalBottomNavProps) {
  const pathname = usePathname()
  const router = useRouter()

  const tabs: NavTab[] = [
    { label: 'Home',    path: '/global/dashboard', icon: '🏠' },
    { label: 'Read',    path: '/global/read',       icon: '📖' },
    { label: 'Create',  path: '/global/create',     icon: '➕', isCenter: true },
    { label: 'Vibes',   path: '/global/vibes',      icon: '✦' },
    { label: 'Profile', path: '/global/profile',    icon: '👤' },
  ]

  const handleTabClick = (tab: NavTab) => {
    if (tab.isCenter) {
      if (isLoggedIn) { router.push('/global/create') } else { onAuthPrompt() }
      return
    }
    if (tab.path === '/global/profile' && !isLoggedIn) {
      router.push('/global/signup')
      return
    }
    router.push(tab.path)
  }

  const isTabActive = (tab: NavTab) => {
    if (tab.path === '/global/dashboard') {
      return pathname === '/global/dashboard' || pathname === '/global'
    }
    return pathname.startsWith(tab.path)
  }

  return (
    <nav style={{
      position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)',
      width: '100%', maxWidth: '480px', height: 64,
      backgroundColor: '#111827', borderTop: '1px solid rgba(255,255,255,0.06)',
      display: 'flex', alignItems: 'center', justifyContent: 'space-around',
      zIndex: 90, boxShadow: '0 -4px 20px rgba(0,0,0,0.3)',
    }}>
      {tabs.map((tab) => {
        const isActive = isTabActive(tab)

        if (tab.isCenter) {
          return (
            <div
              key={tab.label}
              onClick={() => handleTabClick(tab)}
              style={{
                marginTop: -20, width: 54, height: 54, borderRadius: '50%',
                backgroundColor: '#CCFF00', border: '3px solid #111827',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', boxShadow: '0 4px 12px rgba(204,255,0,0.35)',
              }}
            >
              <span style={{ fontSize: 20, color: '#090D16' }}>{tab.icon}</span>
            </div>
          )
        }

        return (
          <div
            key={tab.label}
            onClick={() => handleTabClick(tab)}
            style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              justifyContent: 'center', flex: 1, height: '100%',
              cursor: 'pointer', position: 'relative',
            }}
          >
            {isActive && (
              <div style={{
                position: 'absolute', top: 0, width: 24, height: 3,
                backgroundColor: '#CCFF00', borderRadius: '0 0 2px 2px',
              }} />
            )}
            <span style={{ fontSize: 18, opacity: isActive ? 1 : 0.5 }}>
              {tab.icon}
            </span>
            <span style={{
              fontSize: 10, marginTop: 2,
              color: isActive ? '#CCFF00' : 'rgba(255,255,255,0.4)',
              fontWeight: isActive ? 700 : 400,
            }}>
              {tab.label}
            </span>
          </div>
        )
      })}
    </nav>
  )
}
