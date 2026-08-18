import type { Metadata } from 'next'
import Link from 'next/link'
import { PublicHeader } from '@/components/public/PublicHeader'
import { PublicFooter } from '@/components/public/PublicFooter'
import { SchoolBusinessCaseBuilder } from '@/components/public/SchoolBusinessCaseBuilder'

export const metadata: Metadata={
  alternates:{canonical:'/institutions/business-case'},
  title:'School Business Case Builder | VibeSchool',
  description:'Turn your school’s own workload assumptions into a bounded VibeSchool pilot business case without invented savings or pricing claims.',
}

const diligence=[
  ['Problem & scope','Which exact school workflow is being improved, who uses it, and what is explicitly outside the first deployment?'],
  ['Baseline & success','What is measured before implementation, what target justifies expansion, and what would make the school stop or revise the pilot?'],
  ['Data & authority','Which learner/staff/family data is required, who may access it, and how are role/relationship boundaries tested?'],
  ['Implementation','What must be configured or migrated, who owns training/support, and what is the rollback or exit path?'],
  ['Reliability','Which devices, browsers, connectivity and offline scenarios must work for the selected workflow?'],
  ['Commercials','What exactly is priced, what support is included, what changes at scale, and which assumptions are still unvalidated?'],
] as const

export default function SchoolBusinessCasePage(){return <div className="page"><PublicHeader product="School Business Case"/><main id="main-content">
<section className="hero"><div className="wrap"><Link href="/institutions" className="back">← VibeSchool for schools</Link><p className="eyebrow">BUSINESS CASE BUILDER</p><h1>Make the first pilot easier to justify — and easier to reject if it does not work.</h1><p className="lead">A strong school business case exposes its assumptions. Use your own workload baseline to define a small pilot, the capacity you hope to recover and the evidence required before wider adoption.</p></div></section>
<section className="section wrap"><p className="eyebrow dark">YOUR SCHOOL · YOUR ASSUMPTIONS</p><h2>Quantify the fragmentation worth testing.</h2><SchoolBusinessCaseBuilder/></section>
<section className="section alt"><div className="wrap"><p className="eyebrow dark">BUYER DUE DILIGENCE</p><h2>A headteacher needs more than a feature list.</h2><div className="grid">{diligence.map(([title,body])=><article key={title}><h3>{title}</h3><p>{body}</p></article>)}</div></div></section>
<section className="section wrap"><div className="two"><div><p className="eyebrow dark">PUBLIC / INSTITUTIONAL PROCUREMENT</p><h2>Use the buyer’s procurement process, not a VibeSchool shortcut.</h2></div><div><p>Where a school or institution is subject to public procurement requirements, its procurement team should use the current applicable rules, tender documents and electronic procurement process. VibeSchool's business-case builder does not replace procurement, legal, finance or data-protection review.</p><div className="links"><a href="https://ppra.go.ke/standard-tender-documents/" target="_blank" rel="noopener noreferrer">PPRA standard tender documents ↗</a><a href="https://ppra.go.ke/circulars/" target="_blank" rel="noopener noreferrer">PPRA current circulars ↗</a><a href="https://www.odpc.go.ke/guidelines-2/" target="_blank" rel="noopener noreferrer">ODPC guidance, including education sector ↗</a></div></div></div></section>
<section className="cta"><div className="wrap"><h2>Bring a measurable problem, not a blank cheque.</h2><p>Use the output to discuss one bounded workflow with VibeSchool. Pricing and scope should follow the verified deployment need, not precede it.</p><Link href="/contact">Discuss the pilot →</Link></div></section>
</main><PublicFooter/><style>{styles}</style></div>}

const styles=`.page{background:#f8f8f5;color:#101827;font-family:var(--font-jakarta),Arial,sans-serif;line-height:1.7}.page *{box-sizing:border-box}.wrap{max-width:1120px;margin:auto}.hero{background:#07111f;color:#fff;padding:82px 24px}.back{color:#c5cfda;text-decoration:none;font-weight:750}.eyebrow{font:850 11px var(--font-mono);letter-spacing:.15em;color:#d0b154;margin-top:30px}.eyebrow.dark{color:#755b17}h1,h2{font-family:var(--font-display),Arial,sans-serif;letter-spacing:-.04em;line-height:1.06}h1{font-size:clamp(42px,5.8vw,70px);max-width:920px;margin:12px 0 22px}h2{font-size:clamp(31px,4.3vw,48px);margin:9px 0 26px}.lead{font-size:18px;color:#c5cfda;max-width:800px}.section{padding:80px 24px}.alt{background:#eeeae0}.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}.grid article{background:#fff;border:1px solid #dedbd2;border-radius:14px;padding:21px}.grid h3{margin:0}.grid p,.two p{color:#5d6673}.two{display:grid;grid-template-columns:1fr 1fr;gap:64px}.links{display:grid;gap:8px;margin-top:18px}.links a{color:#654f13;font-weight:800}.cta{background:#13243a;color:#fff;padding:62px 24px}.cta h2{font-size:32px;margin:0}.cta p{color:#c5cfda}.cta a{color:#e1c56d;font-weight:850;text-decoration:none}@media(max-width:760px){.hero,.section{padding:60px 18px}.grid,.two{grid-template-columns:1fr}.two{gap:15px}}`
