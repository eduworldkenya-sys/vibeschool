import { PublicHeader } from "@/components/public/PublicHeader";
import { PublicFooter } from "@/components/public/PublicFooter";
import { TrackedLink } from "@/components/public/TrackedLink";
import { ArrowRight, BriefcaseBusiness, ArrowLeftRight } from "lucide-react";
import styles from "./TeacherGateway.module.css";
import TeacherOpportunities from "@/components/teacher/marketplace/TeacherOpportunities";
import TeacherExperiencePreview from "./TeacherExperiencePreview";


export const metadata = {
  title: "For Teachers | VibeSchool",
  description: "Plan lessons, prepare schemes, assess learners and continue your work in VibeSchool Teacher OS.",
};

export default function TeacherGateway() {
  return <div className={styles.page}>
    <PublicHeader product="Teachers" />
    <main id="main-content">
      <section className={styles.hero} aria-labelledby="teacher-hero-title">
        <div className={`${styles.wrap} ${styles.heroLayout}`}>
          <div className={styles.heroCopy}>
            <p className={styles.eyebrow}>TEACHER MARKETPLACE · START HERE</p>
            <h1 id="teacher-hero-title">Find teaching opportunities that fit what you teach.</h1>
            <p className={styles.intro}>Choose your teaching level, subject combination and preferred county. Explore how vacancy matching works in our free interactive preview.</p>
            <div className={styles.heroActions}>
              <TrackedLink className={`${styles.primary} ${styles.matchPrimary}`} event="public_teacher_tsc_sandbox" href="/teacher/marketplace/sandbox">Try vacancy matching <ArrowRight size={18} aria-hidden="true" /></TrackedLink>
              <TrackedLink className={styles.secondary} event="public_teacher_lesson" href="/login?redirect=/teacher/pulse">Open Teacher OS <ArrowRight size={18} aria-hidden="true" /></TrackedLink>
            </div>
            <p className={styles.matchHint}>No login needed. This preview uses example school records, not verified TSC vacancies.</p>
          </div>
          <div className={styles.heroPreview}><TeacherExperiencePreview /></div>
        </div>
      </section>
      <section className={styles.jobs} aria-labelledby="teacher-marketplace-title">
        <div className={styles.wrap}>
          <div className={styles.jobsHeading}><h2 id="teacher-marketplace-title">Teacher marketplace</h2><BriefcaseBusiness size={19} aria-hidden="true"/></div>
          <p className={styles.demoNote}>TSC recruitment and teaching vacancies are open to everyone. No sign-in needed to browse.</p>
          <div className={styles.heroActions}><a className={`${styles.primary} ${styles.matchPrimary}`} href="/teacher/marketplace/sandbox">Try vacancy matching <ArrowRight size={18} aria-hidden="true"/></a><a className={styles.secondary} href="/teacher/marketplace">Browse published vacancies <ArrowRight size={18} aria-hidden="true"/></a></div>
          <TeacherOpportunities />
          <p className={styles.demoNote}>Browse school jobs or find a possible station swap.</p>
          <div className={styles.heroActions}><a className={styles.secondary} href="/login?redirect=%2Fteacher%2Fmarketplace%2Fmanage%3Ftab%3Dswap">Post or manage a swap <ArrowLeftRight size={18} aria-hidden="true"/></a></div>
        </div>
      </section>
    </main>
    <PublicFooter />
  </div>;
}
