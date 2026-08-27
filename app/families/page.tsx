import type { Metadata } from 'next'
import Link from 'next/link'
import { PublicHeader } from '@/components/public/PublicHeader'
import { PublicFooter } from '@/components/public/PublicFooter'
import styles from '@/components/public/PublicLanding.module.css'

export const metadata: Metadata = {
  title: 'VibeSchool for Families | Understand and support learning',
  description: 'See how VibeSchool is designed to help authorised parents and guardians understand learner progress, attendance, school communication and future pathways.',
}

const needs = [
  ['Understand progress', 'See learning context in language intended to help a family understand what is going well, what needs attention and what may happen next.'],
  ['Stay connected', 'Receive relevant school and teacher communication through the authorised learner relationship instead of relying on disconnected messages.'],
  ['See attendance context', 'Where enabled by the school, attendance information can contribute to the wider picture of learner participation.'],
  ['Support next actions', 'Progress should lead to useful follow-up: revision, practice, teacher support or another appropriate educational action.'],
  ['Navigate Pathways', 'Families can explore Senior School pathways, tracks, subjects, careers and school information with the learner.'],
  ['Respect boundaries', 'Parent access is relationship-based. Teacher-only, learner-private and administrative information should not become broadly visible.'],
]

export default function FamiliesPage(){return <div className={styles.page}><PublicHeader product="Families"/><main id="main-content">
<section className={styles.hero}><div className={styles.wrap}><p className={styles.eyebrow}>VIBESCHOOL FOR FAMILIES</p><h1>Know how learning is going — before the report card arrives.</h1><p className={styles.lead}>VibeSchool is designed to help authorised parents and guardians understand the learner journey: participation, progress, evidence, school communication and the next support that may matter.</p><div className={styles.actions}><Link className={styles.primary} href="/global">Explore learning</Link><Link className={styles.secondary} href="/pathways">Explore Pathways</Link></div><div className={styles.signals}><span>Relationship-based access</span><span>Progress context</span><span>Pathways aware</span><span>Privacy by role</span></div></div></section>
<section className={styles.section}><div className={styles.wrap}><p className={styles.eyebrow}>THE FAMILY EXPERIENCE</p><h2>Useful context, not another stream of school notifications.</h2><p className={styles.intro}>A family should be able to understand the child’s education without needing access to every teacher or administrative workspace. VibeSchool separates the family relationship from internal school authority.</p><div className={styles.grid}>{needs.map(([t,d])=><article key={t}><h3>{t}</h3><p>{d}</p></article>)}</div></div></section>
<section className={styles.sectionAlt}><div className={`${styles.wrap} ${styles.two}`}><div><p className={styles.eyebrow}>ONE LEARNER STORY</p><h2>Connect the report to what happened before it.</h2></div><div className={styles.stack}><p><strong>Learning activity</strong><br/><span className={styles.muted}>What the learner engaged with.</span></p><p><strong>Evidence & assessment</strong><br/><span className={styles.muted}>What the learner demonstrated.</span></p><p><strong>Progress</strong><br/><span className={styles.muted}>What appears understood and what needs more support.</span></p><p><strong>Next action</strong><br/><span className={styles.muted}>What the learner, teacher or family can do next.</span></p></div></div></section>
<section className={styles.dark}><div className={styles.wrap}><p className={styles.eyebrowLight}>PRIVACY IS PART OF THE PRODUCT</p><h2>Being a parent does not mean seeing everything.</h2><p className={styles.lead}>VibeSchool is designed around verified relationships and role-aware access. Families should receive the information appropriate to supporting their learner while school, teacher and learner boundaries remain protected.</p><div className={styles.actions}><Link className={styles.gold} href="/trust/child-safety">Child safety</Link><Link className={styles.darkLink} href="/trust/security">Security approach</Link><Link className={styles.darkLink} href="/legal/privacy">Privacy</Link></div></div></section>
<section className={styles.section}><div className={`${styles.wrap} ${styles.two}`}><div><p className={styles.eyebrow}>LEARNING BEYOND SCHOOL HOURS</p><h2>A continuing learning place for the learner.</h2></div><div><p className={styles.copy}>The public VibeSchool learning library and Pathways experiences are designed to give learners and families useful educational resources beyond a single school report. As personalised experiences expand, they should remain connected to trustworthy learner context rather than becoming an isolated content feed.</p><div className={styles.actions}><Link className={styles.primary} href="/global">Open learning library</Link><Link className={styles.outline} href="/product">See the whole product</Link></div></div></div></section>
</main><PublicFooter/></div>}
