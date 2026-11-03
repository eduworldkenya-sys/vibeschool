'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import polish from './VibeTutorPolish.module.css'
import styles from './VibeTutor.module.css'
import Icon, { type IconName } from './Icon'

const TABS: { href: string; label: string; icon: IconName; match: (p: string) => boolean }[] = [
  { href: '/vibetutor', label: 'Discover', icon: 'search', match: p => p === '/vibetutor' || p.startsWith('/vibetutor/browse') || p.startsWith('/vibetutor/find-') },
  { href: '/vibetutor/post-request', label: 'Learn', icon: 'book', match: p => p.startsWith('/vibetutor/post-request') },
  { href: '/vibetutor/become-tutor', label: 'Teach', icon: 'users', match: p => p.startsWith('/vibetutor/become-tutor') },
  { href: '/login', label: 'Account', icon: 'user', match: p => p === '/login' || p.startsWith('/signup') || p.startsWith('/account') },
]

export default function Nav() {
  const path = usePathname() ?? ''
  const [theme, setTheme] = useState<'light' | 'dark' | 'system'>('system')

  useEffect(() => {
    const saved = window.localStorage.getItem('vibetutor-theme')
    if (saved === 'light' || saved === 'dark' || saved === 'system') setTheme(saved)
  }, [])

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const apply = () => {
      const resolved = theme === 'system' ? (media.matches ? 'dark' : 'light') : theme
      document.documentElement.dataset.vtTheme = resolved
      document.documentElement.style.colorScheme = resolved
    }
    apply()
    if (theme !== 'system') return
    media.addEventListener('change', apply)
    return () => media.removeEventListener('change', apply)
  }, [theme])

  function changeTheme(value: 'light' | 'dark' | 'system') {
    setTheme(value)
    window.localStorage.setItem('vibetutor-theme', value)
    const resolved = value === 'system'
      ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
      : value
    document.documentElement.dataset.vtTheme = resolved
    document.documentElement.style.colorScheme = resolved
  }

  return (
    <>
      <header className={styles.topbar}>
        <div className={styles.topbarInner}>
          <Link href="/vibetutor" className={styles.brand} aria-label="VibeTutor home">
            <Image src="/brand/vibeschool-wordmark.svg" alt="VibeSchool" width={124} height={32} priority className={styles.brandLogo} />
            <span className={styles.brandDivider} aria-hidden="true" />
            <span>VibeTutor</span>
          </Link>
          <div className={styles.navActions}>
            <label className={styles.themeControl}>
              <span className={styles.themeLabel}>Theme</span>
              <select
                className={styles.themeSelect}
                aria-label="Choose VibeTutor theme"
                value={theme}
                onChange={event => changeTheme(event.target.value as 'light' | 'dark' | 'system')}
              >
                <option value="light">Light</option>
                <option value="dark">Dark</option>
                <option value="system">System</option>
              </select>
            </label>
          </div>
          <nav className={styles.navLinks} aria-label="Main">
            {TABS.map(t => (
              <Link key={t.href} href={t.href} className={`${styles.navLink} ${t.match(path) ? styles.navLinkOn : ''}`} aria-current={t.match(path) ? 'page' : undefined}>
                {t.label}
              </Link>
            ))}
          </nav>
        </div>
      </header>
      <nav className={`${styles.tabbar} ${polish.navBar}`} aria-label="Mobile">
        {TABS.map(t => (
          <Link key={t.href} href={t.href} className={`${polish.navItem} ${t.match(path) ? polish.navActive : ''}`} aria-current={t.match(path) ? 'page' : undefined}>
            <Icon name={t.icon} size={22} />
            <span>{t.label}</span>
          </Link>
        ))}
      </nav>
    </>
  )
}
