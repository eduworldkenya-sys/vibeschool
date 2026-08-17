import type { Metadata } from 'next'
import Link from 'next/link'
import { PublicHeader } from '@/components/public/PublicHeader'
import { PublicFooter } from '@/components/public/PublicFooter'
import { TrackedLink } from '@/components/public/TrackedLink'
import { ProductTour } from '@/components/public/ProductTour'
import styles from './home.module.css'

export const metadata: Metadata = {
  alternates:{canonical:'/'},
  title:'VibeSchool — One learning system from curriculum to the next step',
  description:'VibeSchool connects curriculum, teaching, learning evidence, assessment, progress, parents, schools and Senior School Pathways in one Kenyan education system.',
}

const audiences = [
  { title: 'Learners', body: 'Learn, practise, use the learning library, understand your progress and explore the choices ahead.', href: '/global', action: 'Start learning' },
  { title: 'Teachers', body: 'Move from curriculum and planning to teaching, assessment, evidence and the learner’s next action.', href: '/product', action: 'See the teacher system' },
  { title: 'Parents', body: 'Follow the learning story with clearer progress, context and communication around the child you support.', href: '/product', action: 'See the parent experience' },
  { title: 'Schools', body: 'Connect academics, people, evidence and school operations without losing sight of the learner.', href: '/institutions', action: 'Explore VibeSchool for schools' },
]

const proof = [
  { number: '01', title: 'Plan & teach', body: 'Connect curriculum, schemes, lesson planning and classroom activity instead of treating them as separate paperwork.' },
  { number: '02', title: 'Learn & practise', body: 'Give learners a curriculum-aware place for resources, practice, assessment and continuing learning.' },
  { number: '03', title: 'Prove & understand', body: 'Turn evidence and assessment into a clearer view of progress, mastery, gaps and what needs attention next.' },
  { number: '04', title: 'Choose what comes next', body: 'Use Pathways, subject combinations, careers and school information with evidence boundaries made visible.' },
]

const trust = [
  ['Built around Kenyan education', 'VibeSchool is designed for the real relationships between learners, teachers, parents, schools and Kenya’s changing education pathways.'],
  ['Evidence before claims', 'Educational guidance, verified facts and uncertainty are kept distinct so important decisions are not presented with false certainty.'],
  ['Privacy follows relationship', 'Learner and school information is intended to follow authorised roles, relationships and purpose rather than a single all-access account.'],
  ['Humans remain responsible', 'Technology can assist planning, learning and understanding, while consequential educational decisions remain appropriately human-led.'],
]

