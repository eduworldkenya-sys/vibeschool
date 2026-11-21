import type { Metadata } from 'next'
import Link from 'next/link'
import {
  ArrowRight,
  ArrowUpRight,
  BookOpenCheck,
  Building2,
  CalendarDays,
  ChartNoAxesCombined,
  CheckCircle2,
  GraduationCap,
  LockKeyhole,
  MapPin,
  School,
  ShieldCheck,
  Smartphone,
  Users,
} from 'lucide-react'
import { PublicHeader } from '@/components/public/PublicHeader'
import { PublicFooter } from '@/components/public/PublicFooter'
import { InstitutionsRolePreview } from './InstitutionsRolePreview'
import styles from './Institutions.module.css'

export const metadata: Metadata = {
  alternates: { canonical: '/institutions' },
  title: 'VibeSchool for Schools | One Connected School Platform',
  description: 'Bring school administration, teaching, learning and progress together. Explore VibeSchool workspaces and request setup for your Kenyan school.',
}

const pillars = [
  {
    title: 'School office',
    description: 'Keep school setup, classes, staff and operational records connected.',
    Icon: Building2,
  },
  {
    title: 'Teaching',
    description: 'Connect curriculum, lesson preparation, classroom activity and resources.',
    Icon: BookOpenCheck,
  },
  {
    title: 'Learning',
    description: 'Give learners a clear home for lessons, practice and assessments.',
    Icon: GraduationCap,
  },
  {
    title: 'Progress',
    description: 'Use assessment evidence to understand what needs attention next.',
    Icon: ChartNoAxesCombined,
  },
]

const setupSteps = [
  { number: '01', title: 'Tell us about your school', text: 'Share your school details and what you want to introduce first.' },
  { number: '02', title: 'Verify and configure', text: 'Confirm authorised leadership, classes, staff and access boundaries.' },
  { number: '03', title: 'Start with a working workflow', text: 'Activate agreed tools for teaching, learning and school operations.' },
]

