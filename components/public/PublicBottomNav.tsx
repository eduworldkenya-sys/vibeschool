'use client'

import { usePathname } from 'next/navigation'
import Link from 'next/link'
import styles from './PublicBottomNav.module.css'

// Reuse the existing public navigation on the website and a Learn-specific version in Learn.
// Students keep their existing student navigation; focused readers have none.
const items = [
  { label: 'Home', href: '/', icon: 'home' },
  { label: 'Explore', href: '/product', icon: 'explore' },
  { label: 'Learn', href: '/learn', icon: 'learn' },
  { label: 'Schools', href: '/schools', icon: 'schools' },
  { label: 'Teachers', href: '/teacher', icon: 'teachers' },
  { label: 'Contact', href: '/contact', icon: 'contact' },
] as const

const learnItems = [
  { label: 'Home', href: '/', icon: 'home' },
  { label: 'Subjects', href: '/learn', icon: 'learn' },
  { label: 'Reading', href: '/learn?view=reading', icon: 'reading' },
  { label: 'Stories', href: '/learn/stories', icon: 'stories' },
  { label: 'Courses', href: '/learn?view=courses', icon: 'courses' },
] as const

type NavIconName = (typeof items)[number]['icon'] | (typeof learnItems)[number]['icon']

function NavIcon({ name }: { name: NavIconName }) {
  const common = {
    width: 20, height: 20, viewBox: '0 0 24 24', fill: 'none',
    stroke: 'currentColor', strokeWidth: 1.8,
    strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const,
    'aria-hidden': true as const,
  }
  switch (name) {
    case 'home': return <svg {...common}><path d="m3 10 9-7 9 7"/><path d="M5 9v11h14V9M9 20v-6h6v6"/></svg>
    case 'explore': return <svg {...common}><circle cx="12" cy="12" r="9"/><path d="m15.8 8.2-2.5 5.1-5.1 2.5 2.5-5.1 5.1-2.5Z"/></svg>
    case 'learn': return <svg {...common}><path d="M2 4h7a3 3 0 0 1 3 3v14a3 3 0 0 0-3-3H2z"/><path d="M22 4h-7a3 3 0 0 0-3 3v14a3 3 0 0 1 3-3h7z"/></svg>
    case 'reading': return <svg {...common}><path d="M4 5h15v15H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z"/><path d="M3 17c0-1 1-2 3-2h13M8 9h7M8 12h5"/></svg>
    case 'stories': return <svg {...common}><path d="M4 20h16M6 20V6a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v14M9 8h6M9 12h6M9 16h4"/></svg>
    case 'courses': return <svg {...common}><path d="m2 9 10-5 10 5-10 5L2 9zM6 12v5c4 3 8 3 12 0v-5M22 9v7"/></svg>
    case 'schools': return <svg {...common}><path d="M4 21V7l8-4 8 4v14M4 10h16M9 21v-7h6v7M7 13h.01M17 13h.01"/></svg>
    case 'teachers': return <svg {...common}><path d="M3 5h18v11H3zM7 21l5-5 5 5M8 9h8M8 12h5"/></svg>
    case 'contact': return <svg {...common}><path d="M20 11.5a8.5 8.5 0 0 1-8.5 8.5 9 9 0 0 1-4-.9L3 20l1-4.4A8.5 8.5 0 1 1 20 11.5Z"/><path d="M8 11h8"/></svg>
  }
}

const PUBLIC_ROOTS = new Set(['/', '/teacher', '/schools', '/product', '/sandbox', '/about', '/about/founder-note', '/contact', '/institutions', '/trust'])

export function PublicBottomNav({ forceVisible = false, mode = 'site', activeView = null }: { forceVisible?: boolean; mode?: 'site' | 'learn'; activeView?: string | null } = {}) {
  const pathname = usePathname()
  if (!forceVisible && !PUBLIC_ROOTS.has(pathname)) return null
  const displayedItems = mode === 'learn' ? learnItems : items

  return (
    <>
      <nav aria-label={mode === 'learn' ? 'Learn bottom navigation' : 'Public bottom navigation'} className={mode === 'learn' ? styles.learnNav : styles.nav} style={{
        position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 80,
        paddingBottom: 'env(safe-area-inset-bottom)',
        background: 'rgba(255,255,255,.97)', borderTop: '1px solid #e5e7eb',
        boxShadow: '0 -5px 22px rgba(17,24,39,.08)', backdropFilter: 'blur(14px)',
      }}>
        <div style={{ width: 'min(640px, 100%)', height: 64, margin: '0 auto', display: 'grid', gridTemplateColumns: mode === 'learn' ? 'repeat(5, minmax(0, 1fr))' : 'repeat(6, minmax(0, 1fr))', alignItems: 'center' }}>
          {displayedItems.map((item) => {
            const isActive = mode === 'learn'
              ? item.href === '/learn' ? pathname === '/learn' && !activeView
                : item.href === '/learn?view=reading' ? pathname === '/learn' && activeView === 'reading'
                : item.href === '/learn?view=courses' ? pathname === '/learn' && activeView === 'courses'
                : item.href === '/learn/stories' ? pathname.startsWith('/learn/stories')
                : pathname === item.href
              : pathname === item.href || (item.href === '/learn' && pathname.startsWith('/learn/')) || (item.href === '/product' && pathname === '/sandbox')
            return (
              <Link key={item.label} href={item.href} aria-label={item.label} aria-current={isActive ? 'page' : undefined}
                style={{ minWidth: 0, minHeight: 44, height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4,
                  color: isActive ? '#172033' : '#6b7280', textDecoration: 'none', fontSize: 11, fontWeight: isActive ? 800 : 650 }}>
                <span style={{ display: 'grid', placeItems: 'center', height: 22 }}><NavIcon name={item.icon}/></span>
                <span>{item.label}</span>
              </Link>
            )
          })}
        </div>
      </nav>
      <div className={mode === 'learn' ? styles.learnSpacer : styles.spacer} aria-hidden="true"/>
    </>
  )
}
