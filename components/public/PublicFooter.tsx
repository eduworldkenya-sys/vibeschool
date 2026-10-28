'use client'
import { useEffect, useRef } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { TrackedLink } from './TrackedLink'
import styles from './PublicShell.module.css'

const WHATSAPP_URL = 'https://wa.me/254728232157?text=Hello%20VibeSchool%2C%20I%20need%20help%20with...'
const TIKTOK_URL = 'https://www.tiktok.com/@vibeschoolkenya'

export function PublicFooter() {
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
  return <footer ref={footerRef} className={styles.footer}>
    <section className={styles.whatsapp} aria-label="VibeSchool support"><div className={styles.whatsappInner}>
      <div className={styles.whatsappText}><strong>Need help or want to talk to VibeSchool?</strong><span>Use WhatsApp for the fastest conversation. Never send passwords, one-time codes or payment credentials.</span></div>
      <TrackedLink className={styles.whatsappCta} href={WHATSAPP_URL} event="public_contact_whatsapp" external target="_blank" rel="noopener noreferrer" aria-label="Chat with VibeSchool on WhatsApp">Chat on WhatsApp</TrackedLink>
    </div></section>
    <div className={styles.footerInner}>
      <div className={styles.footerTop}>
        <div className={styles.footerBrand}>
          <Image src="/brand/vibeschool-wordmark-dark.svg" alt="VibeSchool" width={620} height={160} className={styles.footerLogo}/>
          <p className={styles.tagline}>One learning system connecting curriculum, teaching, evidence, progress, families, schools and future direction.</p>
          <div className={styles.social}><a href={TIKTOK_URL} target="_blank" rel="noopener noreferrer">TikTok</a><TrackedLink href={WHATSAPP_URL} event="public_contact_whatsapp" external target="_blank" rel="noopener noreferrer">WhatsApp</TrackedLink></div>
        </div>
        <details data-footer-group className={styles.footerGroup}><summary className={styles.columnTitle}>Product</summary><div className={styles.linkList}><Link href="/product">Product overview</Link><Link href="/sandbox">Try the sandbox</Link><Link href="/evidence">Learning evidence</Link><Link href="/global">Learning</Link><Link href="/blog">News & guides</Link><Link href="/pathways">Pathways</Link><Link href="/schools">School directory</Link><Link href="/institutions">For school leaders</Link></div></details>
        <details data-footer-group className={styles.footerGroup}><summary className={styles.columnTitle}>Educators</summary><div className={styles.linkList}><Link href="/product">Teacher system</Link><Link href="/schools">Find a school</Link><Link href="/institutions">Run a school</Link><Link href="/global">Learning resources</Link><TrackedLink href="/login/global?role=teacher" event="public_auth_signin">Teacher sign in</TrackedLink></div></details>
        <details data-footer-group className={styles.footerGroup}><summary className={styles.columnTitle}>Families</summary><div className={styles.linkList}><Link href="/product">Parent experience</Link><Link href="/schools">Find a school</Link><Link href="/blog">Education news & guides</Link><Link href="/pathways">Future choices</Link><TrackedLink href="/login/global?role=parent" event="public_auth_signin">Parent sign in</TrackedLink></div></details>
        <details data-footer-group className={styles.footerGroup}><summary className={styles.columnTitle}>VibeSchool</summary><div className={styles.linkList}><Link href="/about">About</Link><Link href="/institutions">Institutions & government</Link><Link href="/institutions/constituency-pilot">Constituency pilot</Link><Link href="/trust">Trust Centre</Link><Link href="/contact">Contact</Link><Link href="/careers">Careers</Link></div></details>
      </div>
      <nav className={styles.legalLinks} aria-label="Success Wishes"><Link href="/success-wishes">Success Wishes</Link></nav>
      <div className={styles.footerBottom}><span>© 2026 VibeSchool · Kenya</span><div className={styles.legalLinks}><Link href="/trust">Trust</Link><Link href="/legal/privacy">Privacy</Link><Link href="/legal/terms">Terms</Link><Link href="/legal/aup">Acceptable Use</Link></div></div>
    </div>
  </footer>
}
