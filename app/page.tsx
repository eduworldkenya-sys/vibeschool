import Link from 'next/link'
import { PublicHeader } from '@/components/public/PublicHeader'
import { PublicFooter } from '@/components/public/PublicFooter'
import styles from './home.module.css'

const audiences = [
  { title: 'Learners', body: 'Learn, practise, understand your progress and explore what comes next.', href: '/global', action: 'Start learning' },
  { title: 'Teachers', body: 'Connect curriculum, planning, teaching, assessment and evidence around the work you already do.', href: '/login/teacher', action: 'For teachers' },
  { title: 'Parents', body: 'Understand the learning journey and support a child with clearer context.', href: '/login/parent', action: 'For parents' },
  { title: 'Schools', body: 'Bring people, learning activity and school operations into a more connected picture.', href: '/login/admin', action: 'For schools' },
]

const proof = [
  { number: '01', title: 'Learn', body: 'Explore curriculum-organised learning, resources, practice and assessment.' },
  { number: '02', title: 'Understand', body: 'Turn activity and evidence into a clearer picture of what a learner knows and needs next.' },
  { number: '03', title: 'Choose', body: 'Explore Senior School pathways, subject combinations, careers and schools with evidence boundaries made visible.' },
  { number: '04', title: 'Support', body: 'Give teachers, parents and institutions the context they need without collapsing everyone into the same role.' },
]

const trust = [
  ['Kenyan education context', 'Designed around the realities of learners, teachers, parents and schools in Kenya.'],
  ['Evidence before certainty', 'Guidance and verified education facts are kept distinct; uncertainty should be shown rather than hidden.'],
  ['Human responsibility', 'Technology and AI can assist, but important educational decisions still need appropriate human judgement.'],
  ['Privacy by role', 'Access to learner and school information is intended to follow the user’s authorised relationship and purpose.'],
]

export default function HomePage() {
  return <div className={styles.page}>
    <PublicHeader />
    <main id="main-content">
      <section className={styles.hero}>
        <div className={styles.heroInner}>
          <p className={styles.eyebrow}>VIBESCHOOL · KENYA</p>
          <h1>Learn today. Understand where you’re going tomorrow.</h1>
          <p className={styles.lead}>VibeSchool connects learning, teaching, evidence, pathways and the people supporting a learner — so education feels less fragmented and the next step is easier to understand.</p>
          <div className={styles.actions}>
            <Link className={styles.primary} href="/global">Start learning</Link>
            <Link className={styles.secondary} href="/pathways">Explore Pathways</Link>
            <Link className={styles.textAction} href="/login/teacher">I’m a teacher →</Link>
          </div>
          <div className={styles.heroTrust} aria-label="VibeSchool trust signals">
            <span>Explore before login</span><span>Built for Kenya</span><span>Guidance explains its limits</span><span>Mobile-first</span>
          </div>
        </div>
      </section>

      <section className={styles.audienceSection}>
        <div className={styles.sectionHeading}>
          <p className={styles.eyebrowDark}>START WITH WHO YOU ARE</p>
          <h2>One platform. Different responsibilities.</h2>
          <p>A learner should not have to understand school administration. A parent should not see a teacher’s workspace. VibeSchool gives each person a clearer entry point while keeping the education journey connected.</p>
        </div>
        <div className={styles.audienceGrid}>{audiences.map(item => <article key={item.title} className={styles.audienceCard}>
          <h3>{item.title}</h3><p>{item.body}</p><Link href={item.href}>{item.action} →</Link>
        </article>)}</div>
      </section>

      <section className={styles.productProof}>
        <div className={styles.proofIntro}>
          <p className={styles.eyebrowLight}>WHAT VIBESCHOOL ACTUALLY DOES</p>
          <h2>Not another pile of education features.</h2>
          <p>VibeSchool is being built around a connected journey: curriculum becomes learning, learning creates evidence, evidence improves understanding, and that understanding supports better choices.</p>
        </div>
        <div className={styles.proofGrid}>{proof.map(item => <div key={item.title} className={styles.proofCard}>
          <span>{item.number}</span><h3>{item.title}</h3><p>{item.body}</p>
        </div>)}</div>
        <div className={styles.systemLine} aria-label="VibeSchool connected education journey">
          <span>Curriculum</span><b>→</b><span>Learning</span><b>→</b><span>Evidence</span><b>→</b><span>Understanding</span><b>→</b><span>Pathways</span><b>→</b><span>Next step</span>
        </div>
      </section>

      <section className={styles.demoSection}>
        <div className={styles.sectionHeading}>
          <p className={styles.eyebrowDark}>SEE THE PRODUCT WITHOUT AN ACCOUNT</p>
          <h2>Understand VibeSchool before you sign in.</h2>
          <p>Public exploration should show enough real product depth for a learner, parent, school, government visitor or investor to understand what is being built without exposing private user information.</p>
        </div>
        <div className={styles.demoGrid}>
          <Link href="/pathways" className={styles.demoCard}>
            <span className={styles.demoLabel}>PATHWAYS</span><h3>From interests to subjects, careers and schools.</h3><p>Start with a short check, compare directions and see where verified information begins and ends.</p><strong>Explore Pathways →</strong>
          </Link>
          <Link href="/global" className={styles.demoCard}>
            <span className={styles.demoLabel}>LEARNING</span><h3>Move from finding content to knowing what to do next.</h3><p>Explore the public learning experience and see how resources fit into the wider learning journey.</p><strong>Explore learning →</strong>
          </Link>
          <Link href="/about" className={styles.demoCard}>
            <span className={styles.demoLabel}>THE SYSTEM</span><h3>See why the pieces are connected.</h3><p>Understand the product model, responsibilities, evidence philosophy and long-term education operating system.</p><strong>How VibeSchool works →</strong>
          </Link>
        </div>
      </section>

      <section className={styles.trustSection}>
        <div className={styles.sectionHeading}>
          <p className={styles.eyebrowDark}>WHY TRUST MATTERS</p>
          <h2>Education software should explain itself.</h2>
          <p>Trust is not a badge in the footer. It comes from showing what is known, what is guidance, who can access what, and where a person can ask for help.</p>
        </div>
        <div className={styles.trustGrid}>{trust.map(([title, body]) => <article key={title}><h3>{title}</h3><p>{body}</p></article>)}</div>
        <div className={styles.trustLinks}><Link href="/legal">Trust & policies</Link><Link href="/contact">Contact VibeSchool</Link><Link href="/careers">Careers</Link></div>
      </section>

      <section className={styles.institutionSection}>
        <div>
          <p className={styles.eyebrowLight}>FOR SCHOOLS, INSTITUTIONS & PUBLIC-SECTOR PARTNERS</p>
          <h2>Need the deeper picture?</h2>
        </div>
        <div><p>VibeSchool is designed to serve individuals without losing the institutional requirements around curriculum, evidence, access, accountability and school context. If you are evaluating VibeSchool for a school, organisation, government programme or partnership, start with the product and then talk to us about the specific need.</p><div className={styles.actions}><Link className={styles.primaryLight} href="/about">Understand the platform</Link><Link className={styles.secondaryLight} href="/contact">Talk to VibeSchool</Link></div></div>
      </section>
    </main>
    <PublicFooter />
  </div>
}
