"use client";
'use client'
import { useRouter } from 'next/navigation'
import styles from '../legal.module.css'

export default function PrivacyPage() {
  const router = useRouter()
  return (
    <div className={styles.root}>
      <div className={styles.content}>
        <button className={styles.back} onClick={() => router.back()}>← Back</button>
        <p className={styles.badge}>Gilowinc Investment · BN-KYCZ73AZ</p>
        <h1 className={styles.title}>Privacy Policy</h1>
        <p className={styles.meta}>Effective: 27 May 2026 &nbsp;·&nbsp; Last updated: 27 May 2026</p>
        <div className={styles.divider} />
        <div className={styles.section}>
          <p className={styles.sectionTitle}>1. Introduction</p>
          <p className={styles.body}>Gilowinc Investment operates VibeSchool and is committed to protecting the privacy of all users, with particular care for children, in compliance with the <strong>Kenya Data Protection Act 2019</strong>.</p>
        </div>
        <div className={styles.section}>
          <p className={styles.sectionTitle}>2. Data We Collect</p>
          <p className={styles.body}><strong>Account Data:</strong> full name, email, phone, role, country, date of birth, profile photo, Google account details.</p>
          <p className={styles.body}><strong>School Data:</strong> school name, location, staff lists, timetable and class configurations.</p>
          <p className={styles.body}><strong>Student Data (parent-managed):</strong> name, admission number, gender, class, attendance, CBC results, homework, photos, claim codes.</p>
          <p className={styles.body}><strong>Usage Data:</strong> login timestamps, device info, pages visited, error logs.</p>
          <p className={styles.body}><strong>Communications Data:</strong> VibeConnect messages, circulars, notifications.</p>
        </div>
        <div className={styles.section}>
          <p className={styles.sectionTitle}>3. How We Use Your Data</p>
          <ul className={styles.list}>
            <li>Providing and operating the Platform</li>
            <li>Authenticating users and securing accounts</li>
            <li>Displaying student progress to authorised users only</li>
            <li>Sending service notifications</li>
            <li>Processing Subscription payments</li>
            <li>Improving the Platform through anonymised analytics</li>
            <li>Complying with Kenyan legal obligations</li>
            <li>Responding to support requests</li>
          </ul>
          <p className={styles.body}><strong>We do not use Student Data for advertising, profiling, or any commercial purpose unrelated to the educational management of that student.</strong></p>
        </div>
        <div className={styles.section}>
          <p className={styles.sectionTitle}>4. Legal Basis for Processing</p>
          <p className={styles.body}><strong>Consent</strong> (student registration, optional features); <strong>Contract</strong> (Subscription obligations); <strong>Legitimate interests</strong> (security, fraud prevention); <strong>Legal obligation</strong> (Kenyan law).</p>
        </div>
        <div className={styles.section}>
          <p className={styles.sectionTitle}>5. Children's Data</p>
          <p className={styles.body}>All student accounts are parent-managed with explicit parental consent at registration. We do not knowingly collect data from children under 18 without verifiable parental consent. Student Data is only accessible to the linked parent, assigned teachers, the School Administrator, and Gilowinc Investment staff where necessary for support. <strong>Student Data is never shared with other schools, advertisers, or any commercial entity.</strong></p>
        </div>
        <div className={styles.section}>
          <p className={styles.sectionTitle}>6. Data Storage and Security</p>
          <p className={styles.body}>Data is stored on <strong>Supabase</strong> (SOC 2 Type II, US servers) and hosted on <strong>Vercel</strong> (US infrastructure). By using VibeSchool you consent to this cross-border transfer. We implement Row-Level Security on all database tables, HTTPS encryption in transit, Google OAuth 2.0, and two-factor authentication on administrative accounts. In the event of a breach we will notify affected users within <strong>72 hours</strong> per the Kenya Data Protection Act 2019.</p>
        </div>
        <div className={styles.section}>
          <p className={styles.sectionTitle}>7. Data Retention</p>
          <table className={styles.table}>
            <thead><tr><th>Data Type</th><th>Retention Period</th></tr></thead>
            <tbody>
              <tr><td>Active account data</td><td>Duration of Subscription</td></tr>
              <tr><td>Student Data</td><td>Until deletion requested or 90 days after School termination</td></tr>
              <tr><td>Usage / log data</td><td>12 months</td></tr>
              <tr><td>Payment records</td><td>7 years (legal requirement)</td></tr>
              <tr><td>Deleted account data</td><td>Purged within 30 days of request</td></tr>
            </tbody>
          </table>
        </div>
        <div className={styles.section}>
          <p className={styles.sectionTitle}>8. Data Sharing</p>
          <p className={styles.body}>We do not sell your data. We share only with: <strong>Service providers</strong> (Supabase, Vercel, Google — bound by data processing agreements); <strong>Legal authorities</strong> where compelled by Kenyan law; <strong>School administrators</strong> for users within their school only.</p>
        </div>
        <div className={styles.section}>
          <p className={styles.sectionTitle}>9. Your Rights</p>
          <p className={styles.body}>Under the Kenya Data Protection Act 2019 you may access, correct, delete, object to, or port your data, and withdraw consent at any time. Contact <strong>gilowincinvestment@gmail.com</strong> — we respond within 21 days. Complaints may be lodged with the <strong>Office of the Data Protection Commissioner</strong> at <a href="https://www.odpc.go.ke" target="_blank" rel="noopener noreferrer">www.odpc.go.ke</a>.</p>
        </div>
        <div className={styles.section}>
          <p className={styles.sectionTitle}>10. Cookies</p>
          <p className={styles.body}>Essential session cookies for authentication only. No advertising or third-party tracking cookies.</p>
        </div>
        <div className={styles.section}>
          <p className={styles.sectionTitle}>11. Changes</p>
          <p className={styles.body}>Material changes notified by email at least 14 days before taking effect. Continued use constitutes acceptance.</p>
        </div>
        <div className={styles.section}>
          <p className={styles.sectionTitle}>12. Contact</p>
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
