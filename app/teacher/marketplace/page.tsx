import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, ArrowUpRight, BriefcaseBusiness, ShieldCheck } from "lucide-react";
import { PublicHeader } from "@/components/public/PublicHeader";
import { PublicFooter } from "@/components/public/PublicFooter";
import TeacherOpportunities from "@/components/teacher/marketplace/TeacherOpportunities";
import styles from "./publicMarketplace.module.css";

export const metadata: Metadata = {
  title: "Teacher Marketplace | TSC Recruitment & School Jobs",
  description: "Browse the VibeSchool Teacher Marketplace and explore TSC recruitment information and apply directly through official recruitment channels.",
  alternates: { canonical: "/teacher/marketplace" },
};

export default function PublicTeacherMarketplace() {
  return (
    <div className={styles.page}>
      <PublicHeader product="Teacher Marketplace" />
      <main id="main-content">
        <section className={styles.hero} aria-labelledby="marketplace-title">
          <div className={styles.wrap}>
            <Link href="/teacher" className={styles.breadcrumb}>Teachers <span aria-hidden="true">/</span> Marketplace</Link>
            <div className={styles.heroGrid}>
              <div>
                <p className={styles.eyebrow}>TEACHER MARKETPLACE · KENYA</p>
                <h1 id="marketplace-title">Find teaching opportunities. <span>Explore your options.</span></h1>
                <p className={styles.lead}>Find TSC recruitment figures and application guidance, plus published school vacancies and station swaps.</p>
                <div className={styles.actions}>
                  <Link href="/teacher/marketplace/sandbox" className={styles.primary}>Explore TSC vacancies <ArrowRight size={17} aria-hidden="true" /></Link>
                  <a href="#listings" className={styles.secondary}>Browse published vacancies <ArrowRight size={17} aria-hidden="true" /></a>
                </div>
              </div>
              <div className={styles.tscInfo}>
                <p className={styles.tscLabel}>TSC RECRUITMENT</p>
                <h2>Check your options before applying.</h2>
                <p>View county recruitment totals, confirm the qualifications and prepare your TSC application.</p>
                <Link className={styles.tscLink} href="/teacher/marketplace/sandbox">View TSC recruitment details <ArrowRight size={16} aria-hidden="true" /></Link>
                <p className={styles.tscNote}>County figures are reported totals, not school-by-subject vacancy matches. Applications go directly to TSC.</p>
              </div>
            </div>
          </div>
        </section>

        <section id="listings" className={styles.listings} aria-labelledby="listings-title">
          <div className={styles.wrap}>
            <div className={styles.listingHeading}>
              <div>
                <p className={styles.sectionLabel}>RECRUITMENT & LISTINGS</p>
                <h2 id="listings-title">Teacher opportunities</h2>
              </div>
              <p>Search published school vacancies or browse station swaps. The TSC recruitment advert and official application link appear with the job listings.</p>
            </div>
            <TeacherOpportunities />
          </div>
        </section>

        <section className={styles.accountSection} aria-labelledby="account-title">
          <div className={styles.wrap}>
            <div className={styles.accountRow}>
              <div>
                <p className={styles.sectionLabel}>FOR REGISTERED TEACHERS</p>
                <h2 id="account-title">Post or manage a station swap</h2>
                <p>Public browsing stays open. Your own listings, private interest requests and conversations require a teacher account.</p>
              </div>
              <Link href="/teacher/marketplace/manage?tab=swap" className={styles.manageLink}>Manage my swaps <ArrowRight size={17} aria-hidden="true" /></Link>
            </div>
            <p className={styles.footnote}><ShieldCheck size={15} aria-hidden="true" /> TSC applications and transfer approvals happen on official channels, not inside VibeSchool.</p>
          </div>
        </section>
      </main>
      <PublicFooter />
    </div>
  );
}
