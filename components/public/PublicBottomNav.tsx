'use client'

import { usePathname } from 'next/navigation'
import Link from 'next/link'
import styles from './PublicBottomNav.module.css'

// Public destinations only. Learning, exams and signed-in workspaces own their navigation.
const items = [
  { label: 'Home', href: '/', icon: 'home' },
  { label: 'Explore', href: '/product', icon: 'explore' },
  { label: 'Schools', href: '/schools', icon: 'schools' },
  { label: 'Teachers', href: '/teacher', icon: 'teachers' },
  { label: 'Contact', href: '/contact', icon: 'contact' },
] as const

function NavIcon({ name }: { name: (typeof items)[number]['icon'] }) {
  const common = {
    width: 20, height: 20, viewBox: '0 0 24 24', fill: 'none',
    stroke: 'currentColor', strokeWidth: 1.8,
    strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const,
    'aria-hidden': true as const,
  }
  switch (name) {
    case 'home': return <svg {...common}><path d="m3 10 9-7 9 7"/><path d="M5 9v11h14V9M9 20v-6h6v6"/></svg>
    case 'explore': return <svg {...common}><circle cx="12" cy="12" r="9"/><path d="m15.8 8.2-2.5 5.1-5.1 2.5 2.5-5.1 5.1-2.5Z"/></svg>
    case 'schools': return <svg {...common}><path d="M4 21V7l8-4 8 4v14M4 10h16M9 21v-7h6v7M7 13h.01M17 13h.01"/></svg>
    case 'teachers': return <svg {...common}><path d="M3 5h18v11H3zM7 21l5-5 5 5M8 9h8M8 12h5"/></svg>
    case 'contact': return <svg {...common}><path d="M20 11.5a8.5 8.5 0 0 1-8.5 8.5 9 9 0 0 1-4-.9L3 20l1-4.4A8.5 8.5 0 1 1 20 11.5Z"/><path d="M8 11h8"/></svg>
  }
}

const PUBLIC_ROOTS = new Set(['/', '/teacher', '/schools', '/product', '/about', '/about/founder-note', '/contact', '/institutions', '/trust'])

export function PublicBottomNav() {
  const pathname = usePathname()
  if (!PUBLIC_ROOTS.has(pathname)) return null

  return (
    <>
      <nav aria-label="Public bottom navigation" className={styles.nav} style={{
        position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 80,
        paddingBottom: 'env(safe-area-inset-bottom)',
        background: 'rgba(255,255,255,.97)', borderTop: '1px solid #e5e7eb',
        boxShadow: '0 -5px 22px rgba(17,24,39,.08)', backdropFilter: 'blur(14px)',
      }}>
        <div style={{ width: 'min(640px, 100%)', height: 64, margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0, 1fr))', alignItems: 'center' }}>
          {items.map((item) => {
            const isActive = pathname === item.href
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
      <div className={styles.spacer} aria-hidden="true"/>
    </>
  )
}