export default function HomePage() {
  return <div className={styles.page}>
    <PublicHeader />
    <main id="main-content">
      <section className={styles.hero}>
        <div className={styles.heroInner}>
          <p className={styles.eyebrow}>VIBESCHOOL · KENYA</p>
          <h1>One learning system. From curriculum to the learner’s next step.</h1>
          <p className={styles.lead}>VibeSchool connects planning, teaching, learning, evidence, assessment, progress, parents and future direction — so the education journey works as one continuous system instead of a collection of disconnected tools.</p>
          <div className={styles.actions}>
            <TrackedLink className={styles.primary} href="/global" event="public_home_start_learning">Start learning</TrackedLink>
            <a className={styles.secondary} href="#product-tour">See VibeSchool work</a>
            <TrackedLink className={styles.textAction} href="/institutions" event="public_home_institutions">For schools →</TrackedLink>
          </div>
          <div className={styles.heroTrust} aria-label="VibeSchool trust signals">
            <span>Built for Kenya</span><span>CBC / CBE aware</span><span>Explore before login</span><span>Mobile-first</span><span>Role-based privacy</span>
          </div>
        </div>
      </section>

      <div id="product-tour"><ProductTour /></div>

      <section className={styles.audienceSection}>
        <div className={styles.sectionHeading}>
          <p className={styles.eyebrowDark}>ONE SYSTEM · THE RIGHT VIEW FOR EACH PERSON</p>
          <h2>Learners, teachers, parents and schools stay connected without becoming the same user.</h2>
          <p>Each person gets the tools and context that match their responsibility while the learning journey remains connected underneath.</p>
        </div>
        <div className={styles.audienceGrid}>{audiences.map(item => <article key={item.title} className={styles.audienceCard}>
          <h3>{item.title}</h3><p>{item.body}</p><Link href={item.href}>{item.action} →</Link>
        </article>)}</div>
      </section>

      <section className={styles.productProof}>
        <div className={styles.proofIntro}>
          <p className={styles.eyebrowLight}>THE VIBESCHOOL DIFFERENCE</p>
          <h2>The lesson, the evidence and the next action should belong to the same story.</h2>
          <p>VibeSchool is organised around educational continuity: curriculum informs planning, teaching creates learning activity, evidence improves understanding, and that understanding should shape what happens next.</p>
        </div>
        <div className={styles.proofGrid}>{proof.map(item => <div key={item.title} className={styles.proofCard}>
          <span>{item.number}</span><h3>{item.title}</h3><p>{item.body}</p>
        </div>)}</div>
        <div className={styles.systemLine} aria-label="VibeSchool connected education journey">
          <span>Curriculum</span><b>→</b><span>Scheme</span><b>→</b><span>Lesson</span><b>→</b><span>Learning</span><b>→</b><span>Evidence</span><b>→</b><span>Assessment</span><b>→</b><span>Understanding</span><b>→</b><span>Next action</span>
        </div>
      </section>

      <section className={styles.demoSection}>
        <div className={styles.sectionHeading}>
          <p className={styles.eyebrowDark}>EXPLORE VIBESCHOOL</p>
          <h2>See the educational model before deciding whether it belongs in your school or family.</h2>
          <p>Start with the product map, public learning and Pathways experiences, then inspect how VibeSchool approaches institutions, evidence, privacy and responsibility.</p>
        </div>
        <div className={styles.demoGrid}>
          <Link href="/product" className={styles.demoCard}>
            <span className={styles.demoLabel}>PRODUCT</span><h3>See how the system connects across every role.</h3><p>Explore teacher, learner, parent and school capabilities together, and see how the learning chain connects curriculum to the next action.</p><strong>See the product →</strong>
          </Link>
          <TrackedLink href="/global" event="public_home_start_learning" className={styles.demoCard}>
            <span className={styles.demoLabel}>LEARNING</span><h3>Learning that continues beyond a single resource.</h3><p>Explore curriculum-organised learning and how resources, practice and progress fit into the wider learner journey.</p><strong>Explore learning →</strong>
          </TrackedLink>
          <TrackedLink href="/pathways" event="public_home_pathways" className={styles.demoCard}>
            <span className={styles.demoLabel}>SENIOR SCHOOL PATHWAYS</span><h3>Move from interests to subjects, careers and schools with clearer evidence.</h3><p>Explore pathways and subject choices while seeing where verified information begins, where guidance is used and where uncertainty remains.</p><strong>Explore Pathways →</strong>
          </TrackedLink>
        </div>
      </section>

      <section className={styles.trustSection}>
        <div className={styles.sectionHeading}>
          <p className={styles.eyebrowDark}>TRUST IS PART OF THE PRODUCT</p>
          <h2>Education software should be useful enough to rely on and clear enough to question.</h2>
          <p>VibeSchool treats evidence, access, child safety, uncertainty and human responsibility as product requirements — not footer decoration.</p>
        </div>
        <div className={styles.trustGrid}>{trust.map(([title, body]) => <article key={title}><h3>{title}</h3><p>{body}</p></article>)}</div>
        <div className={styles.trustLinks}><Link href="/trust">Trust Centre</Link><Link href="/about">How VibeSchool works</Link><Link href="/contact">Contact VibeSchool</Link></div>
      </section>

      <section className={styles.institutionSection}>
        <div><p className={styles.eyebrowLight}>FOR SCHOOLS & EDUCATION INSTITUTIONS</p><h2>Run the institution. Understand the learning.</h2></div>
        <div><p>School software should do more than digitise administration. VibeSchool is designed to connect institutional operations with curriculum, teaching, assessment, learner evidence, parent context and future direction while preserving role boundaries and accountability.</p><div className={styles.actions}><Link className={styles.primaryLight} href="/institutions">Explore VibeSchool for institutions</Link><TrackedLink className={styles.secondaryLight} href="/contact" event="public_institution_contact">Talk to VibeSchool</TrackedLink></div></div>
      </section>
    </main>
    <PublicFooter />
  </div>
}