'use client'
import { useEffect, useRef } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { TrackedLink } from './TrackedLink'
import styles from './PublicShell.module.css'

const WHATSAPP_URL = 'https://wa.me/254728232157?text=Hello%20VibeSchool'
const TIKTOK_URL = 'https://www.tiktok.com/@vibeschoolkenya'

export function PublicFooter({ compact = false }: { compact?: boolean } = {}) {
  const footerRef = useRef<HTMLElement>(null)

  useEffect(() => {
    const media = window.matchMedia('(max-width: 640px)')
    const sync = () => {
      footerRef.current?.querySelectorAll<HTMLDetailsElement>('details[data-footer-group]').forEach(group => {
        group.open = !media.matches
      })
    }
    sync()
    media.addEventListener('change', sync)
    return () => media.removeEventListener('change', sync)
  }, [])

  if (compact) return (
    <footer ref={footerRef} className={styles.compactFooter}>
      <Image src="/brand/vibeschool-wordmark-dark.svg" alt="VibeSchool" width={110} height={28}/>
      <span>© 2026 VibeSchool</span>
      <Link href="/learn/careers">Search careers</Link>
      <TrackedLink href={WHATSAPP_URL} event="public_contact_whatsapp" external target="_blank" rel="noopener noreferrer">Contact VibeSchool</TrackedLink>
      <Link href="/legal/privacy">Privacy</Link>
      <Link href="/legal/terms">Terms</Link>
    </footer>
  )

  return (
    <footer ref={footerRef} className={styles.footer}>
      <section className={styles.whatsapp} aria-label="VibeSchool support">
        <div className={styles.whatsappInner}>
          <div className={styles.whatsappText}><strong>Need help?</strong></div>
          <TrackedLink className={styles.whatsappCta} href={WHATSAPP_URL} event="public_contact_whatsapp" external target="_blank" rel="noopener noreferrer" aria-label="Chat with VibeSchool on WhatsApp">WhatsApp</TrackedLink>
        </div>
      </section>

      <div className={styles.footerInner}>
        <div className={styles.footerBrand}>
          <div className={styles.brandIdentity}>
            <Image src="/brand/vibeschool-wordmark-dark.svg" alt="VibeSchool" width={620} height={160} className={styles.footerLogo}/>
            <p className={styles.tagline}>Teaching and learning, connected.</p>
          </div>
          <div className={styles.social}>
            <a href={TIKTOK_URL} target="_blank" rel="noopener noreferrer">TikTok</a>
          </div>
        </div>

        <nav className={styles.footerTop} aria-label="Footer navigation">
          <details data-footer-group open className={styles.footerGroup}>
            <summary className={styles.columnTitle}>Explore</summary>
            <div className={styles.linkList}>
              <Link href="/global">Learn</Link>
              <Link href="/schools">Find schools</Link>
              <Link href="/pathways">Pathways</Link>
              <Link href="/blog">News &amp; guides</Link>
              <Link href="/success-wishes">Success Wishes</Link>
            </div>
          </details>
          <details data-footer-group open className={styles.footerGroup}>
            <summary className={styles.columnTitle}>Educators</summary>
            <div className={styles.linkList}>
              <Link href="/teacher">Teachers</Link>
              <Link href="/institutions">For schools</Link>
              <Link href="/sandbox">Sandbox</Link>
              <Link href="/evidence">Learning evidence</Link>
              <TrackedLink href="/login/global?role=teacher" event="public_auth_signin">Sign in</TrackedLink>
            </div>
          </details>
          <details data-footer-group open className={styles.footerGroup}>
            <summary className={styles.columnTitle}>Company</summary>
            <div className={styles.linkList}>
              <Link href="/about">About</Link>
              <Link href="/contact">Contact</Link>
              <Link href="/trust">Trust</Link>
              <Link href="/careers">Careers</Link>
            </div>
          </details>
        </nav>

        <div className={styles.footerBottom}>
          <span>© 2026 VibeSchool · Kenya</span>
          <div className={styles.legalLinks}>
            <Link href="/legal/privacy">Privacy</Link>
            <Link href="/legal/terms">Terms</Link>
            <Link href="/legal/aup">Acceptable Use</Link>
          </div>
        </div>
      </div>
    </footer>
  )
}
