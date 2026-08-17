import type { Metadata } from 'next'
import Link from 'next/link'
import { PublicHeader } from '@/components/public/PublicHeader'
import { PublicFooter } from '@/components/public/PublicFooter'

export const metadata: Metadata = {
  title: 'For Teachers | VibeSchool',
  description: 'See how VibeSchool connects curriculum, schemes of work, lesson planning, attendance, homework, assessment, evidence and learner follow-up for Kenyan teachers.',
}

const workflow = [
  ['Curriculum', 'Start from the learning outcomes and content that should guide the class.'],
  ['Scheme', 'Organise the term into a teachable sequence instead of rebuilding plans in isolation.'],
  ['Lesson', 'Prepare the lesson with the curriculum, class and intended evidence in view.'],
  ['Teach', 'Connect the planned lesson to the actual classroom occurrence and attendance.'],
  ['Evidence', 'Capture homework, exercises, submissions and other evidence of learning.'],
  ['Assess', 'Record what learners demonstrated, not just a detached mark.'],
  ['Respond', 'Use evidence, reflection and learner progress to decide what needs attention next.'],
]

const capabilities = [
  ['Schemes of work', 'Keep curriculum, term structure and teaching sequence connected.'],
  ['Lesson planning', 'Plan with the class, learning intention and evidence pathway in context.'],
  ['Attendance', 'Keep classroom participation connected to the teaching record.'],
  ['Homework & exercises', 'Create, collect and review learner work inside the same instructional system.'],
  ['Assessment', 'Connect assessment activity with learner evidence, progress and follow-up.'],
  ['Reflection & intervention', 'Record what happened, what needs reinforcement and what should happen next.'],
]

export default function TeachersPage(){return <div className="teacher-public"><PublicHeader product="Teachers"/><main id="main-content">
<section className="hero"><div className="wrap"><p className="eyebrow">VIBESCHOOL FOR TEACHERS</p><h1>Teach from the curriculum. Keep the evidence. Know what to do next.</h1><p className="lead">VibeSchool is designed to reduce the fragmentation around planning, classroom work, assessment and follow-up by keeping them inside one connected teaching journey.</p><div className="actions"><Link className="primary" href="/login/global?role=teacher">Enter teacher workspace</Link><Link className="secondary" href="/product">See the full product</Link></div></div></section>
<section className="section wrap"><p className="eyebrow dark">THE TEACHING FLOW</p><h2>Planning should not end when the lesson begins.</h2><p className="intro">The important question is not whether a document was generated. It is whether the plan, the classroom activity, the learner evidence and the next action stay connected.</p><div className="flow">{workflow.map(([t,d],i)=><article key={t}><span>{String(i+1).padStart(2,'0')}</span><h3>{t}</h3><p>{d}</p></article>)}</div></section>
<section className="section alt"><div className="wrap"><p className="eyebrow dark">WHAT THE WORKSPACE COVERS</p><h2>Core teacher work, organised around learning.</h2><div className="grid">{capabilities.map(([t,d])=><article key={t}><h3>{t}</h3><p>{d}</p></article>)}</div></div></section>
<section className="section dark"><div className="wrap two"><div><p className="eyebrow">WHY THIS MATTERS</p><h2>Less duplication. More instructional continuity.</h2></div><div><p>A scheme should inform a lesson. A lesson should create evidence. Evidence should inform assessment. Assessment should influence what the learner and teacher do next. VibeSchool is designed around that continuity rather than a collection of isolated teacher utilities.</p><div className="actions"><Link className="light" href="/login/global?role=teacher">Sign in as a teacher</Link><Link className="ghost" href="/contact">Talk to VibeSchool</Link></div></div></div></section>
</main><PublicFooter/><style>{styles}</style></div>}

const styles=`.teacher-public{background:#f7f7fb;color:#111827;font-family:var(--font-jakarta),Arial,sans-serif;line-height:1.65}.teacher-public *{box-sizing:border-box}.wrap{width:min(1120px,100%);margin:auto}.hero{padding:92px 20px 96px;background:radial-gradient(circle at 82% 12%,rgba(79,70,229,.17),transparent 30%),linear-gradient(180deg,#f5f4ff,#fff)}.eyebrow{font-size:11px;letter-spacing:.16em;font-weight:900;color:#c7a94d}.eyebrow.dark{color:#71591a}h1,h2{font-family:var(--font-display),Arial,sans-serif;letter-spacing:-.045em;line-height:1.04}h1{font-size:clamp(46px,7vw,76px);max-width:920px;margin:14px 0 22px}h2{font-size:clamp(32px,4.6vw,54px);max-width:840px;margin:10px 0 22px}.lead,.intro{max-width:820px;color:#626674;font-size:18px}.actions{display:flex;gap:12px;flex-wrap:wrap;margin-top:28px}.actions a{display:inline-flex;align-items:center;justify-content:center;min-height:46px;padding:0 18px;border-radius:12px;text-decoration:none;font-weight:850;font-size:14px}.primary{background:#4f46e5;color:white}.secondary{border:1px solid #d9dbe4;background:white;color:#1c1d27}.section{padding:84px 20px}.flow{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-top:34px}.flow article,.grid article{background:white;border:1px solid #e0e1e8;border-radius:18px;padding:23px}.flow span{font-size:10px;letter-spacing:.15em;font-weight:900;color:#725915}.flow h3,.grid h3{margin:10px 0 7px;font-size:21px}.flow p,.grid p,.two p{margin:0;color:#656976}.alt{background:#efefe9}.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-top:32px}.dark{background:#0b0b14;color:#fff}.two{display:grid;grid-template-columns:1fr 1fr;gap:64px}.two p{color:rgba(255,255,255,.67)}.light{background:white;color:#111827}.ghost{border:1px solid rgba(255,255,255,.24);color:white}@media(max-width:900px){.flow{grid-template-columns:1fr 1fr}.grid{grid-template-columns:1fr 1fr}}@media(max-width:700px){.hero,.section{padding:64px 18px}.flow,.grid,.two{grid-template-columns:1fr}.two{gap:18px}.actions{align-items:stretch}.primary,.secondary,.light,.ghost{width:100%}}`
