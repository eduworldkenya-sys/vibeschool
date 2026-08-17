import Image from 'next/image'
import Link from 'next/link'
import { TrackedLink } from './TrackedLink'
import { PublicJourneyTracker } from './PublicJourneyTracker'
import styles from './PublicShell.module.css'

type PublicHeaderProps = { product?: string }

const navItems = [
  ['/global', 'Learn'],
  ['/pathways', 'Pathways'],
  ['/about', 'About'],
  ['/contact', 'Contact'],
] as const

export function PublicHeader({ product }: PublicHeaderProps) {
  return <>
    <PublicJourneyTracker />
    <a href="#main-content" className={styles.skip}>Skip to content</a>
    <header className={styles.header}>
      <div className={styles.headerInner}>
        <Link href="/" aria-label="VibeSchool home" className={styles.brand}>
          <span className={styles.productLockup}>
            <Image
              src="/brand/vibeschool-wordmark.svg"
              alt="VibeSchool"
              width={920}
              height={180}
              priority
              className={styles.logo}
            />
            {product ? <><span className={styles.divider} aria-hidden="true"/><span className={styles.productName}>{product}</span></> : null}
          </span>
        </Link>
        <nav className={styles.nav} aria-label="Public navigation">
          {navItems.map(([href,label]) => <Link key={href} href={href}>{label}</Link>)}
          <TrackedLink href="/login/global" event="public_auth_signin" className={styles.signin}>Sign in</TrackedLink>
        </nav>
        <details className={styles.mobileMenu}>
          <summary aria-label="Open public navigation">Menu</summary>
          <nav className={styles.mobilePanel} aria-label="Mobile public navigation">
            {navItems.map(([href,label]) => <Link key={href} href={href}>{label}</Link>)}
            <TrackedLink href="/login/global" event="public_auth_signin" className={styles.mobileSignin}>Sign in</TrackedLink>
          </nav>
        </details>
      </div>
    </header>
  </>
}
