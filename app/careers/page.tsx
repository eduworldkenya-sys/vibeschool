import type { Metadata } from 'next'
import Link from 'next/link'
import { PublicHeader } from '@/components/public/PublicHeader'
import { PublicFooter } from '@/components/public/PublicFooter'
import { CareerInterest } from './CareerInterest'
import styles from '@/components/public/PublicLanding.module.css'

export const metadata: Metadata = {
  title: 'Careers | VibeSchool',
  description: 'Learn about future opportunities to help build VibeSchool for learners, educators, families and schools in Kenya.',
  alternates:{canonical:'/careers'},
}

const areas = [
  ['Education & Curriculum','Teachers, subject specialists, curriculum reviewers and assessment experts.'],
  ['Engineering & Data','Software engineering, data systems, reliability, security and applied AI.'],
  ['Product & Design','Research, product thinking, UX, accessibility and low-bandwidth/mobile experience.'],
  ['Schools & Partnerships','School success, institutional partnerships, onboarding and implementation.'],
  ['Support & Operations','Customer support, trust and safety, operations and quality assurance.'],
  ['Growth & Communication','Community, storytelling, content distribution and responsible growth.'],
] as const

export default function CareersPage(){
  return <div className={styles.page}>
    <PublicHeader product="Careers" />
    <main id="main-content">
      <section className={styles.hero}><div className={styles.wrap}>
        <p className={styles.eyebrow}>BUILD WITH VIBESCHOOL</p>
        <h1>Help build education infrastructure people can actually use.</h1>
        <p className={styles.lead}>VibeSchool is being built for learners, teachers, families and institutions. We are not presenting roles as open when they are not. This page exists so exceptional people can understand the mission and know where future opportunities may emerge.</p>
        <div className={styles.actions}><a href="#talent-interest" className={styles.primary}>Express interest</a><Link href="/about" className={styles.secondary}>Understand VibeSchool</Link></div>
      </div></section>

      <section className={styles.section}><div className={styles.wrap}>
        <p className={styles.eyebrow}>AREAS OF INTEREST</p>
        <h2>The kinds of people we expect to need</h2>
        <div className={styles.grid}>{areas.map(([title,body])=><article key={title}><h3>{title}</h3><p>{body}</p></article>)}</div>
      </div></section>

      <section className={styles.dark}><div className={styles.wrap}>
        <p className={styles.eyebrowLight}>WHAT MATTERS HERE</p>
        <h2>Mission fit is more important than polished titles.</h2>
        <p className={styles.lead}>We value people who can reason from evidence, communicate clearly with ordinary users, respect children and data, understand Kenyan educational context, and turn complicated systems into experiences that feel simple.</p>
        <p className={styles.lead}>When genuine vacancies open, they should appear here with responsibilities, working arrangement, selection process and compensation information appropriate to the role. Until then, VibeSchool will not manufacture job listings simply to appear larger than it is.</p>
      </div></section>

      <CareerInterest />
    </main>
    <PublicFooter />
  </div>
}
