import Link from 'next/link'
import styles from '@/components/vibetutor/VibeTutor.module.css'
import Icon from '@/components/vibetutor/Icon'

export const metadata = {
  title: 'How VibeTutor works',
}

export default function HowItWorks() {
  return (
    <article className={styles.formWrap}>
      <header className={styles.formHead}>
        <p className={styles.eyebrow}>About VibeTutor</p>
        <h1 className={styles.formTitle}>Holiday tuition, matched</h1>
        <p className={styles.lead}>
          VibeTutor links learners who need extra help with tutors who can teach them, online or in person, during the school holidays.
        </p>
      </header>

      <section className={styles.infoBlock} aria-labelledby="free">
        <h2 id="free" className={styles.sectionTitle}>No fee</h2>
        <p className={styles.infoText}>
          There is no fee to post a request, create a tutor profile, or browse. VibeTutor does not take a cut of the agreed price.
        </p>
      </section>

      <section className={styles.infoBlock} aria-labelledby="learners">
        <h2 id="learners" className={styles.sectionTitle}>For learners and parents</h2>
        <ol className={styles.infoList}>
          <li>Go to <Link href="/vibetutor/post-request" className={styles.clear}>Learn</Link> and describe what you need: subjects, level, format, and times.</li>
          <li>Tutors who match can see your request.</li>
          <li>Agree the details together. Your phone number stays private until you choose to share it.</li>
        </ol>
      </section>

      <section className={styles.infoBlock} aria-labelledby="tutors">
        <h2 id="tutors" className={styles.sectionTitle}>For tutors</h2>
        <ol className={styles.infoList}>
          <li>Create a profile on <Link href="/vibetutor/become-tutor" className={styles.clear}>Teach</Link> with your subjects, levels, area, rate and holiday availability.</li>
          <li>Learners search by subject, level, area, format and time of day.</li>
          <li>Reply to requests that fit your timetable.</li>
        </ol>
      </section>

      <section className={styles.infoBlock} aria-labelledby="formats">
        <h2 id="formats" className={styles.sectionTitle}>Online or in person</h2>
        <div className={styles.infoGrid}>
          <div className={styles.infoCard}>
            <Icon name="home" size={20} />
            <p className={styles.cardTitle}>Online</p>
            <p className={styles.meta}>Video lessons from home, from anywhere.</p>
          </div>
          <div className={styles.infoCard}>
            <Icon name="pin" size={20} />
            <p className={styles.cardTitle}>In person</p>
            <p className={styles.meta}>Lessons in the tutor&apos;s area or a place you agree on.</p>
          </div>
        </div>
      </section>

      <section className={styles.infoBlock} aria-labelledby="safety">
        <h2 id="safety" className={styles.sectionTitle}>Safety</h2>
        <p className={styles.infoText}>
          Learners under 18 are requested by a parent or guardian. Tutors who work with children are asked to confirm their identity and good conduct.
        </p>
        <p className={styles.notice}>To confirm before launch: the exact identity and background checks, and how in-person lessons are arranged for under-18s.</p>
      </section>

      <section className={styles.infoBlock} aria-labelledby="status">
        <h2 id="status" className={styles.sectionTitle}>Current status</h2>
        <p className={styles.infoText}>
          This is a preview. Listings are demo data, and sign-up, messaging and publishing are not live yet.
        </p>
      </section>

      <p className={styles.notice}>Illustrative listings only. Nothing entered in these forms is saved yet.</p>
    </article>
  )
}
