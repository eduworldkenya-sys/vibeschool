import Image from 'next/image'
import Link from 'next/link'
import styles from './PublicShell.module.css'

type PublicHeaderProps = {
  product?: string
}

export function PublicHeader({ product }: PublicHeaderProps) {
  return <>
    <a href="#main-content" className={styles.skip}>Skip to content</a>
    <header className={styles.header}>
      <div className={styles.headerInner}>
        <Link href="/" aria-label="VibeSchool home" className={styles.brand}>
          <span className={styles.productLockup}>
            <Image src="/icons/vibeschool-logo.png" alt="VibeSchool" width={460} height={120} priority className={styles.logo} />
            {product ? <><span className={styles.divider} aria-hidden="true"/><span className={styles.productName}>{product}</span></> : null}
          </span>
        </Link>
        <nav className={styles.nav} aria-label="Public navigation">
          <Link href="/global">Learn</Link>
          <Link href="/pathways">Pathways</Link>
          <Link href="/teacher">Teachers</Link>
          <Link href="/about">About</Link>
          <Link href="/contact">Contact</Link>
          <Link href="/login/global" className={styles.signin}>Sign in</Link>
        </nav>
        <Link href="/contact" className={styles.mobileMenu} aria-label="Open VibeSchool contact and navigation">Menu</Link>
      </div>
    </header>
  </>
}
