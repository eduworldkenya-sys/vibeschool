"use client";
'use client'
import { useRouter } from 'next/navigation'
import styles from '../legal.module.css'

export default function TermsPage() {
  const router = useRouter()

  return (
    <div className={styles.root}>
      <div className={styles.content}>
        <button className={styles.back} onClick={() => router.back()}>← Back</button>

        <p className={styles.badge}>Gilowinc Investment · BN-KYCZ73AZ</p>
        <h1 className={styles.title}>Terms of Service</h1>
        <p className={styles.meta}>Effective: 27 May 2026 &nbsp;·&nbsp; Last updated: 27 May 2026</p>
        <div className={styles.divider} />

        <div className={styles.section}>
          <p className={styles.sectionTitle}>1. About These Terms</p>
          <p className={styles.body}>These Terms govern your access to and use of <strong>VibeSchool</strong>, a school management platform operated by <strong>Gilowinc Investment</strong> (Registration No. BN-KYCZ73AZ), Nairobi, Kenya. By creating an account or using VibeSchool, you confirm you have read, understood, and agree to be bound by these Terms and our Privacy Policy. If you do not agree, you must not use the Platform.</p>
        </div>

        <div className={styles.section}>
          <p className={styles.sectionTitle}>2. Eligibility</p>
          <p className={styles.body}>You must be at least <strong>18 years old</strong> to create a User account. Student accounts are <strong>parent-managed</strong>. Schools confirm they are legally constituted educational institutions complying with the Basic Education Act 2013.</p>
        </div>

        <div className={styles.section}>
          <p className={styles.sectionTitle}>3. Account Security</p>
          <p className={styles.body}>You are responsible for maintaining the confidentiality of your credentials and all activity under your account. Notify us immediately at <strong>gilowincinvestment@gmail.com</strong> if you suspect unauthorised access. School Administrators must promptly revoke access for any staff member who leaves.</p>
        </div>

        <div className={styles.section}>
          <p className={styles.sectionTitle}>4. Subscription and Payment</p>
          <p className={styles.body}>VibeSchool is a paid platform. Fees are communicated at registration and subject to change with 30 days notice. Fees are non-refundable except as required by Kenyan law. We may suspend access if payment is overdue by more than 14 days with prior written notice. All fees are quoted in Kenyan Shillings (KES).</p>
        </div>

        <div className={styles.section}>
          <p className={styles.sectionTitle}>5. Acceptable Use</p>
          <ul className={styles.list}>
            <li>Do not upload unlawful, harmful, defamatory, or obscene content</li>
            <li>Do not share Student Data outside the Platform without explicit parental consent</li>
            <li>Do not impersonate any person or misrepresent your school affiliation</li>
            <li>Do not attempt unauthorised access to any part of the Platform</li>
            <li>Do not use automated tools or bots to extract data</li>
            <li>Do not upload malicious code or disruptive software</li>
            <li>Do not harass, bully, or intimidate any student, parent, or staff member</li>
            <li>Do not use Student Data for commercial purposes or advertising</li>
          </ul>
        </div>

        <div className={styles.section}>
          <p className={styles.sectionTitle}>6. Student Data and Parental Responsibility</p>
          <p className={styles.body}>Parents who register student accounts consent to data collection as described in our Privacy Policy. Parents may request deletion of their child data at any time — we process valid requests within 30 days. We do not knowingly allow any person under 18 to create an independent account.</p>
        </div>

        <div className={styles.section}>
          <p className={styles.sectionTitle}>7. Intellectual Property</p>
          <p className={styles.body}>All Platform content is the exclusive property of Gilowinc Investment. We grant you a limited, non-exclusive, non-transferable licence to use the Platform for educational management purposes during your Subscription. You retain ownership of all data you upload.</p>
        </div>

        <div className={styles.section}>
          <p className={styles.sectionTitle}>8. Data Ownership and Portability</p>
          <p className={styles.body}>Schools own their data. Upon termination we provide a data export within 30 days of written request. After 90 days we may permanently delete School data with advance notice. We will never sell or transfer School or Student Data to any third party for commercial purposes.</p>
        </div>

        <div className={styles.section}>
          <p className={styles.sectionTitle}>9. Limitation of Liability</p>
          <p className={styles.body}>To the maximum extent permitted by Kenyan law, Gilowinc Investment shall not be liable for indirect, incidental, or consequential damages. Our total aggregate liability shall not exceed the <strong>total Subscription fees paid by you in the three (3) months immediately preceding</strong> the event giving rise to the claim.</p>
        </div>

        <div className={styles.section}>
          <p className={styles.sectionTitle}>10. Disclaimers</p>
          <p className={styles.body}>The Platform is provided "as is" and "as available". We do not warrant uninterrupted or error-free operation. We are not responsible for educational outcomes or decisions made based on Platform data.</p>
        </div>

        <div className={styles.section}>
          <p className={styles.sectionTitle}>11. Termination</p>
          <p className={styles.body}>You may terminate your account at any time by contacting us. We may suspend or terminate your account immediately if you breach these Terms, if required by law, or if your account poses a risk to student safety.</p>
        </div>

        <div className={styles.section}>
          <p className={styles.sectionTitle}>12. Changes to These Terms</p>
          <p className={styles.body}>We will notify users by email at least 14 days before material changes take effect. Continued use after the effective date constitutes acceptance.</p>
        </div>

        <div className={styles.section}>
          <p className={styles.sectionTitle}>13. Governing Law and Disputes</p>
          <p className={styles.body}>These Terms are governed by the laws of Kenya. Disputes shall first be referred to mediation. If mediation fails within 30 days, disputes shall be submitted to the exclusive jurisdiction of the courts of Nairobi, Kenya.</p>
        </div>

        <div className={styles.section}>
          <p className={styles.sectionTitle}>Contact</p>
          <div className={styles.contactBox}>
            <p className={styles.contactLine}>Gilowinc Investment · BN-KYCZ73AZ</p>
            <p className={styles.contactLine}>Nairobi, Kenya</p>
            <p className={styles.contactLine}>gilowincinvestment@gmail.com</p>
            <p className={styles.contactLine}>+254 720 614664 · +254 732 227603</p>
          </div>
        </div>

        <p className={styles.footer}>© 2026 Gilowinc Investment · BN-KYCZ73AZ · Nairobi, Kenya</p>
      </div>
    </div>
  )
}
