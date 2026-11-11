import type { Metadata } from 'next'
import Link from 'next/link'
import { PublicHeader } from '@/components/public/PublicHeader'
import { PublicFooter } from '@/components/public/PublicFooter'
import styles from './Institutions.module.css'

export const metadata: Metadata = {
  alternates: { canonical: '/institutions' },
  title: 'VibeSchool for Schools | One connected school platform',
  description: 'Bring curriculum, schemes of work, lesson preparation, learner progress and school workflows together with VibeSchool for Kenyan schools.',
}

const capabilities = [
  {
    number: '01',
    title: 'Curriculum & schemes',
    description: 'Find curriculum requirements, organise teaching by strand and connect planning to schemes of work.',
    href: '/product',
    action: 'Explore curriculum workflows',
  },
  {
    number: '02',
    title: 'Teaching & lesson preparation',
    description: 'Prepare lessons and teaching resources in the same environment teachers use to manage their work.',
    href: '/teacher',
    action: 'Explore teacher tools',
  },
  {
    number: '03',
    title: 'Learning & assessment',
    description: 'Give learners a place to practise, complete assessments and review their learning.',
    href: '/global',
    action: 'Explore learning',
  },
  {
    number: '04',
    title: 'Classes & school records',
    description: 'Bring classes, timetables, attendance and staff responsibilities into a coordinated school workflow.',
    href: '/product',
    action: 'Explore the platform',
  },
  {
    number: '05',
    title: 'Families & learner progress',
    description: 'Connect the right people to relevant learning information while respecting account and relationship boundaries.',
    href: '/trust',
    action: 'How access works',
  },
  {
    number: '06',
    title: 'School profiles & pathways',
    description: 'Make school information discoverable and help learners explore subjects, schools and future choices.',
    href: '/schools',
    action: 'Find schools',
  },
]

const journey = [
  { number: '01', title: 'Curriculum', detail: 'Know what needs to be learned.' },
  { number: '02', title: 'Plan', detail: 'Organise schemes and prepare lessons.' },
  { number: '03', title: 'Teach', detail: 'Keep classroom work connected.' },
  { number: '04', title: 'Assess', detail: 'Check understanding and keep evidence.' },
  { number: '05', title: 'Improve', detail: 'Use progress to guide what comes next.' },
]

const roles = [
  { title: 'School leaders', description: 'Organise the school, understand teaching activity and see where attention is needed.' },
  { title: 'Teachers', description: 'Work from curriculum to schemes, lesson preparation and the classroom.' },
  { title: 'Learners', description: 'Access learning, practice and assessment through their own workspace.' },
  { title: 'Families', description: 'Stay connected to appropriate school and learner information as access is enabled.' },
]

const rollout = [
  { number: '01', title: 'Set up your school', description: 'Start with the institution, its classes and the people who need access.' },
  { number: '02', title: 'Give each person their workspace', description: 'Assign teachers, learners and school administrators the appropriate roles.' },
  { number: '03', title: 'Start teaching with VibeSchool', description: 'Choose your initial curriculum, teaching or assessment workflow and use it in your school.' },
  { number: '04', title: 'Grow your use of the platform', description: 'Add further workflows as your school is ready, with support and scope agreed in advance.' },
]

const faqs = [
  {
    question: 'Is VibeSchool built for the Kenyan curriculum?',
    answer: 'Yes. VibeSchool is built around the Kenyan CBC/CBE context, including curriculum structure, teaching and Senior School Pathways. Coverage differs across grades, subjects and tools, so we confirm the exact workflows a school needs before onboarding.',
  },
  {
    question: 'Can teachers use VibeSchool on their phones?',
    answer: 'VibeSchool includes mobile-focused experiences for teachers and learners. We recommend checking any workflow your school depends on using the devices and connectivity available to your staff.',
  },
  {
    question: 'Do we need to move every school process at once?',
    answer: 'No. You can begin with curriculum, teaching or assessment, then extend to other workflows without moving everything on day one.',
  },
  {
    question: 'Does VibeSchool work without internet?',
    answer: 'Some public experiences support offline resilience, but full offline use varies by feature. We will identify which functions need a connection when planning your school rollout.',
  },
  {
    question: 'How is learner information handled?',
    answer: 'Access is organised around roles and verified relationships. Visit the Trust Centre for how VibeSchool approaches learner protection, privacy and account security.',
  },
  {
    question: 'Can our school bring existing records?',
    answer: 'We can discuss the records you want to move, their format and their quality, then agree on a practical import scope. We do not assume every external system has a ready-made migration.',
  },
  {
    question: 'What does VibeSchool cost for a school?',
    answer: 'Institutional pricing depends on the number of users, workspaces selected and support required. Contact VibeSchool for a school-specific proposal.',
  },
  {
    question: 'What support can our school expect?',
    answer: 'Onboarding, support channels and any service-level commitments are agreed for the school’s arrangement. VibeSchool does not publish an invented support or uptime guarantee.',
  },
]

