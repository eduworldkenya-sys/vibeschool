'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
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
  const [theme, setTheme] = useState<'light' | 'dark' | 'system'>('light')

  useEffect(() => {
    const saved = window.localStorage.getItem('vibetutor-theme')
    if (saved === 'light' || saved === 'dark' || saved === 'system') setTheme(saved)
  }, [])

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const previousHtmlBackground = document.documentElement.style.backgroundColor
    const previousBodyBackground = document.body.style.backgroundColor

    const apply = () => {
      const resolved = theme === 'system' ? (media.matches ? 'dark' : 'light') : theme
      const canvas = resolved === 'dark' ? '#201d1d' : '#f5f0e8'
      document.documentElement.dataset.vtTheme = resolved
      document.documentElement.style.colorScheme = resolved
      // Keep the document canvas in sync with the VibeTutor shell so the
      // global VibeSchool page background cannot show through at the edges.
      document.documentElement.style.backgroundColor = canvas
      document.body.style.backgroundColor = canvas
    }

    apply()
    if (theme === 'system') media.addEventListener('change', apply)

    return () => {
      if (theme === 'system') media.removeEventListener('change', apply)
      delete document.documentElement.dataset.vtTheme
      document.documentElement.style.colorScheme = ''
      document.documentElement.style.backgroundColor = previousHtmlBackground
      document.body.style.backgroundColor = previousBodyBackground
    }
  }, [theme])

  function changeTheme(value: 'light' | 'dark' | 'system') {
    setTheme(value)
    window.localStorage.setItem('vibetutor-theme', value)
  }

  return (
    <>
      <header className={styles.topbar}>
        <div className={styles.topbarInner}>
          <div className={styles.brand}>
            <Link href="/" className={styles.brandHome} aria-label="VibeSchool home">
              <Image src="/brand/vibeschool-wordmark.svg" alt="VibeSchool" width={620} height={160} className={styles.brandLogo} />
              <Image src="/brand/vibeschool-wordmark-dark.svg" alt="" aria-hidden="true" width={620} height={160} className={styles.brandLogoDark} />
            </Link>
            <span className={styles.brandDivider} aria-hidden="true" />
            <Link href="/vibetutor" className={styles.brandProduct} aria-label="VibeTutor home">VibeTutor</Link>
          </div>
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
