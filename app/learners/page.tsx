import type { Metadata } from 'next'
import Link from 'next/link'
import { PublicHeader } from '@/components/public/PublicHeader'
import { PublicFooter } from '@/components/public/PublicFooter'
import styles from '@/components/public/PublicLanding.module.css'

export const metadata: Metadata = {
  title: 'VibeSchool for Learners | Learn, practise, understand, progress',
  description: 'Explore VibeSchool for learners: learning resources, practice, evidence, progress, next actions and Senior School Pathways in one continuing learning experience.',
}

const loop = [
  ['01','Learn','Use curriculum-connected resources and explanations.'],
  ['02','Practise','Attempt exercises and learning tasks rather than only reading.'],
  ['03','Show','Create evidence through work, submissions and assessment.'],
  ['04','Understand','See what appears strong and where more support is needed.'],
  ['05','Act','Revise, practise, ask for help or take the next learning action.'],
  ['06','Progress','Carry useful learning context forward instead of starting from zero.'],
]

const experiences = [
  ['Learning library','Explore educational resources through VibeSchool’s public learning environment.'],
  ['Practice & assessment','Move from consuming information to demonstrating understanding.'],
  ['Progress & mastery','Build a clearer picture of what has been learned and what still needs work.'],
  ['Personalised support','Use learner context to make support more relevant while keeping important decisions appropriately bounded.'],
  ['Senior School Pathways','Explore pathways, tracks, subject combinations, careers and school information for future-direction decisions.'],
  ['Connected school learning','Where a learner belongs to a participating school or class, classroom activity can contribute to the wider learning story under appropriate authority.'],
]

export default function LearnersPage(){return <div className={styles.page}><PublicHeader product="Learners"/><main id="main-content">
<section className={styles.hero}><div className={styles.wrap}><p className={styles.eyebrow}>VIBESCHOOL FOR LEARNERS</p><h1>Don’t just finish the lesson. Know what to do next.</h1><p className={styles.lead}>VibeSchool is designed as a continuing learning place: learn, practise, show what you understand, see what needs attention and move forward with better context.</p><div className={styles.actions}><Link className={styles.primary} href="/global">Start learning</Link><Link className={styles.secondary} href="/pathways/check">Try Pathways Quick Check</Link></div><div className={styles.signals}><span>Curriculum-connected</span><span>Practice & evidence</span><span>Progress context</span><span>Pathways aware</span></div></div></section>
<section className={styles.section}><div className={styles.wrap}><p className={styles.eyebrow}>THE LEARNING LOOP</p><h2>Learning should create the next useful action.</h2><div className={styles.steps}>{loop.map(([n,t,d])=><article className={styles.step} key={n}><span>{n}</span><strong>{t}</strong><p className={styles.muted}>{d}</p></article>)}</div></div></section>
<section className={styles.sectionAlt}><div className={styles.wrap}><p className={styles.eyebrow}>ONE LEARNER · CONNECTED EXPERIENCES</p><h2>Resources are only one part of learning.</h2><p className={styles.intro}>The stronger product is not the one with the longest content list. It is the one that helps the learner turn content, practice and evidence into understanding and progress.</p><div className={styles.grid}>{experiences.map(([t,d])=><article key={t}><h3>{t}</h3><p>{d}</p></article>)}</div></div></section>
<section className={styles.dark}><div className={`${styles.wrap} ${styles.two}`}><div><p className={styles.eyebrowLight}>SENIOR SCHOOL PATHWAYS</p><h2>Explore your direction with evidence, not a label.</h2></div><div><p className={styles.lead}>Pathways guidance should help a learner explore possibilities without pretending a quick check can decide their future. VibeSchool separates guidance from placement and keeps uncertainty visible.</p><div className={styles.actions}><Link className={styles.gold} href="/pathways">Explore Pathways</Link><Link className={styles.darkLink} href="/learn/careers">Explore careers</Link></div></div></div></section>
<section className={styles.section}><div className={`${styles.wrap} ${styles.two}`}><div><p className={styles.eyebrow}>BUILT AROUND THE LEARNER</p><h2>Your learning history should become useful context.</h2></div><div><p className={styles.intro}>VibeSchool’s direction is to connect curriculum, classroom activity, learning resources, practice, evidence and assessment into a learner state that can support better next actions. It should not quietly make consequential educational decisions for the learner.</p><div className={styles.actions}><Link className={styles.primary} href="/product">See the full system</Link><Link className={styles.outline} href="/trust/responsible-ai">Responsible AI</Link></div></div></div></section>
</main><PublicFooter/></div>}
