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
        <h1 className={styles.formTitle}>Holiday tuition, made easier to find</h1>
        <p className={styles.lead}>
          VibeTutor is being built to help learners and parents find tutors for online or in-person holiday tuition.
        </p>
      </header>

      <section className={styles.infoBlock} aria-labelledby="free">
        <h2 id="free" className={styles.sectionTitle}>No platform fee</h2>
        <p className={styles.infoText}>
          Browsing is free. The intended service has no fee for posting a request or creating a tutor profile, and VibeTutor does not take a cut of the lesson price.
        </p>
      </section>

      <section className={styles.infoBlock} aria-labelledby="learners">
        <h2 id="learners" className={styles.sectionTitle}>For learners and parents</h2>
        <ol className={styles.infoList}>
          <li>Use <Link href="/vibetutor/post-request" className={styles.clear}>Learn</Link> to preview the details a tuition request will ask for: subjects, level, format, area and availability.</li>
          <li>When request publishing is available, tutors will be able to discover requests that match their subjects and schedule.</li>
          <li>Before any lesson is arranged, both sides should agree on the tutor, date, time, format and location.</li>
        </ol>
      </section>

      <section className={styles.infoBlock} aria-labelledby="tutors">
        <h2 id="tutors" className={styles.sectionTitle}>For tutors</h2>
        <ol className={styles.infoList}>
          <li>Use <Link href="/vibetutor/become-tutor" className={styles.clear}>Teach</Link> to preview the profile details: subjects, levels, area, rate and holiday availability.</li>
          <li>When tutor profiles and requests are live, learners will be able to search for suitable tutors and tutors will be able to respond to matching requests.</li>
          <li>Bookings should proceed only after the tutor and parent or learner mutually confirm the arrangements.</li>
        </ol>
      </section>

      <section className={styles.infoBlock} aria-labelledby="formats">
        <h2 id="formats" className={styles.sectionTitle}>Online or in person</h2>
        <div className={styles.infoGrid}>
          <div className={styles.infoCard}>
            <Icon name="home" size={20} />
            <p className={styles.cardTitle}>Online</p>
            <p className={styles.meta}>Lessons conducted remotely.</p>
          </div>
          <div className={styles.infoCard}>
            <Icon name="pin" size={20} />
            <p className={styles.cardTitle}>In person</p>
            <p className={styles.meta}>A location agreed by the tutor and parent or learner.</p>
          </div>
        </div>
      </section>

      <section className={styles.infoBlock} aria-labelledby="safety">
        <h2 id="safety" className={styles.sectionTitle}>Safety</h2>
        <p className={styles.infoText}>
          For learners under 18, a parent or guardian must lead contact and arrangements. Do not publish a child's phone number, home address or other private contact details.
        </p>
        <p className={styles.notice}>Tutor identity and safeguarding checks, and the process for arranging in-person lessons for minors, must be established before live matching and bookings are opened. No verification is claimed at this preview stage.</p>
      </section>

      <section className={styles.infoBlock} aria-labelledby="status">
        <h2 id="status" className={styles.sectionTitle}>Current status</h2>
        <p className={styles.infoText}>
          This is a front-end preview. Listings are illustrative examples. The forms do not save or publish information, and matching, messaging and booking are not active yet.
        </p>
      </section>

      <p className={styles.notice}>Nothing entered in these forms is saved. Sign-in is required for actions that will be enabled through VibeSchool.</p>
    </article>
  )
}
