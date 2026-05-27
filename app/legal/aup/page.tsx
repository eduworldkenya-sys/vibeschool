'use client'
import { useRouter } from 'next/navigation'
import styles from '../legal.module.css'

export default function AupPage() {
  const router = useRouter()
  return (
    <div className={styles.root}>
      <div className={styles.content}>
        <button className={styles.back} onClick={() => router.back()}>← Back</button>
        <p className={styles.badge}>Gilowinc Investment · BN-KYCZ73AZ</p>
        <h1 className={styles.title}>Acceptable Use Policy</h1>
        <p className={styles.meta}>Effective: 27 May 2026 &nbsp;·&nbsp; Last updated: 27 May 2026</p>
        <div className={styles.divider} />
        <div className={styles.section}>
          <p className={styles.sectionTitle}>1. Purpose</p>
          <p className={styles.body}>This Policy sets out standards of conduct for all VibeSchool users — Teachers, Administrators, Parents, and any person with Platform access. Violation is grounds for immediate suspension or termination without refund.</p>
        </div>
        <div className={styles.section}>
          <p className={styles.sectionTitle}>2. General Standards</p>
          <ul className={styles.list}>
            <li>Use the Platform honestly and in good faith</li>
            <li>Respect the privacy and dignity of all students, parents, and staff</li>
            <li>Keep login credentials confidential</li>
            <li>Report suspected security breaches to gilowincinvestment@gmail.com immediately</li>
            <li>Comply with the Basic Education Act 2013, Data Protection Act 2019, and Computer Misuse and Cybercrimes Act 2018</li>
          </ul>
        </div>
        <div className={styles.section}>
          <p className={styles.sectionTitle}>3. Teachers</p>
          <ul className={styles.list}>
            <li>Only access data for assigned students</li>
            <li>Mark attendance accurately and promptly</li>
            <li>Not share student data or media outside the Platform without parental consent</li>
            <li>Use VibeConnect for professional school-related communication only</li>
            <li>Not solicit money, gifts, or favours from parents through the Platform</li>
            <li>Not upload inappropriate, offensive, or misleading content</li>
          </ul>
        </div>
        <div className={styles.section}>
          <p className={styles.sectionTitle}>4. School Administrators</p>
          <ul className={styles.list}>
            <li>Only add verified, employed staff to the Platform</li>
            <li>Immediately revoke access for staff who leave</li>
            <li>Not collect fees outside any officially sanctioned module</li>
            <li>Ensure school use complies with TSC and Ministry of Education regulations</li>
            <li>Not share school subdomain codes with unauthorised persons</li>
          </ul>
        </div>
        <div className={styles.section}>
          <p className={styles.sectionTitle}>5. Parents</p>
          <ul className={styles.list}>
            <li>Only register their own children</li>
            <li>Provide accurate student information</li>
            <li>Use VibeConnect for legitimate school-related communication only</li>
            <li>Not harass, threaten, or abuse teachers or administrators</li>
            <li>Not attempt to access another family's data</li>
            <li>Supervise their child's use of student-facing features</li>
          </ul>
        </div>
        <div className={styles.section}>
          <p className={styles.sectionTitle}>6. Prohibited Content</p>
          <ul className={styles.list}>
            <li>Sexual, violent, or graphic content of any kind</li>
            <li>Content that sexualises, exploits, or endangers children</li>
            <li>Hate speech targeting any person based on race, religion, gender, disability, or ethnicity</li>
            <li>Defamatory statements about any individual or institution</li>
            <li>Spam, phishing, or fraudulent communications</li>
            <li>Political campaigning or commercial advertising</li>
            <li>Copyright-infringing material</li>
          </ul>
          <p className={styles.body}>Prohibited content will be removed immediately and the account suspended. Violations may be reported to Kenyan authorities.</p>
        </div>
        <div className={styles.section}>
          <p className={styles.sectionTitle}>7. VibeConnect Messaging</p>
          <p className={styles.body}>School-related communication only. All messages subject to safety monitoring. Users must not contact students directly, send bulk messages, share others' contact details without consent, or conduct personal business through the Platform.</p>
        </div>
        <div className={styles.section}>
          <p className={styles.sectionTitle}>8. Reporting Violations</p>
          <p className={styles.body}>Report violations immediately. We investigate within 5 business days. Reporters may remain anonymous.</p>
          <div className={styles.contactBox}>
            <p className={styles.contactLine}>gilowincinvestment@gmail.com</p>
            <p className={styles.contactLine}>+254 720 614664 · +254 732 227603</p>
          </div>
        </div>
        <div className={styles.section}>
          <p className={styles.sectionTitle}>9. Enforcement</p>
          <p className={styles.body}>Violations may result in a formal warning, temporary suspension, permanent termination without refund, or referral to law enforcement where criminal conduct is suspected.</p>
        </div>
        <p className={styles.footer}>© 2026 Gilowinc Investment · BN-KYCZ73AZ · Nairobi, Kenya</p>
      </div>
    </div>
  )
}
