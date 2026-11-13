import type { Metadata } from 'next'
import Link from 'next/link'
import { PublicHeader } from '@/components/public/PublicHeader'
import { PublicFooter } from '@/components/public/PublicFooter'
import { TrackedLink } from '@/components/public/TrackedLink'
import { ProductTour } from '@/components/public/ProductTour'
import { SchoolReadinessAssessment } from '@/components/public/SchoolReadinessAssessment'
import { RoleJourneySelector } from '@/components/public/RoleJourneySelector'
import { ConnectedEducationExplorer } from '@/components/public/ConnectedEducationExplorer'
import styles from './home.module.css'
import SuccessWishesFloatingOffer from '@/components/success-wishes/SuccessWishesFloatingOffer'

export const metadata: Metadata = {
  alternates: { canonical: '/' },
  title: 'VibeSchool — Your connected workspace for teaching and learning',
  description: 'Plan, teach, assess and follow learner progress in one connected workspace built for Kenyan education.',
}

const schoolDay = [
  ['07:30', 'Prepare with context', 'Start from the curriculum, scheme and class context already connected to the lesson.'],
  ['08:00', 'Teach the planned lesson', 'Carry the learning intention into the real classroom occurrence.'],
  ['10:15', 'Capture learner evidence', 'Practice, homework and submissions give the teacher something meaningful to review.'],
  ['13:00', 'Respond to what learners show', 'Use assessment and evidence to identify where explanation, practice or support may be needed.'],
  ['16:00', 'Share the right progress', 'Authorised families can understand relevant progress without entering the teacher’s private workspace.'],
  ['17:00', 'Keep the learning story connected', 'School visibility can connect curriculum, teaching, participation and progress.'],
]

const trust = [
  ['Built around Kenyan education', 'Designed for the real relationships between learners, teachers, parents, schools and Kenya’s changing education pathways.'],
  ['Evidence before claims', 'Verified facts, educational guidance and uncertainty are kept distinct.'],
  ['Privacy follows relationship', 'Learner and school information follows authorised roles, relationships and purpose.'],
  ['Humans remain responsible', 'Technology can assist learning and planning while consequential educational decisions remain appropriately human-led.'],
]

