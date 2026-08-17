import type { Metadata } from 'next'
import Link from 'next/link'
import { PublicHeader } from '@/components/public/PublicHeader'
import { PublicFooter } from '@/components/public/PublicFooter'
import { CapabilityStatus } from '@/components/public/CapabilityStatus'

export const metadata: Metadata = {
  alternates:{canonical:'/product'},
  title: 'Product | VibeSchool',
  description: 'Explore how VibeSchool connects curriculum, teaching, learning, evidence, assessment, families, school operations and Pathways in one Kenyan education system.',
}

const pillars = [
  {title:'Teach from the curriculum, not around it',audience:'TEACHERS',items:['Curriculum-aware planning','Schemes of work','Lesson planning','Attendance and classroom activity','Homework and exercises','Assessment, evidence and reflection'],body:'The teacher workspace is designed so planning, teaching, evidence and follow-up belong to one instructional flow instead of separate paperwork.'},
  {title:'Give every learner a continuing learning place',audience:'LEARNERS',items:['Learning resources','Practice and assessment','Progress and mastery','Revision and next actions','Senior School Pathways','Personalised learning support'],body:'A learner should not restart from zero every time they open a resource. VibeSchool is designed to carry forward what has been learned, attempted and evidenced.'},
  {title:'Help families understand, not just receive reports',audience:'FAMILIES',items:['Progress context','Learning summaries','Attendance visibility','Teacher/school communication','Pathways support','Relevant school information'],body:'Family access is designed around the learner relationship, with context that can support learning without exposing teacher-only or administrative workspaces.'},
  {title:'Run the school while keeping learning visible',audience:'SCHOOLS',items:['Academic oversight','Learner and class context','Reports and evidence','Family communication','Finance and school operations','Governance and role authority'],body:'Institutional tools should reduce operational fragmentation while preserving a clear line from school activity back to teaching and learner outcomes.'},
]

const chain = [
  ['Curriculum','What should be learned'],['Scheme','What is planned'],['Lesson','What is intended for the teaching moment'],['Teaching','What actually happens'],['Evidence','What the learner produces or demonstrates'],['Assessment','How evidence is interpreted'],['Understanding','What appears strong, developing or uncertain'],['Next action','What should happen next'],
]

const comparisons = [
  ['Curriculum as a separate document','Curriculum context carried into planning and teaching'],
  ['Lesson plan as the endpoint','Lesson plan connected to the teaching occurrence and evidence'],
  ['Marks as the whole learner story','Evidence and assessment contributing to cautious learner understanding'],
  ['End-term visibility only','Continuing progress context where the evidence and permissions support it'],
  ['One generic portal for everyone','Role-appropriate learner, teacher, family and school experiences'],
  ['Career guidance as a separate destination','Pathways connected to learning context and future progression'],
]

const proof = [
  ['Teacher workspace','Classes, academics, lesson planning, attendance, homework, assessment and supporting teaching workflows are represented as connected product areas.'],
  ['Learner learning system','Learning resources, progress, practice, adaptive support and future-direction workflows are designed around the learner rather than around a single content file.'],
  ['Family relationship','Family experiences are designed around authorised learner relationships, communication and understandable learning context.'],
  ['Institutional system','Academic, operational, finance, reporting and governance capabilities sit behind role-aware school relationships rather than a public all-access dashboard.'],
  ['Pathways','Senior School pathways, tracks, subject combinations, careers and school-offering information are treated as an evidence-sensitive decision journey.'],
  ['Trust boundary','Public exploration is deliberately separated from private learner and school information, with role authority and evidence provenance treated as product requirements.'],
]

export default function ProductPage() {
  return <div className="product-page"><PublicHeader product="Product"/><main id="main-content">
    <section className="hero"><div className="wrap"><p className="eyebrow">THE VIBESCHOOL PRODUCT</p><h1>One education system, not another collection of school apps.</h1><p className="lead">VibeSchool connects the work before a lesson, the learning during and after it, the evidence that follows, the people supporting the learner, and the decisions that come next.</p><div className="actions"><Link className="primary" href="/global">Explore learning</Link><Link className="secondary" href="/institutions">For schools</Link><Link className="text" href="/pathways">Explore Pathways →</Link></div></div></section>

    <section className="section wrap"><p className="eyebrow dark">THE CONNECTED LEARNING CHAIN</p><h2>What happens next should depend on what happened before.</h2><p className="intro">When curriculum intent, teaching activity, learner evidence and the next educational action live in separate systems, people must reconstruct the story manually. VibeSchool is designed to preserve those relationships.</p><div className="chain">{chain.map(([title,body],i)=><div className="chainItem" key={title}><span>{String(i+1).padStart(2,'0')}</span><h3>{title}</h3><p>{body}</p></div>)}</div></section>

    <section className="section alt"><div className="wrap"><p className="eyebrow dark">ONE SYSTEM · DIFFERENT RESPONSIBILITIES</p><h2>Each person gets the right workspace around the same learner journey.</h2><div className="pillars">{pillars.map(pillar=><article key={pillar.audience} className="pillar"><span className="audience">{pillar.audience}</span><h3>{pillar.title}</h3><p>{pillar.body}</p><ul>{pillar.items.map(item=><li key={item}>{item}</li>)}</ul></article>)}</div></div></section>

    <section className="section compare"><div className="wrap"><p className="eyebrow dark">WHY VIBESCHOOL IS DESIGNED DIFFERENTLY</p><h2>Compare the operating model, not the module count.</h2><p className="intro">These are design choices, not claims that every school currently operates this way on VibeSchool. The goal is to remove educational hand-offs where context is usually lost.</p><div className="comparisons">{comparisons.map(([from,to])=><article key={from}><span>DISCONNECTED APPROACH</span><p>{from}</p><b>↓</b><span>VIBESCHOOL DIRECTION</span><h3>{to}</h3></article>)}</div></div></section>

    <section className="section darkSection"><div className="wrap"><p className="eyebrow">PRODUCT PROOF, WITHOUT FABRICATED CLAIMS</p><h2>Show the system that actually exists.</h2><p className="intro light">VibeSchool should earn confidence through inspectable product structure, real pilot evidence and truthful demonstrations — not inflated school counts or invented testimonials.</p><div className="proof">{proof.map(([title,body])=><article key={title}><h3>{title}</h3><p>{body}</p></article>)}</div></div></section>

    <CapabilityStatus/>

    <section className="section wrap"><div className="two"><div><p className="eyebrow dark">FOR SCHOOLS</p><h2>Evaluate VibeSchool as an educational system, not just an ERP.</h2></div><div><p>Inspect academics, learner progress, family relationships, operations, governance and Pathways together. Adoption can start with a bounded workflow and expand only after value is proven.</p><div className="actions"><Link className="primary" href="/institutions">Institutional overview</Link><Link className="outline" href="/contact">Discuss a pilot</Link></div></div></div></section>
  </main><PublicFooter/><style>{styles}</style></div>
}

