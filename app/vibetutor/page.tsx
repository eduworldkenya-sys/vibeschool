import Link from 'next/link'
import styles from '@/components/vibetutor/VibeTutor.module.css'
import Icon from '@/components/vibetutor/Icon'
import { TutorCard } from '@/components/vibetutor/Cards'
import { DEMO_TUTORS } from '@/components/vibetutor/data'

export default function VibeTutorHome() {
  return (
    <>
      <section className={styles.hero}>
        <p className={styles.eyebrow}>Holiday tuition</p>
        <h1 className={styles.h1}>Find the right tutor this holiday</h1>
        <p className={styles.lead}>Browse tutors and learners who need help, online or in person, for the weeks you are off school.</p>
        <div className={styles.ctaRow}>
          <Link href="/vibetutor/browse" className={`${styles.btn} ${styles.btnPrimary}`}>Browse tutors <Icon name="arrow" size={16} /></Link>
          <Link href="/vibetutor/post-request" className={`${styles.btn} ${styles.btnSecondary}`}>Post a request</Link>
        </div>
      </section>

      <section className={styles.section} aria-labelledby="how">
        <h2 id="how" className={styles.sectionTitle}>How it works</h2>
        <div className={styles.grid3}>
          <div className={styles.stepCard}>
            <span className={styles.stepN}>1</span>
            <p className={styles.stepCardTitle}>Browse or post</p>
            <p className={styles.stepCardText}>Search tutors by subject, level and area, or post what you need.</p>
          </div>
          <div className={styles.stepCard}>
            <span className={styles.stepN}>2</span>
            <p className={styles.stepCardTitle}>Choose a format</p>
            <p className={styles.stepCardText}>Pick online, in person, or either, and a schedule that fits the holiday.</p>
          </div>
          <div className={styles.stepCard}>
            <span className={styles.stepN}>3</span>
            <p className={styles.stepCardTitle}>Start learning</p>
            <p className={styles.stepCardText}>Agree the details directly. Contact details stay private until you do.</p>
          </div>
        </div>
      </section>

      <section className={styles.section} aria-labelledby="featured">
        <div className={styles.pageHead}>
          <h2 id="featured" className={styles.sectionTitle}>Example tutors</h2>
          <Link href="/vibetutor/browse" className={styles.clear}>See all</Link>
        </div>
        <div className={styles.list}>
          {DEMO_TUTORS.slice(0, 3).map(t => <TutorCard key={t.id} t={t} />)}
        </div>
      </section>

      <section className={styles.section} aria-labelledby="paths">
        <h2 id="paths" className={styles.sectionTitle}>Get started</h2>
        <div className={styles.paths}>
          <Link href="/vibetutor/browse" className={styles.pathCard}>
            <p className={styles.pathTitle}>I need a tutor</p>
            <p className={styles.stepCardText}>Find tutors with the subject, level and schedule you need.</p>
            <span className={styles.pathArrow}>Browse tutors <Icon name="arrow" size={16} /></span>
          </Link>
          <Link href="/vibetutor/become-tutor" className={styles.pathCard}>
            <p className={styles.pathTitle}>I want to teach</p>
            <p className={styles.stepCardText}>Create a tutor profile and offer your time over the holidays.</p>
            <span className={styles.pathArrow}>Create profile <Icon name="arrow" size={16} /></span>
          </Link>
        </div>
      </section>

      <p className={styles.notice} style={{ marginTop: 40 }}>
        Demo data only. Listings and ratings on this page are fictional and shown to preview the layout. Sign-up and messaging are not live yet.
      </p>
    </>
  )
}
