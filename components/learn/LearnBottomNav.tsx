"use client"

import React from 'react'
import { usePathname, useRouter } from 'next/navigation'

interface NavTab {
  label: string
  path: string
  icon: string
}

export function LearnBottomNav() {
  const pathname = usePathname()
  const router = useRouter()

  const tabs: NavTab[] = [
    { label: 'Home',    path: '/learn',         icon: '🏠' },
    { label: 'Careers', path: '/learn/careers', icon: '🎯' },
  ]

  const handleTabClick = (tab: NavTab) => {
    router.push(tab.path)
  }

  const isTabActive = (tab: NavTab) => {
    if (tab.path === '/learn') {
      return pathname === '/learn'
    }
    return pathname.startsWith(tab.path)
  }

  return (
    <nav style={{
      position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)',
      width: '100%', maxWidth: '480px', height: 64,
      backgroundColor: '#ffffff', borderTop: '1px solid #e5e5ef',
      display: 'flex', alignItems: 'center', justifyContent: 'space-around',
      zIndex: 90, boxShadow: '0 -4px 20px rgba(0,0,0,0.06)',
    }}>
      {tabs.map((tab) => {
        const isActive = isTabActive(tab)
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
                backgroundColor: '#1A1AFF', borderRadius: '0 0 2px 2px',
              }} />
            )}
            <span style={{ fontSize: 18, opacity: isActive ? 1 : 0.45 }}>
              {tab.icon}
            </span>
            <span style={{
              fontSize: 10, marginTop: 2,
              color: isActive ? '#1A1AFF' : '#9292a6',
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
