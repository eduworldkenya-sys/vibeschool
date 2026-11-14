'use client'

import { usePathname, useRouter } from 'next/navigation'
import { useStudent } from '@/lib/student-context'

const TABS = [
  { label: 'Learn', href: '/student/study' },
  { label: 'KCSE', href: '/student/vibelearn/kcse' },
  { label: 'Practice', href: '/student/vibelearn/topic-practice' },
  { label: 'Exams', href: '/student/vibelearn/exams' },
  { label: 'Revision', href: '/student/vibelearn/revision' },
  { label: 'Mistakes', href: '/student/vibelearn/mistakes' },
  { label: 'Progress', href: '/student/marks' },
] as const

function isActive(pathname: string, href: string): boolean {
  if (href === '/student/vibelearn/topic-practice' && pathname === '/student/vibelearn/practice') return true
  if (href === '/student/study') return pathname === href || pathname === `${href}/` || pathname.startsWith('/learn')
  return pathname === href || pathname.startsWith(`${href}/`)
}

export default function VibeLearnSubnav() {
  const router = useRouter()
  const pathname = usePathname()
  const { identity, loading } = useStudent()
  const isForm4 = !loading && /^form\s*4$/i.test(identity?.className?.trim() ?? '')
  return <nav aria-label="VibeLearn sections" style={navStyle}>{TABS.filter(tab => tab.label !== 'KCSE' || isForm4).map(tab => {
    const active = isActive(pathname, tab.href)
    return <button key={tab.href} type="button" onClick={() => router.push(tab.href)} aria-current={active ? 'page' : undefined} style={{ ...tabStyle, ...(active ? activeTabStyle : {}) }}>{tab.label}</button>
  })}</nav>
}

const navStyle: React.CSSProperties = { display: 'flex', gap: 8, overflowX: 'auto', padding: '10px', marginBottom: 10, background: 'var(--vs-card)', borderRadius: 15, scrollbarWidth: 'thin' }
const tabStyle: React.CSSProperties = { flex: '0 0 auto', border: '1px solid var(--vs-border)', background: 'var(--vs-card)', color: 'var(--vs-muted)', borderRadius: 999, padding: '9px 13px', fontSize: 12, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit' }
const activeTabStyle: React.CSSProperties = { borderColor: 'var(--vs-accent)', background: 'var(--vs-accent-soft)', color: 'var(--vs-accent)' }
