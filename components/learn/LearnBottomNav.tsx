"use client"

import { usePathname, useRouter } from 'next/navigation'

const BG = '#000000'
const BORDER = '#1f1f23'
const ACCENT = '#10b981'
const MUTED = '#71717a'
const FONT_BODY = "'Plus Jakarta Sans', system-ui, sans-serif"

interface NavItem {
  href: string
  label: string
  icon: string
}

const NAV_ITEMS: NavItem[] = [
  { href: '/learn', label: 'Home', icon: '🏠' },
  { href: '/learn/careers', label: 'Careers', icon: '🎯' },
]

export function LearnBottomNav() {
  const router = useRouter()
  const pathname = usePathname()

  return (
    <div style={{
      position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 50,
      background: `${BG}f2`, backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
      borderTop: `1px solid ${BORDER}`,
      paddingBottom: 'env(safe-area-inset-bottom, 0px)',
    }}>
      <div style={{
        display: 'flex', justifyContent: 'space-around', alignItems: 'center',
        maxWidth: 480, margin: '0 auto', padding: '10px 16px',
      }}>
        {NAV_ITEMS.map((item) => {
          const isActive = item.href === '/learn'
            ? pathname === '/learn'
            : pathname.startsWith(item.href)

          return (
            <button
              key={item.href}
              onClick={() => router.push(item.href)}
              style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
                background: 'none', border: 'none', cursor: 'pointer',
                padding: '4px 18px',
              }}
            >
              <span style={{
                fontSize: 19,
                filter: isActive ? 'none' : 'grayscale(1) opacity(0.6)',
              }}>
                {item.icon}
              </span>
              <span style={{
                fontFamily: FONT_BODY, fontSize: 10.5, fontWeight: 700,
                color: isActive ? ACCENT : MUTED,
              }}>
                {item.label}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
