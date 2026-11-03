import Link from 'next/link'
import styles from '@/components/vibetutor/VibeTutor.module.css'

export default function VibeTutorHome() {
  return (
    <>
      <section className={styles.hero}>
        <p className={styles.eyebrow}>VibeTutor · Holiday season</p>
        <h1 className={styles.title}>Find a tutor, or find students</h1>
        <p className={styles.lead}>
          Connect with tutors and learners for holiday tuition, online or in person.
        </p>
      </section>
      <div className={styles.paths}>
        <Link href="/vibetutor/find-tutor" className={styles.card}>
          <h2 className={styles.cardTitle}>I need a tutor</h2>
          <p className={styles.cardText}>Search tutors by subject, level, area and online or in-person.</p>
        </Link>
        <Link href="/vibetutor/find-students" className={styles.card}>
          <h2 className={styles.cardTitle}>I am a tutor</h2>
          <p className={styles.cardText}>Browse learners who need tuition and offer your services.</p>
        </Link>
      </div>
      <div className={styles.notice}>
        Listings shown here are samples while VibeTutor is being built. Nothing you enter is saved yet.
      </div>
      <p className={styles.cardText}>
        <Link href="/vibetutor/post-request" className={styles.back}>Post a tuition request</Link>
        {' · '}
        <Link href="/vibetutor/become-tutor" className={styles.back}>Register as a tutor</Link>
      </p>
    </>
  )
}
