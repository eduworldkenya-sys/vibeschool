'use client'

import { useRouter } from 'next/navigation'

type TabKey = 'home' | 'lessonplan' | 'vibeconnect' | 'more' | 'profile'

interface Props {
  active:         TabKey
  onChange?:      (tab: TabKey) => void
  unreadConnect?: number
}

const TABS = [
  { id: 'home',        icon: '🏠', label: 'Home',        href: '/teacher'             },
  { id: 'lessonplan',  icon: '📖', label: 'Plans',        href: '/teacher/lessonplan'  },
  { id: 'vibeconnect', icon: '💬', label: 'VibeConnect',  href: '/teacher/vibeconnect' },
  { id: 'more',        icon: '⋯',  label: 'More',         href: '/teacher/more'        },
  { id: 'profile',     icon: '👤', label: 'Profile',      href: '/teacher/profile'     },
] as const

export default function BottomNav({ active, unreadConnect = 0 }: Props) {
  const router = useRouter()

  return (
    <div style={{
      position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 700,
      background: '#ffffff', borderTop: '1px solid #e5e7eb',
      display: 'flex', height: 64,
      boxShadow: '0 -2px 12px rgba(0,0,0,0.06)',
    }}>
      {TABS.map(t => (
        <button
          key={t.id}
          onClick={() => router.push(t.href)}
          style={{
            flex: 1, display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            gap: 3, border: 'none', background: 'none',
            cursor: 'pointer', padding: '8px 0',
            color: active === t.id ? '#10b981' : '#6b7280',
            transition: 'color 0.15s', position: 'relative',
          }}
        >
          {t.id === 'vibeconnect' && unreadConnect > 0 && (
            <span style={{
              position: 'absolute', top: 6, right: 'calc(50% - 14px)',
              width: 16, height: 16, borderRadius: '50%',
              background: '#ef4444', color: '#fff',
              fontSize: 9, fontWeight: 800,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>{unreadConnect}</span>
          )}
          <span style={{ fontSize: 20, lineHeight: 1 }}>{t.icon}</span>
          <span style={{
            fontSize: 10, fontWeight: active === t.id ? 800 : 600,
            letterSpacing: 0.2, fontFamily: 'Plus Jakarta Sans, sans-serif',
          }}>{t.label}</span>
          {active === t.id && (
            <div style={{
              position: 'absolute', top: 0, width: 28, height: 2.5,
              background: '#10b981', borderRadius: '0 0 3px 3px',
            }} />
          )}
        </button>
      ))}
    </div>
  )
}