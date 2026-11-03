import type { Metadata } from 'next'
import Link from 'next/link'
import Nav from '@/components/vibetutor/Nav'
import styles from '@/components/vibetutor/VibeTutor.module.css'

export const metadata: Metadata = {
  title: { absolute: 'VibeTutor | Holiday tuition in Kenya' },
  description: 'Find a tutor or find students for holiday tuition, online or in person.',
}

function Footer() {
  return (
    <footer className={styles.footer}>
      <div className={styles.footerInner}>
        <div className={styles.footerBrand}>
          <strong>VibeTutor</strong>
          <p>Find the right support for learning.</p>
        </div>
        <nav className={styles.footerLinks} aria-label="Footer">
          <Link href="/vibetutor">Find a tutor</Link>
          <Link href="/vibetutor/post-request">Find tuition</Link>
          <Link href="/vibetutor/become-tutor">Become a tutor</Link>
          <Link href="/login">Sign in</Link>
        </nav>
        <p className={styles.footerNote}>Keep lesson arrangements safe. Parents and guardians should oversee tuition arrangements for learners under 18.</p>
        <div className={styles.footerBottom}>© {new Date().getFullYear()} VibeSchool · VibeTutor</div>
      </div>
    </footer>
  )
}

export default function VibeTutorLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={styles.shell}>
      <Nav />
      <main className={styles.page}>{children}</main>
      <Footer />
    </div>
  )
}
