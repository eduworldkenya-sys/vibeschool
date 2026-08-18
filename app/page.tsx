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

export const metadata: Metadata = {
  alternates:{canonical:'/'},
  title:'VibeSchool — One learning system from curriculum to the next step',
  description:'VibeSchool connects curriculum, teaching, learning evidence, assessment, progress, parents, schools and Senior School Pathways in one Kenyan education system.',
}

const schoolDay = [
  ['07:30', 'Teacher prepares', 'Today’s curriculum position, scheme and lesson context belong to the same planning journey.'],
  ['08:00', 'The lesson becomes real', 'Teaching activity and attendance can be connected to what was planned instead of living in separate records.'],
  ['10:15', 'Learners produce evidence', 'Practice, homework and submissions give the school something more useful than a completion count.'],
  ['13:00', 'The teacher can respond', 'Assessment and evidence can expose where more explanation, practice or intervention may be needed.'],
  ['16:00', 'Families get the right context', 'Authorised families can understand relevant progress without entering the teacher’s private workspace.'],
  ['17:00', 'Leadership sees the learning', 'School visibility can connect curriculum, teaching, participation and learner progress rather than ending at administration.'],
]

const trust = [
  ['Built around Kenyan education', 'VibeSchool is designed for the real relationships between learners, teachers, parents, schools and Kenya’s changing education pathways.'],
  ['Evidence before claims', 'Educational guidance, verified facts and uncertainty are kept distinct so important decisions are not presented with false certainty.'],
  ['Privacy follows relationship', 'Learner and school information is intended to follow authorised roles, relationships and purpose rather than a single all-access account.'],
  ['Humans remain responsible', 'Technology can assist planning, learning and understanding, while consequential educational decisions remain appropriately human-led.'],
]

export default function HomePage() { return <div className={styles.page}><PublicHeader/><main id="main-content">
<section className={styles.hero}><div className={styles.heroInner}><p className={styles.eyebrow}>VIBESCHOOL · KENYA</p><h1>One learning system. From curriculum to the learner’s next step.</h1><p className={styles.lead}>VibeSchool connects planning, teaching, learning, evidence, assessment, progress, families and future direction — so the education journey works as one continuous system instead of a collection of disconnected tools.</p><div className={styles.actions}><TrackedLink className={styles.primary} href="/global" event="public_home_start_learning">Start learning</TrackedLink><Link className={styles.secondary} href="/sandbox">Use the live sandbox</Link><TrackedLink className={styles.textAction} href="/institutions" event="public_home_institutions">For schools →</TrackedLink></div><div className={styles.heroTrust}><span>Built for Kenya</span><span>CBC / CBE aware</span><span>Explore before login</span><span>Mobile-first</span><span>Role-based privacy</span></div></div></section>
<div id="product-tour"><ProductTour/></div>
<RoleJourneySelector/>
<section className={styles.daySection} aria-labelledby="school-day-title"><div className={styles.dayIntro}><p className={styles.eyebrowDark}>A DAY WITH VIBESCHOOL</p><h2 id="school-day-title">By the end of the school day, everyone should know what matters.</h2><p>Follow the educational signal through one ordinary day. The value is not six separate modules — it is what becomes possible when the same learning story survives from planning to support.</p></div><ol className={styles.dayTimeline}>{schoolDay.map(([time,title,body])=><li key={time}><time>{time}</time><div><h3>{title}</h3><p>{body}</p></div></li>)}</ol></section>
<ConnectedEducationExplorer/>
<SchoolReadinessAssessment/>
<section className={styles.demoSection}><div className={styles.sectionHeading}><p className={styles.eyebrowDark}>EXPLORE VIBESCHOOL</p><h2>See the educational model before deciding whether it belongs in your school or family.</h2><p>Start with the live product sandbox, public learning and Pathways experiences, then inspect how VibeSchool approaches institutions, evidence, privacy and responsibility.</p></div><div className={styles.demoGrid}><Link href="/sandbox" className={styles.demoCard}><span className={styles.demoLabel}>LIVE SANDBOX</span><h3>Run one lesson from plan to next action.</h3><p>Use safe demo data to plan, teach, capture evidence, assess what the evidence supports, understand the gap and see the authorised view for teacher, learner, family and school leader.</p><strong>Use VibeSchool now →</strong></Link><TrackedLink href="/global" event="public_home_start_learning" className={styles.demoCard}><span className={styles.demoLabel}>LEARNING</span><h3>Learning that continues beyond a single resource.</h3><p>Explore curriculum-organised learning and how resources, practice and progress fit into the wider learner journey.</p><strong>Explore learning →</strong></TrackedLink><TrackedLink href="/pathways" event="public_home_pathways" className={styles.demoCard}><span className={styles.demoLabel}>SENIOR SCHOOL PATHWAYS</span><h3>Move from interests to subjects, careers and schools with clearer evidence.</h3><p>Explore pathways and subject choices while seeing where verified information begins, where guidance is used and where uncertainty remains.</p><strong>Explore Pathways →</strong></TrackedLink></div></section>
<section className={styles.trustSection}><div className={styles.sectionHeading}><p className={styles.eyebrowDark}>TRUST IS PART OF THE PRODUCT</p><h2>Education software should be useful enough to rely on and clear enough to question.</h2><p>VibeSchool treats evidence, access, child safety, uncertainty and human responsibility as product requirements — not footer decoration.</p></div><div className={styles.trustGrid}>{trust.map(([title,body])=><article key={title}><h3>{title}</h3><p>{body}</p></article>)}</div><div className={styles.trustLinks}><Link href="/product">Product map</Link><Link href="/trust">Trust Centre</Link><Link href="/about">Mission & how VibeSchool works</Link><Link href="/contact">Contact VibeSchool</Link></div></section>
<section className={styles.institutionSection}><div><p className={styles.eyebrowLight}>FOR SCHOOLS & EDUCATION INSTITUTIONS</p><h2>Run the institution. Understand the learning.</h2></div><div><p>School software should do more than digitise administration. VibeSchool is designed to connect institutional operations with curriculum, teaching, assessment, learner evidence, family context and future direction while preserving role boundaries and accountability.</p><div className={styles.actions}><Link className={styles.primaryLight} href="/institutions">Explore VibeSchool for institutions</Link><TrackedLink className={styles.secondaryLight} href="/contact" event="public_institution_contact">Talk to VibeSchool</TrackedLink></div></div></section>
</main><PublicFooter/></div> }
