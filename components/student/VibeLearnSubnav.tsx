'use client'

import { usePathname, useRouter } from 'next/navigation'

const TABS = [
  { label: 'Learn', href: '/student/vibelearn' },
  { label: 'KCSE', href: '/student/vibelearn/kcse' },
  { label: 'Practice', href: '/student/vibelearn/practice' },
  { label: 'Exams', href: '/student/vibelearn/exams' },
  { label: 'Revision', href: '/student/vibelearn/revision' },
  { label: 'Mistakes', href: '/student/vibelearn/mistakes' },
] as const

function isActive(pathname: string, href: string): boolean {
  if (href === '/student/vibelearn') return pathname === href || pathname === `${href}/`
  return pathname === href || pathname.startsWith(`${href}/`)
}

export default function VibeLearnSubnav() {
  const router = useRouter()
  const pathname = usePathname()
  return <nav aria-label="VibeLearn sections" style={navStyle}>{TABS.map(tab => {
    const active = isActive(pathname, tab.href)
    return <button key={tab.href} type="button" onClick={() => router.push(tab.href)} aria-current={active ? 'page' : undefined} style={{ ...tabStyle, ...(active ? activeTabStyle : {}) }}>{tab.label}</button>
  })}</nav>
}

const navStyle: React.CSSProperties = { display: 'flex', gap: 8, overflowX: 'auto', padding: '2px 0 12px', marginBottom: 4, scrollbarWidth: 'none' }
const tabStyle: React.CSSProperties = { flex: '0 0 auto', border: '1px solid #e2e8f0', background: '#fff', color: '#475569', borderRadius: 999, padding: '9px 13px', fontSize: 12, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit' }
const activeTabStyle: React.CSSProperties = { borderColor: '#4f46e5', background: '#eef2ff', color: '#4338ca' }
