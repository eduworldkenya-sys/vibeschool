import Link from 'next/link'
import styles from '../public-info.module.css'

export default function AboutPage() {
  return (
    <main className={styles.shell}>
      <header className={styles.header}>
        <Link className={styles.wordmark} href="/">Vibe<span>school</span></Link>
        <Link className={styles.action} href="/auth">Sign in</Link>
      </header>

      <article className={styles.content}>
        <p className={styles.kicker}>About</p>
        <h1>Teaching and learning, connected.</h1>
        <p className={styles.lede}>
          Vibeschool connects curriculum, teaching, learning and evidence so teachers and learners can see what matters next.
        </p>

        <div className={styles.grid}>
          <section>
            <h2>For learners</h2>
            <p>Learn, practise, complete assigned work and understand progress in one place.</p>
          </section>
          <section>
            <h2>For teachers</h2>
            <p>Plan from the curriculum, teach, assess and use classroom evidence without breaking the workflow.</p>
          </section>
        </div>
      </article>

      <footer className={styles.footer}>
        <Link href="/">Home</Link>
        <Link href="/contact">Contact</Link>
        <Link href="/legal/privacy">Privacy</Link>
        <Link href="/legal/terms">Terms</Link>
      </footer>
    </main>
  )
}