export default function InstitutionsPage() {
  return (
    <div className={styles.page}>
      <PublicHeader product="For Schools" />
      <main id="main-content">
        <section className={styles.hero} aria-labelledby="institutions-hero-heading">
          <div className={styles.container}>
            <div className={styles.topline}><School size={16} aria-hidden="true" /> FOR SCHOOL OWNERS, PRINCIPALS & ADMINISTRATORS</div>
            <div className={styles.heroGrid}>
              <div className={styles.heroCopy}>
                <p className={styles.kicker}>VIBESCHOOL FOR SCHOOLS</p>
                <h1 id="institutions-hero-heading">One school.<br /><span>Everything connected.</span></h1>
                <p className={styles.heroLead}>Bring school leadership, teaching and learning together. One clear experience for the people running your school and the people learning in it.</p>
                <div className={styles.heroActions}>
                  <Link className={styles.primaryButton} href="/contact?support=school">Request school setup <ArrowRight size={18} aria-hidden="true" /></Link>
                  <Link className={styles.secondaryButton} href="#workspaces">Explore the platform <ArrowRight size={18} aria-hidden="true" /></Link>
                </div>
                <div className={styles.heroTrust}>
                  <span><ShieldCheck size={16} aria-hidden="true" /> Role-aware access</span>
                  <span><Smartphone size={16} aria-hidden="true" /> Mobile-focused</span>
                  <span><MapPin size={16} aria-hidden="true" /> Built for Kenya</span>
                </div>
              </div>
              <div className={styles.heroFrame} aria-label="Illustration of the connected school workspace">
                <div className={styles.frameBar}>
                  <div className={styles.frameIdentity}><span className={styles.frameBrand}><School size={16} aria-hidden="true" /></span><span>School overview</span></div>
                  <span className={styles.frameNote}>PREVIEW</span>
                </div>
                <div className={styles.frameBody}>
                  <p className={styles.frameEyebrow}>YOUR SCHOOL WORKSPACE</p>
                  <h2>Run the school.<br />Support the learning.</h2>
                  <p className={styles.frameSubheading}>Everything important, organised around your school.</p>
                  <div className={styles.frameTiles}>
                    <div><Users size={20} aria-hidden="true" /><strong>People & classes</strong><span>School organisation</span></div>
                    <div><CalendarDays size={20} aria-hidden="true" /><strong>Teaching activity</strong><span>Schedules & lessons</span></div>
                    <div><BookOpenCheck size={20} aria-hidden="true" /><strong>Learning</strong><span>Practice & assessment</span></div>
                    <div><ChartNoAxesCombined size={20} aria-hidden="true" /><strong>Progress</strong><span>Evidence & next steps</span></div>
                  </div>
                  <div className={styles.frameSequence}><span>Plan</span><ArrowRight size={14} /><span>Teach</span><ArrowRight size={14} /><span>Assess</span><ArrowRight size={14} /><span>Improve</span></div>
                  <p className={styles.frameFootnote}>Illustrative screen. No real school or learner data displayed.</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className={styles.pillarsSection} aria-labelledby="institutions-platform">
          <div className={styles.container}>
            <div className={styles.sectionHeading}>
              <div><p className={styles.kicker}>WHAT A SCHOOL CAN BRING TOGETHER</p><h2 id="institutions-platform">Your school, brought together.</h2></div>
              <p>Four parts of school life. Connected instead of scattered across separate tools.</p>
            </div>
            <div className={styles.pillarGrid}>
              {pillars.map(({ title, description, Icon }) => (
                <article className={styles.pillarCard} key={title}>
                  <span className={styles.pillarIcon}><Icon size={23} strokeWidth={1.8} aria-hidden="true" /></span>
                  <h3>{title}</h3>
                  <p>{description}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className={styles.rolesSection} id="workspaces" aria-labelledby="institutions-workspaces">
          <div className={styles.container}>
            <div className={styles.sectionHeading}>
              <div><p className={styles.kicker}>EXPLORE THE EXPERIENCE</p><h2 id="institutions-workspaces">The right view for every person.</h2></div>
              <p>Choose a role to see how the platform is organised. School data remains restricted to authorised people.</p>
            </div>
            <InstitutionsRolePreview />
          </div>
        </section>

        <section className={styles.flowSection} aria-labelledby="institutions-connected">
          <div className={styles.container}>
            <div className={styles.flowGrid}>
              <div>
                <p className={styles.kicker}>FROM PLAN TO PROGRESS</p>
                <h2 id="institutions-connected">Learning should not get lost between systems.</h2>
                <p>Curriculum direction, teaching activity and results should inform the next action. Start with the workflows your school needs most.</p>
                <Link className={styles.inlineLink} href="/product">How VibeSchool connects learning <ArrowUpRight size={17} aria-hidden="true" /></Link>
              </div>
              <ol className={styles.flowSteps}>
                <li><span>01</span><div><strong>Plan</strong><p>Curriculum, schemes and lessons</p></div><CheckCircle2 size={19} aria-hidden="true" /></li>
                <li><span>02</span><div><strong>Teach</strong><p>Classroom delivery and resources</p></div><CheckCircle2 size={19} aria-hidden="true" /></li>
                <li><span>03</span><div><strong>Assess</strong><p>Practice, feedback and results</p></div><CheckCircle2 size={19} aria-hidden="true" /></li>
                <li><span>04</span><div><strong>Improve</strong><p>Next steps informed by learning evidence</p></div><CheckCircle2 size={19} aria-hidden="true" /></li>
              </ol>
            </div>
          </div>
        </section>

        <section className={styles.onboardingSection} id="school-setup" aria-labelledby="institutions-onboarding">
          <div className={styles.container}>
            <div className={styles.sectionHeading}>
              <div><p className={styles.kicker}>IMPLEMENTATION PRINCIPLE</p><h2 id="institutions-onboarding">Bring your school to VibeSchool.</h2></div>
              <p>Start with a guided setup, not an unverified promise that every school workflow is ready for immediate activation.</p>
            </div>
            <ol className={styles.setupGrid}>
              {setupSteps.map((step) => (
                <li key={step.number}>
                  <span>{step.number}</span><h3>{step.title}</h3><p>{step.text}</p>
                </li>
              ))}
            </ol>
            <div className={styles.setupActions}>
              <Link className={styles.primaryButton} href="/contact?support=school">Request school setup <ArrowRight size={18} aria-hidden="true" /></Link>
              <p>No school data is published or access granted through this public page.</p>
            </div>
            <div className={styles.adoptionNote}>
              <div>
                <p className={styles.kicker}>BEFORE ADOPTION</p>
                <h3>Know what your school is getting.</h3>
                <p>Confirm the exact workflows, access rules and rollout plan before making a school-wide decision.</p>
              </div>
              <div className={styles.adoptionQuestions}>
                <p className={styles.kicker}>QUESTIONS A SCHOOL SHOULD ASK BEFORE BUYING</p>
                <details>
                  <summary>Which features are ready for our school?</summary>
                  <p>We check your levels, teachers, devices and intended workflows before agreeing which tools to activate. Not every feature has completed a live-school pilot.</p>
                </details>
                <details>
                  <summary>How is learner information protected?</summary>
                  <p>School, teacher, parent and learner access must follow verified roles and relationships. <Link href="/trust">Read the Trust Centre.</Link></p>
                </details>
                <details>
                  <summary>What support, uptime and pricing are included?</summary>
                  <p>School-specific pricing and support commitments are agreed during onboarding. VibeSchool does not publish an invented support or uptime guarantee.</p>
                </details>
              </div>
            </div>
          </div>
        </section>

        <section className={styles.directorySection} aria-label="Public school discovery">
          <div className={[styles.container, styles.directoryCard].join(' ')}>
            <div className={styles.directoryIcon}><School size={27} aria-hidden="true" /></div>
            <div>
              <p className={styles.kicker}>LOOKING FOR A SCHOOL?</p>
              <h2>Explore the school directory.</h2>
              <p>Parents and learners can discover schools using publicly available school information. School operations stay separate.</p>
            </div>
            <Link className={styles.directoryLink} href="/schools">Find schools <ArrowUpRight size={18} aria-hidden="true" /></Link>
          </div>
        </section>

        <section className={styles.finalSection}>
          <div className={styles.container}>
            <div className={styles.finalGrid}>
              <div><p className={styles.kicker}>SCHOOL LEADERSHIP STARTS HERE</p><h2>Ready to connect your school?</h2><p>Tell us what you need. We will confirm the available tools and a practical school setup path.</p></div>
              <div className={styles.finalActions}>
                <Link className={styles.primaryButton} href="/contact?support=school">Discuss school setup <ArrowRight size={18} aria-hidden="true" /></Link>
                <Link className={styles.finalSecondary} href="/trust"><LockKeyhole size={17} aria-hidden="true" /> Privacy and trust</Link>
              </div>
            </div>
          </div>
        </section>
      </main>
      <PublicFooter />
    </div>
  )
}
