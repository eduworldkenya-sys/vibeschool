import type { Metadata } from 'next'
import Link from 'next/link'
import { PublicHeader } from '@/components/public/PublicHeader'
import { PublicFooter } from '@/components/public/PublicFooter'

export const metadata: Metadata = {
  title: 'Privacy Policy | VibeSchool',
  description: 'How VibeSchool collects, uses and protects personal information, including learner information.',
}

const sections = [
  ['overview','Overview'],['collect','Information we collect'],['why','Why we use information'],['children','Children and learners'],['sharing','Sharing and access'],['security','Security'],['retention','Retention'],['rights','Your rights'],['transfers','International processing'],['cookies','Cookies and analytics'],['changes','Changes'],['contact','Contact']
] as const

export default function PrivacyPage(){
  return <div style={{minHeight:'100vh',background:'#f7f7fb',color:'#171720'}}>
    <PublicHeader product="Privacy" />
    <main id="main-content" style={{width:'min(1080px,100%)',margin:'0 auto',padding:'64px 18px 20px'}}>
      <Link href="/legal" style={{fontSize:13,fontWeight:800,color:'#4f46e5',textDecoration:'none'}}>← Trust & policies</Link>
      <p style={{margin:'28px 0 0',fontSize:11,fontWeight:850,letterSpacing:'.16em',color:'#725815'}}>VIBESCHOOL PRIVACY</p>
      <h1 style={{margin:'10px 0 0',fontSize:'clamp(40px,7vw,66px)',letterSpacing:'-.045em',lineHeight:1.02}}>Privacy should be understandable.</h1>
      <p style={{maxWidth:760,margin:'20px 0 0',fontSize:18,lineHeight:1.7,color:'#606071'}}>This policy explains what personal information VibeSchool uses, why it is needed, who may access it and the rights available to users and families.</p>
      <p style={{marginTop:14,fontSize:12,color:'#7a7a89'}}>Effective 27 May 2026 · Last updated 17 August 2026</p>

      <section aria-label="Privacy at a glance" style={{marginTop:34,display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(220px,1fr))',gap:12}}>
        {[
          ['We do not sell personal data','VibeSchool does not sell learner or user personal information.'],
          ['No behavioural advertising to learners','Learner personal information is not used for behavioural advertising.'],
          ['Children receive additional protection','Child data requires stronger authority, consent and best-interest safeguards.'],
          ['You have rights','Applicable access, correction, objection, restriction, deletion and portability rights can be requested.'],
        ].map(([title,body])=><article key={title} style={{padding:20,border:'1px solid #dfe0e7',borderRadius:18,background:'#fff'}}><strong style={{fontSize:15}}>{title}</strong><p style={{margin:'7px 0 0',fontSize:13,lineHeight:1.55,color:'#666676'}}>{body}</p></article>)}
      </section>

      <div style={{display:'grid',gridTemplateColumns:'minmax(190px,240px) minmax(0,1fr)',gap:42,alignItems:'start',marginTop:54}} className="legal-layout">
        <nav aria-label="Privacy policy contents" style={{position:'sticky',top:98,padding:'18px',border:'1px solid #e0e1e8',borderRadius:16,background:'#fff'}}>
          <strong style={{fontSize:12,letterSpacing:'.08em'}}>ON THIS PAGE</strong>
          <div style={{display:'grid',gap:8,marginTop:12}}>{sections.map(([id,label])=><a key={id} href={`#${id}`} style={{fontSize:13,color:'#575767',textDecoration:'none'}}>{label}</a>)}</div>
        </nav>
        <article style={{minWidth:0}}>
          <Section id="overview" title="1. Overview"><p>VibeSchool provides learning, teaching, parent, pathway and school services. For data-protection purposes, VibeSchool is operated by Gilowinc Investment in Kenya. This operator identification is provided for legal transparency; VibeSchool is the public-facing service and brand.</p><p>We aim to collect only information needed for a defined purpose and to make important uses of personal information clear before collection.</p></Section>
          <Section id="collect" title="2. Information we collect"><p><strong>Account and profile information:</strong> information such as name, email or service identity, role, country and profile information where a feature requires it.</p><p><strong>School and learning information:</strong> school membership, classes, subjects, curriculum activity, attendance, assignments, assessments, evidence and progress records.</p><p><strong>Learner information:</strong> information connected to a learner record, including school identifiers, class membership, learning activity, progress and pathway activity where used.</p><p><strong>Service and security information:</strong> authentication events, technical information, support requests and security/audit records needed to operate and protect the service.</p></Section>
          <Section id="why" title="3. Why we use information"><p>We use personal information to provide and secure accounts, connect authorised learners and adults, deliver learning and school workflows, provide support, investigate technical or security issues, and meet applicable legal obligations. Each processing purpose must have an appropriate lawful basis.</p></Section>
          <Section id="children" title="4. Children and learners"><p>Children require additional protection. Where Kenyan law requires parent or guardian consent for processing a child’s personal data, VibeSchool must obtain and record that authority before relying on consent for the processing. Child-data processing must protect and advance the child’s rights and best interests.</p><p>Access to learner information is intended to be limited by authorised relationship and role. Learner-facing experiences should not turn ordinary acceptance of platform terms into a substitute for consent where specific parental or guardian consent is legally required.</p></Section>
          <Section id="sharing" title="5. Sharing and access"><p>We do not sell personal data. Information may be made available to authorised school users, linked parents or guardians, assigned educators, service providers that help operate VibeSchool, or public authorities where disclosure is lawfully required. Access should be limited to the minimum relationship and purpose needed.</p></Section>
          <Section id="security" title="6. Security"><p>VibeSchool uses technical and organisational controls including authenticated access, role and relationship checks, database access controls, encryption in transit and audit/security controls where applicable. No online system can guarantee absolute security, so controls are reviewed as the platform changes.</p></Section>
          <Section id="retention" title="7. Retention"><p>Personal information is kept only for as long as reasonably necessary for the purpose for which it was collected, to maintain required educational or transactional records, resolve disputes or meet legal obligations. Retention periods may differ by record type. Information that is no longer required should be deleted or irreversibly de-identified according to the applicable retention rules.</p></Section>
          <Section id="rights" title="8. Your rights"><p>Subject to applicable law, users may request access to personal data about them, correction of inaccurate information, objection or restriction in qualifying circumstances, deletion where applicable, portability where available, or withdrawal of consent where processing relies on consent. Rights relating to a minor may be exercised by a person with appropriate parental authority or guardianship after the relationship and identity are verified.</p></Section>
          <Section id="transfers" title="9. International processing"><p>VibeSchool uses technology and cloud service providers to operate the platform. Personal information may therefore be processed outside Kenya. Cross-border processing must use an appropriate lawful basis and safeguards required by applicable Kenyan data-protection law.</p></Section>
          <Section id="cookies" title="10. Cookies and analytics"><p>VibeSchool uses essential browser storage and session mechanisms needed for authentication, security and core product operation. If optional analytics or advertising-related tracking is introduced, the relevant notice and controls must be updated before that tracking is enabled.</p></Section>
          <Section id="changes" title="11. Changes"><p>We may update this policy when VibeSchool’s services, legal obligations or data practices change. The current version and its update date will be published on this page.</p></Section>
          <Section id="contact" title="12. Contact"><p>Privacy questions and rights requests can be started through the <Link href="/contact">VibeSchool Contact page</Link>. You may also raise a complaint with Kenya’s Office of the Data Protection Commissioner where applicable.</p></Section>
          <aside style={{marginTop:38,padding:20,borderRadius:16,background:'#efeff7',fontSize:13,lineHeight:1.65,color:'#555565'}}>Legal transparency note: Kenyan data-protection rules require data subjects to be informed about matters including the identity and contact details of the data controller or processor in relevant circumstances. VibeSchool therefore does not treat removal of all operator identification as a privacy feature; instead, legal operator information is kept limited and non-promotional.</aside>
        </article>
      </div>
      <style>{`@media(max-width:760px){.legal-layout{grid-template-columns:1fr!important}.legal-layout nav{position:static!important}}`}</style>
    </main>
    <PublicFooter />
  </div>
}

function Section({id,title,children}:{id:string,title:string,children:React.ReactNode}){
  return <section id={id} style={{scrollMarginTop:100,padding:'0 0 38px',borderBottom:'1px solid #e1e2e8',marginBottom:34}}><h2 style={{margin:'0 0 12px',fontSize:25,letterSpacing:'-.02em'}}>{title}</h2><div style={{color:'#565667',fontSize:15,lineHeight:1.75}}>{children}</div></section>
}
