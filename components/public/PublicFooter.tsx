import Image from 'next/image'
import Link from 'next/link'
import { TrackedLink } from './TrackedLink'
import styles from './PublicShell.module.css'

const WHATSAPP_URL = 'https://wa.me/254728232157?text=Hello%20VibeSchool%2C%20I%20need%20help%20with...'
const TIKTOK_URL = 'https://www.tiktok.com/@vibeschoolkenya'

export function PublicFooter() {
  return <footer className={styles.footer}>
    <section className={styles.whatsapp} aria-label="VibeSchool support"><div className={styles.whatsappInner}>
      <div className={styles.whatsappText}><strong>Need help or want to talk to VibeSchool?</strong><span>Use WhatsApp for the fastest conversation. Never send passwords, one-time codes or payment credentials.</span></div>
      <TrackedLink className={styles.whatsappCta} href={WHATSAPP_URL} event="public_contact_whatsapp" external target="_blank" rel="noopener noreferrer" aria-label="Chat with VibeSchool on WhatsApp">Chat on WhatsApp</TrackedLink>
    </div></section>
    <div className={styles.footerInner}>
      <div className={styles.footerTop}>
        <div className={styles.footerBrand}>
          <Image
            src="/brand/vibeschool-wordmark.svg"
            alt="VibeSchool"
            width={920}
            height={180}
            className={styles.footerLogo}
          />
          <p className={styles.tagline}>Learn today. Understand your direction. Grow with the people and institutions around your education.</p>
          <div className={styles.social}><a href={TIKTOK_URL} target="_blank" rel="noopener noreferrer">TikTok</a><TrackedLink href={WHATSAPP_URL} event="public_contact_whatsapp" external target="_blank" rel="noopener noreferrer">WhatsApp</TrackedLink></div>
        </div>
        <div><h2 className={styles.columnTitle}>Learn</h2><div className={styles.linkList}><Link href="/global">Learning</Link><Link href="/pathways">Pathways</Link><Link href="/learn/careers">Careers</Link><Link href="/pathways/schools">Find schools</Link></div></div>
        <div><h2 className={styles.columnTitle}>Educators</h2><div className={styles.linkList}><TrackedLink href="/login/global?role=teacher" event="public_auth_signin">Teachers</TrackedLink><TrackedLink href="/login/global?role=admin" event="public_auth_signin">Schools</TrackedLink><Link href="/global">Resources</Link><Link href="/contact">Support</Link></div></div>
        <div><h2 className={styles.columnTitle}>Families</h2><div className={styles.linkList}><TrackedLink href="/login/global?role=parent" event="public_auth_signin">Parents</TrackedLink><Link href="/pathways">Future choices</Link><Link href="/pathways/schools">School discovery</Link><Link href="/contact">Get help</Link></div></div>
        <div><h2 className={styles.columnTitle}>VibeSchool</h2><div className={styles.linkList}><Link href="/about">About</Link><Link href="/institutions">Institutions & government</Link><Link href="/trust">Trust Centre</Link><Link href="/contact">Contact</Link><Link href="/careers">Careers</Link></div></div>
      </div>
      <div className={styles.footerBottom}><span>© 2026 VibeSchool · Kenya</span><div className={styles.legalLinks}><Link href="/trust">Trust</Link><Link href="/legal/privacy">Privacy</Link><Link href="/legal/terms">Terms</Link><Link href="/legal/aup">Acceptable Use</Link></div></div>
    </div>
  </footer>
}
