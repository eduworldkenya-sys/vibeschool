import Image from 'next/image'
import Link from 'next/link'
import { TrackedLink } from './TrackedLink'
import { PublicJourneyTracker } from './PublicJourneyTracker'
import styles from './PublicShell.module.css'

type PublicHeaderProps = { product?: string; compact?: boolean; navigation?: ReadonlyArray<readonly [string, string]> }

const primaryNav = [
  ['/learn', 'Learn'],
  ['/teacher', 'Teachers'],
  ['/vibetutor', 'VibeTutor'],
  ['/pathways', 'Pathways'],
] as const

// All remaining destinations are retained in Others.
const otherNav = [
  ['/product', 'Product'],
  ['/sandbox', 'Experience'],
  ['/success-wishes', 'Success Wishes'],
  ['/blog', 'News & Guides'],
  ['/schools', 'Find Schools'],
  ['/institutions', 'For Schools'],
  ['/about', 'About'],
  ['/contact', 'Contact'],
] as const

export function PublicHeader({ product, compact = false, navigation }: PublicHeaderProps) {
  const defaultNav = !compact && navigation === undefined
  const displayedNav: ReadonlyArray<readonly [string, string]> = navigation ?? (compact ? [['/', 'Home'], ['/pathways', 'Pathways']] : primaryNav)
  const activeOther = otherNav.some(([, label]) => label === product)
  const showProductLabel = product && !compact && !primaryNav.some(([, label]) => label === product)
  return <>
    <PublicJourneyTracker />
    <a href="#main-content" className={styles.skip}>Skip to content</a>
    <header className={`${styles.header} ${compact ? styles.compactHeader : ''}`}>
      <div className={styles.headerInner}>
        <Link href="/" aria-label="VibeSchool home" className={styles.brand}>
          <span className={styles.productLockup}>
            <Image src="/brand/vibeschool-wordmark.svg" alt="VibeSchool" width={620} height={160} priority className={styles.logo}/>
            {showProductLabel ? <><span className={styles.divider} aria-hidden="true"/><span className={styles.productName}>{product}</span></> : null}
          </span>
        </Link>
        <nav className={styles.nav} aria-label="Public navigation">
          {displayedNav.map(([href,label]) => <Link key={href} href={href} aria-current={(compact && href === '/pathways') || product === label ? 'page' : undefined}>{label}</Link>)}
          {defaultNav && <details className={styles.moreMenu}>
            <summary aria-label="Others" aria-current={activeOther ? 'page' : undefined}>Others</summary>
            <div className={styles.morePanel} role="group" aria-label="Other VibeSchool pages">
              {otherNav.map(([href,label]) => <Link key={href} href={href} aria-current={product === label ? 'page' : undefined}>{label}</Link>)}
            </div>
          </details>}
          {!compact && <TrackedLink href="/login/global" event="public_auth_signin" className={styles.signin}>Sign in</TrackedLink>}
        </nav>
        <details className={styles.mobileMenu}>
          <summary aria-label="Open public navigation">Menu</summary>
          <nav className={styles.mobilePanel} aria-label="Mobile public navigation">
            {displayedNav.map(([href,label]) => <Link key={href} href={href} aria-current={product === label ? 'page' : undefined}>{label}</Link>)}
            {defaultNav && <>
              <span className={styles.mobileSection}>Others</span>
              {otherNav.map(([href,label]) => <Link key={href} href={href} aria-current={product === label ? 'page' : undefined}>{label}</Link>)}
            </>}
            {!compact && <TrackedLink href="/login/global" event="public_auth_signin" className={styles.mobileSignin}>Sign in</TrackedLink>}
          </nav>
        </details>
      </div>
    </header>
  </>
}