export default function InstitutionsPage() {
  return (
    <div className={styles.page}>
      <PublicHeader product="Schools" />
      <main id="main-content">
        <section className={styles.hero} aria-labelledby="schools-hero-title">
          <div className={[styles.container, styles.heroGrid].join(' ')}>
            <div className={styles.heroCopy}>
              <p className={styles.eyebrowLight}>VIBESCHOOL FOR SCHOOLS · KENYA</p>
              <h1 id="schools-hero-title">One school.<br /><span>Every learning journey connected.</span></h1>
              <p className={styles.heroLead}>Bring curriculum, schemes of work, lesson preparation, assessment and school activity into one place. Give your teachers the tools to teach and your school leaders a clearer view of learning.</p>
              <div className={styles.heroActions}>
                <Link className={styles.buttonGold} href="/contact">Talk to VibeSchool <span aria-hidden="true">↗</span></Link>
                <Link className={styles.buttonGhost} href="/product">Explore the platform <span aria-hidden="true">→</span></Link>
              </div>
              <div className={styles.heroSignals}>
                <span>Built for Kenyan schools</span>
                <span>Teacher & learner workspaces</span>
                <span>Role-aware access</span>
              </div>
            </div>
            <div className={styles.productFrame} aria-label="Illustration of a connected teaching and learning workflow">
              <div className={styles.frameTop}><span className={styles.frameDot} /><span>VibeSchool · Connected learning</span><span className={styles.frameMark}>VS</span></div>
              <div className={styles.frameBody}>
                <p className={styles.frameOverline}>YOUR SCHOOL WORKSPACE</p>
                <h2>Teaching and learning, connected.</h2>
                <p className={styles.frameDescription}>From curriculum direction to the next learning action.</p>
                <div className={styles.workflow}>
                  <div className={styles.workflowRow}><span className={styles.workflowIndex}>01</span><div><strong>Curriculum map</strong><small>Learning requirements</small></div><span className={styles.workflowTail}>→</span></div>
                  <div className={styles.workflowRow}><span className={styles.workflowIndex}>02</span><div><strong>Schemes & lesson preparation</strong><small>Teaching plan and resources</small></div><span className={styles.workflowTail}>→</span></div>
                  <div className={styles.workflowRow}><span className={styles.workflowIndex}>03</span><div><strong>Classroom learning</strong><small>Activities and assessment</small></div><span className={styles.workflowTail}>→</span></div>
                  <div className={styles.workflowRow}><span className={styles.workflowIndex}>04</span><div><strong>Learner progress</strong><small>Evidence and next steps</small></div><span className={styles.workflowTail}>✓</span></div>
                </div>
                <p className={styles.frameFootnote}>Illustrative workflow · Exact feature coverage varies</p>
              </div>
            </div>
          </div>
        </section>

        <section className={styles.section} aria-labelledby="schools-capabilities">
          <div className={styles.container}>
            <div className={styles.sectionHeading}>
              <div><p className={styles.eyebrow}>WHAT A SCHOOL CAN BRING TOGETHER</p><h2 id="schools-capabilities">Everything begins with better teaching and learning.</h2></div>
              <p>VibeSchool puts the tools used by schools, teachers and learners in one connected environment. Start with the work that matters most and build from there.</p>
            </div>
            <div className={styles.capabilityGrid}>
              {capabilities.map((item) => (
                <article className={styles.capabilityCard} key={item.title}>
                  <span className={styles.cardNumber}>{item.number}</span>
                  <h3>{item.title}</h3>
                  <p>{item.description}</p>
                  <Link href={item.href}>{item.action} <span aria-hidden="true">→</span></Link>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className={styles.learningSection} aria-labelledby="schools-journey">
          <div className={styles.container}>
            <p className={styles.eyebrow}>THE CONNECTED LEARNING CHAIN</p>
            <div className={styles.sectionHeading}>
              <h2 id="schools-journey">From what to teach to what the learner understands.</h2>
              <p>Planning, teaching and assessment should inform one another. VibeSchool is organised around this journey, not a collection of disconnected documents.</p>
            </div>
            <ol className={styles.journeyGrid}>
              {journey.map((step) => (
                <li className={styles.journeyItem} key={step.number}>
                  <span>{step.number}</span><h3>{step.title}</h3><p>{step.detail}</p>
                </li>
              ))}
            </ol>
            <Link className={styles.textLink} href="/product">See how the VibeSchool platform works <span aria-hidden="true">→</span></Link>
          </div>
        </section>

        <section className={styles.section} aria-labelledby="schools-roles">
          <div className={styles.container}>
            <div className={styles.sectionHeading}>
              <div><p className={styles.eyebrow}>ONE SCHOOL. DIFFERENT RESPONSIBILITIES.</p><h2 id="schools-roles">The right workspace for every role.</h2></div>
              <p>Each person works with the information relevant to them. School-wide visibility must not mean school-wide access to private learner records.</p>
            </div>
            <div className={styles.roleGrid}>
              {roles.map((role) => <article className={styles.roleCard} key={role.title}><h3>{role.title}</h3><p>{role.description}</p></article>)}
            </div>
          </div>
        </section>

        <section className={styles.rolloutSection} aria-labelledby="schools-rollout">
          <div className={styles.container}>
            <p className={styles.eyebrowLight}>IMPLEMENTATION PRINCIPLE</p>
            <div className={styles.sectionHeading}>
              <h2 id="schools-rollout">Bring VibeSchool into your school with confidence.</h2>
              <p>Adoption should be straightforward for your team. Begin with a clear school setup and put the relevant workspaces into use.</p>
            </div>
            <div className={styles.rolloutGrid}>
              {rollout.map((step) => <div className={styles.rolloutCard} key={step.number}><span>{step.number}</span><h3>{step.title}</h3><p>{step.description}</p></div>)}
            </div>
            <Link className={styles.buttonGold} href="/contact">Discuss school onboarding <span aria-hidden="true">↗</span></Link>
          </div>
        </section>

        <section className={styles.section} aria-labelledby="schools-considerations">
          <div className={[styles.container, styles.split].join(' ')}>
            <div><p className={styles.eyebrow}>BEFORE ADOPTION</p><h2 id="schools-considerations">Built for the realities of Kenyan schools.</h2><p className={styles.bodyLead}>Good software must work with real school days, real devices and clear responsibilities.</p></div>
            <div className={styles.benefits}>
              <div><h3>Practical on phones</h3><p>Teachers should be able to use essential workflows without needing a desktop computer.</p></div>
              <div><h3>Clear curriculum direction</h3><p>Learning requirements, preparation and assessment should remain connected and traceable.</p></div>
              <div><h3>Access with responsibility</h3><p>Protect learner information through role and relationship boundaries, not open school-wide access.</p></div>
              <div><h3>Choice in how you begin</h3><p>Introduce the tools your school needs without replacing every existing process immediately.</p></div>
              <Link className={styles.textLink} href="/trust">Read about safety, privacy and trust <span aria-hidden="true">→</span></Link>
            </div>
          </div>
        </section>

        <section className={styles.faqSection} aria-labelledby="schools-faq">
          <div className={styles.container}>
            <p className={styles.eyebrow}>QUESTIONS A SCHOOL SHOULD ASK BEFORE BUYING</p>
            <div className={styles.sectionHeading}><h2 id="schools-faq">What schools want to know.</h2><p>Clear answers about curriculum, mobile access, onboarding, information protection and pricing.</p></div>
            <div className={styles.faqList}>{faqs.map((faq) => <details key={faq.question}><summary>{faq.question}<span aria-hidden="true">+</span></summary><p>{faq.answer}</p></details>)}</div>
          </div>
        </section>

        <section className={styles.ctaSection}>
          <div className={[styles.container, styles.ctaGrid].join(' ')}>
            <div><p className={styles.eyebrowLight}>VIBESCHOOL FOR SCHOOLS</p><h2>Bring teaching, learning and your school together.</h2><p>Tell us about your school and what you want to improve. We’ll help you identify the right VibeSchool workflow to begin with.</p></div>
            <div className={styles.ctaActions}><Link className={styles.buttonGold} href="/contact">Contact VibeSchool <span aria-hidden="true">↗</span></Link><Link className={styles.buttonGhost} href="/sandbox">Explore the sandbox <span aria-hidden="true">→</span></Link></div>
          </div>
        </section>
        <div className={styles.institutionalNote}><div className={styles.container}>Working on a public education programme? <Link href="/institutions/constituency-pilot">Explore constituency education partnerships <span aria-hidden="true">→</span></Link></div></div>
      </main>
      <PublicFooter />
    </div>
  )
}
