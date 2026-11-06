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
            <p className={styles.eyebrow}>BUILT FOR KENYAN TEACHERS</p>
            <h1 id="teacher-hero-title">Your teaching work, made easier.</h1>
            <p className={styles.intro}>Plan lessons, prepare schemes, assess learners and find teaching resources in one place.</p>
            <div className={styles.heroActions}>
              <TrackedLink className={styles.primary} event="public_teacher_lesson" href="/login?redirect=/teacher/pulse">Open Teacher OS <ArrowRight size={18} aria-hidden="true" /></TrackedLink>
            </div>
          </div>
          <div className={styles.heroPreview}><TeacherExperiencePreview /></div>
        </div>
      </section>
      <section className={styles.jobs} aria-labelledby="teacher-marketplace-title">
        <div className={styles.wrap}>
          <div className={styles.jobsHeading}><h2 id="teacher-marketplace-title">Teacher marketplace</h2><BriefcaseBusiness size={19} aria-hidden="true"/></div>
          <TeacherOpportunities />
          <p className={styles.demoNote}>Browse school jobs or find a possible station swap.</p>
          <div className={styles.heroActions}><a className={styles.secondary} href="/login?redirect=%2Fteacher%2Fmarketplace%3Ftab%3Dswap">Post or manage a swap <ArrowLeftRight size={18} aria-hidden="true"/></a></div>
        </div>
      </section>
    </main>
    <PublicFooter />
  </div>;
}
