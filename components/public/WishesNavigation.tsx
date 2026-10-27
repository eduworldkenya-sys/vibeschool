'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, Send, Gift, Inbox, KeyRound } from 'lucide-react'
import styles from './WishesNavigation.module.css'

const links = [
  { href: '/', label: 'Home', icon: Home },
  { href: '/success-wishes', label: 'Send a Wish', icon: Send },
  { href: '/success-wishes/open', label: 'Receive a Wish', icon: Gift },
  { href: '/success-wishes/inbox', label: 'My Inbox', icon: Inbox },
  { href: '/success-wishes/recover', label: 'Recover Access', icon: KeyRound },
]

export function WishesNavigation() {
  const pathname = usePathname()
  return <>
    <nav className={styles.top} aria-label="Success Wishes navigation">
      {links.map(({ href, label }) => <Link key={href} href={href} aria-current={pathname === href ? 'page' : undefined}>{label}</Link>)}
    </nav>
    <nav className={styles.bottom} aria-label="Success Wishes bottom navigation">
      {links.map(({ href, label, icon: Icon }) => <Link key={href} href={href} aria-current={pathname === href ? 'page' : undefined}><Icon size={19} aria-hidden="true"/><span>{label}</span></Link>)}
    </nav>
  </>
}
