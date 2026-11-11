import Link from "next/link";
import styles from "./TscRecruitmentFeature.module.css";

const articleHref = "/blog/50ef6c33-da45-4a6e-a951-77da15386fa3";
const officialApplicationHref = "https://teachersonline.tsc.go.ke/";
const applicationDeadline = Date.parse("2026-11-23T21:00:00Z"); // Midnight 24 Nov in Kenya.

export default function TscRecruitmentFeature() {
  const applicationsOpen = Date.now() < applicationDeadline;

  return (
    <section className={styles.campaign} aria-labelledby="tsc-campaign-heading">
      <div className={styles.topline}>
        <span className={styles.category}>TSC RECRUITMENT · NOVEMBER 2026</span>
        <span className={styles.status}>{applicationsOpen ? "Applications open" : "Application window closed"}</span>
      </div>
      <div className={styles.intro}>
        <div>
          <p className={styles.kicker}>National teaching opportunities</p>
          <h3 id="tsc-campaign-heading">7,720 permanent teaching vacancies</h3>
          <p className={styles.lead}>Teachers Service Commission · 2026/2027 replacement recruitment</p>
        </div>
        <div className={styles.deadline}>
          <span>Application deadline</span>
          <strong>23 Nov 2026</strong>
          <small>Midnight · Kenya time</small>
        </div>
      </div>
      <div className={styles.breakdown} aria-label="Vacancies by teaching level">
        <div><strong>5,609</strong><span>Primary schools</span></div>
        <div><strong>25</strong><span>Junior schools</span></div>
        <div><strong>2,086</strong><span>Secondary schools</span></div>
      </div>
      <div className={styles.actions}>
        <Link href={articleHref} className={styles.primary}>Read full advert and requirements <span aria-hidden="true">→</span></Link>
        <a href={officialApplicationHref} className={styles.secondary} target="_blank" rel="noopener noreferrer">
          {applicationsOpen ? "Apply on official TSC portal" : "Visit official TSC portal"} <span aria-hidden="true">↗</span>
        </a>
      </div>
      <p className={styles.note}>VibeSchool is an independent information platform, not the recruiting authority. Applications are free and are submitted directly to TSC.</p>
    </section>
  );
}