export default function HomePage() {
  return <div className={styles.page} >
    <PublicHeader />
    <SuccessWishesFloatingOffer homepage />
    <main id="main-content">
      <section className={styles.hero}>
        <div className={styles.heroInner}>
          <p className={styles.eyebrow}>VIBESCHOOL · BUILT FOR KENYAN EDUCATION</p>
          <h1>Teach better. Plan less. Know what comes next.</h1>
          <p className={styles.lead}>One connected workspace for curriculum planning, teaching, assessment and learner progress — built around the work teachers do every day.</p>
          <div className={styles.actions}>
            <TrackedLink className={styles.primary} href="/sandbox" event="public_home_start_learning">Explore the live sandbox</TrackedLink>
            <Link className={styles.secondary} href="/product">See how VibeSchool works</Link>
          </div>
          <div className={styles.heroTrust}>
            <span>Kenyan curriculum context</span><span>Teacher-first</span><span>Connected learning journey</span><span>Role-based privacy</span>
          </div>
          <div className={styles.heroNote}>
            <span className={styles.heroNoteLabel}>THE TEACHING JOURNEY</span>
            <strong>Curriculum <i>→</i> Scheme <i>→</i> Lesson <i>→</i> Teach <i>→</i> Evidence <i>→</i> Next action</strong>
          </div>
        </div>
      </section>

      <div id="product-tour"><ProductTour /></div>
      <RoleJourneySelector />
      <ConnectedEducationExplorer />

      <section className={styles.demoSection}>
        <div className={styles.sectionHeading}>
          <p className={styles.eyebrowDark}>GET TO KNOW VIBESCHOOL</p>
          <h2>Explore the product. See what it can help you do.</h2>
          <p>Start with a practical demonstration, explore learning and discover how VibeSchool supports different parts of the education journey.</p>
        </div>
        <div className={styles.demoGrid}>
          <Link href="/sandbox" className={styles.demoCard}><span className={styles.demoLabel}>LIVE SANDBOX</span><h3>Run one lesson from plan to next action.</h3><p>Use safe demo data to plan, teach, capture evidence, assess what the evidence supports and see the next step.</p><strong>Explore the sandbox →</strong></Link>
          <TrackedLink href="/learn" event="public_home_start_learning" className={styles.demoCard}><span className={styles.demoLabel}>LEARNING</span><h3>Learning that continues beyond one resource.</h3><p>Explore curriculum-organised learning and how resources, practice and progress fit into the wider learner journey.</p><strong>Explore learning →</strong></TrackedLink>
          <TrackedLink href="/pathways" event="public_home_pathways" className={styles.demoCard}><span className={styles.demoLabel}>SENIOR SCHOOL PATHWAYS</span><h3>Make future choices with clearer information.</h3><p>Explore subjects, careers and schools while distinguishing verified information from guidance and uncertainty.</p><strong>Explore Pathways →</strong></TrackedLink>
        </div>
      </section>

      <section className={styles.wishesPromo} aria-labelledby="wishes-promo-title">
        <div className={styles.wishesPromoCopy}>
          <p className={styles.wishesPromoEyebrow}>VIBESCHOOL · SUCCESS WISHES</p>
          <h2 id="wishes-promo-title">A little encouragement can mean everything.</h2>
          <p>Choose a digital success card, write your message and send a private wish to someone preparing for exams.</p>
          <Link href="/success-wishes" className={styles.wishesPromoLink}>Explore Digital Success Cards <span aria-hidden="true">→</span></Link>
        </div>
        <div className={styles.wishesPromoArtwork} aria-hidden="true"><span>WITH LOVE</span><strong>You’ve got this.</strong><small>GOOD LUCK &amp; SUCCESS</small></div>
      </section>

      <section className={styles.daySection} aria-labelledby="school-day-title">
        <div className={styles.dayIntro}><p className={styles.eyebrowDark}>A DAY WITH VIBESCHOOL</p><h2>Keep the learning story connected throughout the school day.</h2><p>The value is not a collection of separate modules. It is the continuity from planning to teaching, evidence and support.</p></div>
        <ol className={styles.dayTimeline}>{schoolDay.map(([time,title,body]) => <li key={time}><time>{time}</time><div><h3>{title}</h3><p>{body}</p></div></li>)}</ol>
      </section>

      <SchoolReadinessAssessment />

      <section className={styles.trustSection}>
        <div className={styles.sectionHeading}><p className={styles.eyebrowDark}>TRUST IS PART OF THE PRODUCT</p><h2>Useful enough to rely on. Clear enough to question.</h2><p>Evidence, access, child safety, uncertainty and human responsibility are product requirements — not footer decoration.</p></div>
        <div className={styles.trustGrid}>{trust.map(([title,body]) => <article key={title}><h3>{title}</h3><p>{body}</p></article>)}</div>
        <div className={styles.trustLinks}><Link href="/product">Product map</Link><Link href="/trust">Trust Centre</Link><Link href="/about">Mission &amp; how VibeSchool works</Link><Link href="/contact">Contact VibeSchool</Link></div>
      </section>

      <section className={styles.institutionSection}>
        <div><p className={styles.eyebrowLight}>FOR SCHOOLS &amp; EDUCATION INSTITUTIONS</p><h2>Run the institution. Understand the learning.</h2></div>
        <div><p>Connect institutional operations with curriculum, teaching, assessment, learner evidence and family context while preserving role boundaries and accountability.</p><div className={styles.actions}><Link className={styles.primaryLight} href="/institutions">Explore VibeSchool for institutions</Link><TrackedLink className={styles.secondaryLight} href="/contact" event="public_institution_contact">Talk to VibeSchool</TrackedLink></div></div>
      </section>
    </main>
    <PublicFooter />
  </div>
}