const styles = `.product-page{background:#f7f7fb;color:#111827;font-family:var(--font-jakarta),Arial,sans-serif;line-height:1.65}.product-page *{box-sizing:border-box}.wrap{width:min(1120px,100%);margin:auto}.hero{padding:92px 20px 100px;background:radial-gradient(circle at 78% 14%,rgba(79,70,229,.18),transparent 28%),linear-gradient(180deg,#f6f5ff 0%,#fff 100%)}.eyebrow{font-size:11px;letter-spacing:.16em;font-weight:900;color:#c6a84d}.eyebrow.dark{color:#71591a}h1,h2{font-family:var(--font-display),Arial,sans-serif;letter-spacing:-.045em;line-height:1.04}h1{font-size:clamp(46px,7vw,78px);max-width:900px;margin:14px 0 22px}h2{font-size:clamp(32px,4.7vw,54px);margin:10px 0 22px;max-width:880px}.lead,.intro{max-width:820px;color:#5f6370;font-size:18px}.actions{display:flex;gap:12px;align-items:center;flex-wrap:wrap;margin-top:28px}.actions a{display:inline-flex;align-items:center;justify-content:center;min-height:46px;padding:0 18px;border-radius:12px;text-decoration:none;font-weight:850;font-size:14px}.primary{background:#4f46e5;color:#fff}.secondary,.outline{background:#fff;color:#1b1d27;border:1px solid #d8dae3}.text{color:#4f46e5!important;padding-left:4px!important}.section{padding:86px 20px}.alt{background:#efefe9}.chain{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-top:34px}.chainItem{background:#fff;border:1px solid #e0e1e8;border-radius:18px;padding:22px;min-height:185px}.chainItem span,.audience{font-size:10px;letter-spacing:.15em;font-weight:900;color:#725915}.chainItem h3{font-size:21px;margin:12px 0 7px}.chainItem p,.pillar p,.proof p,.two p{color:#646875;margin:0}.pillars{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-top:34px}.pillar{background:#fff;border:1px solid #dcdedc;border-radius:20px;padding:28px}.pillar h3{font-size:27px;line-height:1.15;margin:12px 0}.pillar ul{display:grid;grid-template-columns:1fr 1fr;gap:8px 18px;margin:22px 0 0;padding-left:18px;color:#343744}.compare{background:#f7f7fb}.comparisons{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-top:34px}.comparisons article{background:#fff;border:1px solid #dfe1e7;border-radius:18px;padding:24px}.comparisons span{display:block;font-size:10px;letter-spacing:.12em;font-weight:900;color:#80651f}.comparisons p{color:#6b6f7a;margin:7px 0}.comparisons b{display:block;color:#4f46e5;font-size:22px;margin:4px 0}.comparisons h3{font-size:20px;line-height:1.3;margin:7px 0 0}.darkSection{background:#0b0b14;color:#fff}.light{color:rgba(255,255,255,.67)}.proof{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-top:34px}.proof article{padding:24px;border:1px solid rgba(255,255,255,.12);border-radius:18px;background:rgba(255,255,255,.03)}.proof h3{margin:0 0 9px;font-size:20px}.proof p{color:rgba(255,255,255,.64)}.two{display:grid;grid-template-columns:1fr 1fr;gap:64px;align-items:start}.outline{color:#20222b!important}@media(max-width:900px){.chain{grid-template-columns:1fr 1fr}.proof,.comparisons{grid-template-columns:1fr 1fr}}@media(max-width:700px){.hero,.section{padding:64px 18px}.chain,.pillars,.proof,.comparisons,.two{grid-template-columns:1fr}.pillar ul{grid-template-columns:1fr}.actions{align-items:stretch}.primary,.secondary,.outline{width:100%}.text{width:auto}.two{gap:18px}}`
