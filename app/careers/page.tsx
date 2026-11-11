import type { Metadata } from 'next'
import Link from 'next/link'
import { PublicHeader } from '@/components/public/PublicHeader'
import { PublicFooter } from '@/components/public/PublicFooter'
import { CareerInterest } from './CareerInterest'
import { focusAreas, publishedRoles } from './careerContent'
import styles from './careers.module.css'

export const metadata: Metadata = {
  title: 'Careers | VibeSchool',
  description: 'Explore VibeSchool careers, check current published vacancies and introduce your work to the team.',
  alternates: { canonical: '/careers' },
}

export default function CareersPage() {
  const hasOpenRoles = publishedRoles.length > 0

  return (
    <div className={styles.page}>
      <PublicHeader product="Careers" />
      <main id="main-content">
        <section className={styles.hero} aria-labelledby="careers-title">
          <div className={styles.container}>
            <div className={styles.heroGrid}>
              <div className={styles.heroText}>
                <p className={styles.eyebrowLight}>CAREERS AT VIBESCHOOL</p>
                <h1 id="careers-title">Build for the people <em>doing the teaching.</em></h1>
                <p className={styles.heroLead}>Curriculum. Lesson preparation. Assessment. The work behind a school day. VibeSchool brings these together, with Kenyan teachers and learners at the centre.</p>
                <div className={styles.heroActions}>
                  <a href="#open-roles" className={styles.primaryAction}>View open positions <span aria-hidden="true">↗</span></a>
                  <a href="#talent-interest" className={styles.secondaryAction}>Introduce yourself <span aria-hidden="true">→</span></a>
                </div>
              </div>
              <aside className={styles.hiringPanel} aria-label="Careers information">
                <p className={styles.panelEyebrow}>OPPORTUNITIES</p>
                <div className={styles.panelRule} />
                <p className={styles.panelHeadline}>{hasOpenRoles ? `${publishedRoles.length} ${publishedRoles.length === 1 ? 'position' : 'positions'} listed` : 'No positions listed today.'}</p>
                <p className={styles.panelCopy}>Only published VibeSchool team roles appear on this page. Other school employers list opportunities separately.</p>
                <Link className={styles.panelLink} href="/teacher">Looking for a teaching job? <span aria-hidden="true">→</span></Link>
              </aside>
            </div>
          </div>
        </section>

        <section className={styles.openingsSection} id="open-roles" aria-labelledby="openings-heading">
          <div className={styles.container}>
            <div className={styles.sectionIntro}>
              <div>
                <p className={styles.eyebrow}>VIBESCHOOL TEAM</p>
                <h2 id="openings-heading">Open positions</h2>
              </div>
              <p>These are roles with a published description and an application route. General enquiries are handled separately.</p>
            </div>
            {hasOpenRoles ? (
              <div className={styles.roleList}>
                {publishedRoles.map(role => (
                  <article key={role.id} className={styles.roleRow}>
                    <div>
                      <p className={styles.roleTeam}>{role.team}</p>
                      <h3>{role.title}</h3>
                      <p className={styles.roleSummary}>{role.summary}</p>
                      <p className={styles.roleMeta}>{role.location} <span aria-hidden="true">·</span> {role.arrangement}{role.closingDate ? ` · Closes ${role.closingDate}` : ''}</p>
                    </div>
                    <a href={role.applicationUrl} className={styles.roleLink} target="_blank" rel="noopener noreferrer" aria-label={`View and apply for ${role.title}`}>View role <span aria-hidden="true">↗</span></a>
                  </article>
                ))}
              </div>
            ) : (
              <div className={styles.noOpenings}>
                <div>
                  <p className={styles.availabilityLabel}><span className={styles.dot} aria-hidden="true" /> NO VACANCIES PUBLISHED</p>
                  <h3>Nothing to apply for here right now.</h3>
                  <p>There are no VibeSchool team vacancies published on this page. You can still share a short introduction below; that is an enquiry, not a job application.</p>
                </div>
                <a href="#talent-interest" className={styles.inlineAction}>Introduce your work <span aria-hidden="true">→</span></a>
              </div>
            )}
          </div>
        </section>

        <section className={styles.workSection} aria-labelledby="work-heading">
          <div className={styles.container}>
            <div className={styles.sectionIntro}>
              <div><p className={styles.eyebrow}>THE PRODUCT</p><h2 id="work-heading">See what we work on.</h2></div>
              <p>These are real parts of VibeSchool you can explore. They are not job advertisements.</p>
            </div>
            <div className={styles.focusList}>
              {focusAreas.map((area, index) => (
                <article className={styles.focusItem} key={area.id}>
                  <span className={styles.focusNumber}>{String(index + 1).padStart(2, '0')}</span>
                  <div className={styles.focusBody}><h3>{area.name}</h3><p>{area.description}</p></div>
                  <Link href={area.href} className={styles.focusLink}>{area.linkText} <span aria-hidden="true">↗</span></Link>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className={styles.workPrinciples} aria-labelledby="principles-heading">
          <div className={[styles.container, styles.principlesGrid].join(' ')}>
            <div>
              <p className={styles.eyebrowLight}>WHAT THE WORK DEMANDS</p>
              <h2 id="principles-heading">Understand the school day. Then make it easier.</h2>
            </div>
            <div>
              <p>Teachers should not have to rebuild the same information in five places. Learners need content they can understand. A school needs records people can trust.</p>
              <p>That is the standard we use to examine the product: can someone complete the task, on their device, without unnecessary steps?</p>
              <Link href="/about" className={styles.lightLink}>Get to know VibeSchool <span aria-hidden="true">→</span></Link>
            </div>
          </div>
        </section>

        <CareerInterest />

        <section className={styles.teacherStrip} aria-label="Teaching jobs and swaps">
          <div className={[styles.container, styles.teacherStripInner].join(' ')}>
            <div><p className={styles.eyebrow}>LOOKING FOR SCHOOL VACANCIES?</p><h2>Teaching jobs belong in the Teacher Marketplace.</h2></div>
            <Link href="/teacher">Browse teaching opportunities <span aria-hidden="true">↗</span></Link>
          </div>
        </section>
      </main>
      <PublicFooter />
    </div>
  )
}
