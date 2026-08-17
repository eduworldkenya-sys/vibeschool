import type { Metadata } from 'next'
import Link from 'next/link'
import { PublicHeader } from '@/components/public/PublicHeader'
import { PublicFooter } from '@/components/public/PublicFooter'

export const metadata: Metadata = { title:'Acceptable Use | VibeSchool', description:'Rules for safe, respectful and lawful use of VibeSchool.' }

export default function AupPage(){
  return <div style={{minHeight:'100vh',background:'#f7f7fb',color:'#171720'}}>
    <PublicHeader product="Acceptable Use" />
    <main id="main-content" style={{width:'min(900px,100%)',margin:'0 auto',padding:'64px 18px 20px'}}>
      <Link href="/legal" style={{fontSize:13,fontWeight:800,color:'#4f46e5',textDecoration:'none'}}>← Trust & policies</Link>
      <p style={{margin:'28px 0 0',fontSize:11,fontWeight:850,letterSpacing:'.16em',color:'#725815'}}>SAFE USE OF VIBESCHOOL</p>
      <h1 style={{margin:'10px 0 0',fontSize:'clamp(40px,7vw,64px)',letterSpacing:'-.045em',lineHeight:1.02}}>Acceptable Use Policy</h1>
      <p style={{maxWidth:720,margin:'18px 0 0',fontSize:17,lineHeight:1.7,color:'#606071'}}>VibeSchool is used by learners, teachers, families and institutions. These rules exist to protect people first, especially children, and to keep learning and school information trustworthy.</p>
      <p style={{marginTop:14,fontSize:12,color:'#7a7a89'}}>Effective 27 May 2026 · Last updated 17 August 2026</p>

      <Rule title="1. Use VibeSchool honestly"><ul><li>Use only accounts, learner records, schools and roles you are authorised to access.</li><li>Do not impersonate another person or falsely claim a school, parent, teacher or learner relationship.</li><li>Do not attempt to bypass security, access controls, rate limits or safety mechanisms.</li><li>Do not upload malware, phishing material or content intended to disrupt the service.</li></ul></Rule>
      <Rule title="2. Learners and students"><ul><li>Do not share passwords, one-time codes or another learner’s private information.</li><li>Do not use VibeSchool to bully, threaten, exploit or harass another person.</li><li>Do not attempt to manipulate assessments, marks, evidence, attendance or school records.</li><li>AI-supported learning tools may help you understand and practise, but they must not be used to misrepresent work as your own where a teacher or assessment requires independent work.</li><li>Report content or behaviour that makes you feel unsafe or that appears to endanger another learner.</li></ul></Rule>
      <Rule title="3. Teachers and educators"><ul><li>Access learner information only where your role and assignment authorise it.</li><li>Keep educational records accurate and do not alter evidence to create a misleading record.</li><li>Do not share learner information outside authorised channels without a valid purpose and authority.</li><li>Use communication features professionally and do not exploit a learner or family relationship for personal gain.</li></ul></Rule>
      <Rule title="4. Parents and guardians"><ul><li>Only claim or manage learner relationships you are legally or appropriately authorised to manage.</li><li>Do not attempt to access another family’s information.</li><li>Use communication channels respectfully and for legitimate learning, welfare or school purposes.</li><li>Supervise learner use where required by age, product flow or applicable law.</li></ul></Rule>
      <Rule title="5. Schools and administrators"><ul><li>Grant access only to people whose school role has been appropriately verified.</li><li>Remove or change access when a person’s authority changes.</li><li>Do not use learner, staff or family information for unrelated commercial or political purposes.</li><li>Do not present unofficial or unverified information as if it were an official VibeSchool or government record.</li></ul></Rule>
      <Rule title="6. Prohibited content"><ul><li>Child sexual exploitation or abuse material, sexualisation or grooming of children.</li><li>Credible threats, targeted harassment, hate speech or incitement to violence.</li><li>Fraud, phishing, credential theft or malicious code.</li><li>Content that unlawfully exposes another person’s private information.</li><li>Copyright-infringing material where the user has no right or lawful basis to provide it.</li></ul></Rule>
      <Rule title="7. Data extraction and automation"><p>Do not scrape, bulk-extract or systematically copy user, school or learner information in a way that bypasses intended product access or violates privacy, contractual or legal restrictions. Approved integrations and public information interfaces may have their own limits.</p></Rule>
      <Rule title="8. Reporting and enforcement"><p>Potential violations can be reported through the <Link href="/contact">VibeSchool Contact page</Link>. VibeSchool may warn, restrict, suspend or terminate access when reasonably necessary to protect people, investigate abuse, preserve evidence or comply with law. Serious suspected criminal conduct may be referred to the appropriate authorities.</p></Rule>
      <Rule title="9. Fair review"><p>Where practical and safe, a person whose access is restricted should receive an explanation and a route to request review. Immediate protective action may be taken first where learner safety, security or evidence preservation requires it.</p></Rule>
    </main>
    <PublicFooter />
  </div>
}

function Rule({title,children}:{title:string,children:React.ReactNode}){return <section style={{padding:'30px 0',borderBottom:'1px solid #e0e1e7'}}><h2 style={{fontSize:24,margin:'0 0 12px'}}>{title}</h2><div style={{fontSize:15,lineHeight:1.75,color:'#585868'}}>{children}</div></section>}
