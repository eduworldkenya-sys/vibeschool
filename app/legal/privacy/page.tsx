"use client";
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
        <p className={styles.meta}>Effective: 27 May 2026 &nbsp;·&nbsp; Last updated: 14 August 2026</p>
        <div className={styles.divider} />

        <div className={styles.section}>
          <p className={styles.sectionTitle}>1. Introduction</p>
          <p className={styles.body}>Gilowinc Investment operates VibeSchool. We process personal data to provide learning, teaching, parent and school services and we give particular protection to information relating to children. This policy explains what we collect, why we use it, who may access it, and how you can exercise your rights.</p>
        </div>

        <div className={styles.section}>
          <p className={styles.sectionTitle}>2. Data We Collect</p>
          <p className={styles.body}><strong>Account data:</strong> information such as name, email or service identity, role, country and profile information where a feature requires it.</p>
          <p className={styles.body}><strong>School and learning data:</strong> school membership, classes, subjects, curriculum activity, attendance, learning evidence, assignments, assessment information and related records.</p>
          <p className={styles.body}><strong>Learner data:</strong> information connected to a learner record, including identifiers used by a school, class membership, learning activity and progress information.</p>
          <p className={styles.body}><strong>Service and security data:</strong> authentication events, device or technical information, support requests and security logs needed to operate and protect the service.</p>
        </div>

        <div className={styles.section}>
          <p className={styles.sectionTitle}>3. Why We Process Data</p>
          <ul className={styles.list}>
            <li>Provide and secure VibeSchool accounts and services</li>
            <li>Connect authorised learners, teachers, parents and schools</li>
            <li>Support teaching, learning, evidence and school workflows</li>
            <li>Provide support and investigate technical or security problems</li>
            <li>Meet applicable legal and regulatory obligations</li>
          </ul>
          <p className={styles.body}><strong>VibeSchool does not sell learner personal data or use learner personal data for behavioural advertising.</strong></p>
        </div>

        <div className={styles.section}>
          <p className={styles.sectionTitle}>4. Children's Data</p>
          <p className={styles.body}>Children require additional protection. Where Kenyan law requires parent or guardian consent for processing a child's personal data, VibeSchool must obtain and record the required authority before relying on consent for that processing. Access to learner information is limited by the user's authorised relationship and role. We do not permit direct-marketing profiling of children.</p>
        </div>

        <div className={styles.section}>
          <p className={styles.sectionTitle}>5. Data Storage and International Processing</p>
          <p className={styles.body}>VibeSchool uses technology service providers, including cloud infrastructure, to operate the platform. Personal data may therefore be processed outside Kenya. Cross-border processing must use a lawful transfer basis and appropriate safeguards required by applicable Kenyan data-protection law. We do not treat ordinary acceptance of this policy as a substitute for a specific consent where the law requires one.</p>
        </div>

        <div className={styles.section}>
          <p className={styles.sectionTitle}>6. Security</p>
          <p className={styles.body}>VibeSchool uses technical and organisational controls such as authenticated access, role and relationship checks, database access controls, encryption in transit and audit/security controls where applicable. No online system can guarantee absolute security, so controls are reviewed and strengthened as the platform changes.</p>
        </div>

        <div className={styles.section}>
          <p className={styles.sectionTitle}>7. Retention and Deletion</p>
          <p className={styles.body}>We keep personal data only for as long as it is reasonably needed for the purpose for which it was collected, to maintain required educational or transactional records, to resolve disputes, or to meet legal obligations. Retention periods may differ by record type. When data is no longer required, it should be deleted or irreversibly de-identified in accordance with the applicable retention schedule.</p>
        </div>

        <div className={styles.section}>
          <p className={styles.sectionTitle}>8. Sharing and Access</p>
          <p className={styles.body}>We do not sell personal data. Information may be available to authorised school users, linked parents or guardians, assigned teachers, service providers that help operate VibeSchool, or public authorities where disclosure is lawfully required. Access is intended to be limited to the minimum relationship and purpose required for the service.</p>
        </div>

        <div className={styles.section}>
          <p className={styles.sectionTitle}>9. Your Rights</p>
          <p className={styles.body}>Subject to applicable law, you may request access to personal data about you, correction of inaccurate information, deletion where applicable, restriction or objection to certain processing, data portability where available, or withdrawal of consent where processing relies on consent. A parent or guardian may exercise applicable rights for a child after the relationship and identity are appropriately verified.</p>
          <p className={styles.body}>Privacy requests can be sent to <strong>gilowincinvestment@gmail.com</strong>. You may also complain to Kenya's Office of the Data Protection Commissioner.</p>
        </div>

        <div className={styles.section}>
          <p className={styles.sectionTitle}>10. Cookies and Analytics</p>
          <p className={styles.body}>VibeSchool currently uses essential browser storage and session mechanisms needed for authentication, security and core product operation. Third-party analytics tracking is not loaded by the platform's global application shell at this time. If optional analytics or similar tracking is introduced, this policy and the relevant user controls must be updated before that tracking is enabled.</p>
        </div>

        <div className={styles.section}>
          <p className={styles.sectionTitle}>11. Changes</p>
          <p className={styles.body}>We may update this policy when VibeSchool's services, legal obligations or data practices change. The current version and its update date will be published here.</p>
        </div>

        <div className={styles.section}>
          <p className={styles.sectionTitle}>12. Contact</p>
          <div className={styles.contactBox}>
            <p className={styles.contactLine}>Gilowinc Investment · BN-KYCZ73AZ</p>
            <p className={styles.contactLine}>Nairobi, Kenya</p>
            <p className={styles.contactLine}>gilowincinvestment@gmail.com</p>
            <p className={styles.contactLine}>WhatsApp: +254 728 232 157</p>
          </div>
        </div>
        <p className={styles.footer}>© 2026 Gilowinc Investment · BN-KYCZ73AZ · Nairobi, Kenya</p>
      </div>
    </div>
  )
}
