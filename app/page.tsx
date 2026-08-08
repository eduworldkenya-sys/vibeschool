import Link from 'next/link'
import styles from './home.module.css'

const paths = [
  {
    label: 'Learn',
    description: 'Study, practise and know what to do next.',
    href: '/global',
  },
  {
    label: 'Teach',
    description: 'Plan, teach and understand every class.',
    href: '/auth',
  },
] as const

export default function HomePage() {
  return (
    <main className={styles.shell}>
      <header className={styles.header}>
        <Link className={styles.wordmark} href="/" aria-label="Vibeschool home">
          Vibe<span>school</span>
        </Link>
        <Link className={styles.signIn} href="/auth">Sign in</Link>
      </header>

      <section className={styles.hero} aria-labelledby="home-title">
        <p className={styles.kicker}>Vibeschool</p>
        <h1 id="home-title">School, connected.</h1>
        <p className={styles.lede}>Learn. Teach. Know what comes next.</p>

        <div className={styles.actions} aria-label="Choose how to use Vibeschool">
          {paths.map((path) => (
            <Link key={path.label} href={path.href} className={styles.actionCard}>
              <span className={styles.actionTitle}>{path.label}</span>
              <span className={styles.actionDescription}>{path.description}</span>
              <span className={styles.actionArrow} aria-hidden="true">→</span>
            </Link>
          ))}
        </div>
      </section>

      <footer className={styles.footer}>
        <nav aria-label="Vibeschool information">
          <Link href="/about">About</Link>
          <Link href="/contact">Contact</Link>
          <Link href="/legal/privacy">Privacy</Link>
          <Link href="/legal/terms">Terms</Link>
        </nav>
        <span>Vibeschool</span>
      </footer>
    </main>
  )
}
