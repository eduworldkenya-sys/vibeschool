'use client'

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
  return (
    <>
      <header className={styles.topbar}>
        <div className={styles.topbarInner}>
          <Link href="/vibetutor" className={styles.brand} aria-label="VibeTutor home">
            <Image src="/brand/vibeschool-wordmark.svg" alt="VibeSchool" width={124} height={32} priority className={styles.brandLogo} />
            <span className={styles.brandDivider} aria-hidden="true" />
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
