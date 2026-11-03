'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import styles from './VibeTutor.module.css'
import Icon, { type IconName } from './Icon'

const TABS: { href: string; label: string; icon: IconName; match: (p: string) => boolean }[] = [
  { href: '/vibetutor', label: 'Home', icon: 'home', match: p => p === '/vibetutor' },
  { href: '/vibetutor/browse', label: 'Browse', icon: 'search', match: p => p.startsWith('/vibetutor/browse') || p.startsWith('/vibetutor/find-') },
  { href: '/vibetutor/post-request', label: 'Post request', icon: 'plus', match: p => p.startsWith('/vibetutor/post-request') },
  { href: '/vibetutor/become-tutor', label: 'Teach', icon: 'users', match: p => p.startsWith('/vibetutor/become-tutor') },
]

export default function Nav() {
  const path = usePathname() ?? ''
  return (
    <>
      <header className={styles.topbar}>
        <div className={styles.topbarInner}>
          <Link href="/vibetutor" className={styles.brand} aria-label="VibeTutor home">
            <span className={styles.brandMark} aria-hidden="true">V</span>
            <span>VibeTutor</span>
          </Link>
          <nav className={styles.navLinks} aria-label="Main">
            {TABS.map(t => (
              <Link key={t.href} href={t.href} className={`${styles.navLink} ${t.match(path) ? styles.navLinkOn : ''}`} aria-current={t.match(path) ? 'page' : undefined}>
                {t.label}
              </Link>
            ))}
          </nav>
        </div>
      </header>
      <nav className={styles.tabbar} aria-label="Mobile">
        {TABS.map(t => (
          <Link key={t.href} href={t.href} className={`${styles.tab} ${t.match(path) ? styles.tabOn : ''}`} aria-current={t.match(path) ? 'page' : undefined}>
            <Icon name={t.icon} size={22} />
            <span>{t.label}</span>
          </Link>
        ))}
      </nav>
    </>
  )
}
