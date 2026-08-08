import Link from 'next/link'
import styles from '../public-info.module.css'

export default function ContactPage() {
  return (
    <main className={styles.shell}>
      <header className={styles.header}>
        <Link className={styles.wordmark} href="/">Vibe<span>school</span></Link>
        <Link className={styles.action} href="/auth">Sign in</Link>
      </header>

      <article className={styles.content}>
        <p className={styles.kicker}>Contact</p>
        <h1>Talk to Vibeschool.</h1>
        <p className={styles.lede}>Questions about learning, teaching, schools, partnerships or support.</p>

        <a className={styles.contactCard} href="mailto:eduworldkenya@gmail.com">
          <span>Email</span>
          <strong>eduworldkenya@gmail.com</strong>
          <span aria-hidden="true">→</span>
        </a>
      </article>

      <footer className={styles.footer}>
        <Link href="/">Home</Link>
        <Link href="/about">About</Link>
        <Link href="/legal/privacy">Privacy</Link>
        <Link href="/legal/terms">Terms</Link>
      </footer>
    </main>
  )
}
