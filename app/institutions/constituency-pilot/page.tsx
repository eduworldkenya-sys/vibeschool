import type { Metadata } from 'next'
import Link from 'next/link'
import { PublicHeader } from '@/components/public/PublicHeader'
import { PublicFooter } from '@/components/public/PublicFooter'

export const metadata: Metadata = {
  alternates: { canonical: '/institutions/constituency-pilot' },
  title: 'Constituency Education Pilot | VibeSchool',
  description: 'A measurable 90-day VibeSchool education-access pilot for Kenyan constituencies, with transparent reporting, consent and child-safeguarding controls.',
}

const scorecard = [
  ['School coverage', 'Participating schools active in the agreed pilot workflow.'],
  ['Learner activation', 'Eligible learners who complete consent-aware onboarding.'],
  ['Learning engagement', 'Meaningful lessons, practice and assessment activity — not page views alone.'],
  ['Parent communication', 'Delivered notifications where a lawful basis, consent and verified relationship exist.'],
  ['Cost per activated learner', 'Approved pilot spend divided by verified learner activations.'],
  ['Learning evidence', 'Progress and misconception signals reported in aggregate, without exposing individual learner data.'],
] as const

const timeline = [
  ['Days 1–15', 'Baseline & setup', 'Confirm schools, learners, devices, authority, consent, safeguarding and the starting learning baseline.'],
  ['Days 16–45', 'Guided launch', 'Onboard the first cohort, support teachers and learners, and repair adoption barriers before expansion.'],
  ['Days 46–75', 'Measured delivery', 'Run the agreed learning workflow and report verified activation, engagement and support signals.'],
  ['Days 76–90', 'Evidence decision', 'Compare results with the baseline and recommend scale, repair or stop using transparent evidence.'],
] as const

const boundaries = [
  'No sale or transfer of learner or parent contact data to political actors.',
  'No campaign messaging inside a learner’s educational experience.',
  'No public claim that a projection is a verified result.',
  'No expansion before the agreed evidence and safeguarding gates pass.',
] as const

export default function ConstituencyPilotPage() {
  return <div className="page"><PublicHeader product="Constituency Pilot"/><main id="main-content">
    <section className="hero"><div className="wrap heroGrid"><div><Link href="/institutions" className="back">← Institutions & government</Link><p className="eyebrow gold">90-DAY CONSTITUENCY EDUCATION PILOT · KENYA</p><h1>Fund measurable learning access — with evidence the public can question.</h1><p className="lead">VibeSchool proposes a bounded education pilot that helps a constituency reach learners, support participating schools and measure real learning activity. Sponsorship is visible; learner and family data remain protected.</p><div className="actions"><Link className="primary" href="/contact">Discuss a pilot</Link><a className="secondary" href="#scorecard">Review the scorecard</a></div></div><aside className="decision"><span>THE DECISION</span><strong>Approve one 90-day pilot</strong><p>Scope, budget and targets are confirmed only after the constituency baseline is verified.</p><div className="seal">Measured<br/>Reversible<br/>Accountable</div></aside></div></section>

    <section className="section"><div className="wrap"><p className="eyebrow">THE OFFER</p><h2>One public problem. One controlled pilot. One evidence pack.</h2><div className="three"><article><b>01 · Reach</b><h3>Bring learning closer</h3><p>Give an agreed cohort mobile access to curriculum-aligned learning and practice, with school participation defined before launch.</p></article><article><b>02 · Support</b><h3>Help adoption succeed</h3><p>Onboard schools and learners, monitor barriers and provide bounded support throughout the pilot.</p></article><article><b>03 · Prove</b><h3>Report what happened</h3><p>Separate verified results from projections and show coverage, activation, engagement, cost and next-step evidence.</p></article></div></div></section>

    <section className="dark" id="scorecard"><div className="wrap"><p className="eyebrow light">PUBLIC ACCOUNTABILITY SCORECARD</p><h2>Measure the journey, not applause.</h2><p className="intro pale">Every target starts as a labelled planning assumption. It becomes a result only after VibeSchool can verify it from the agreed pilot evidence.</p><div className="score">{scorecard.map(([title, body], index)=><article key={title}><span>{String(index+1).padStart(2,'0')}</span><div><h3>{title}</h3><p>{body}</p></div></article>)}</div><div className="flow" aria-label="Pilot measurement funnel"><span>Eligible learners</span><i>→</i><span>Invited</span><i>→</i><span>Activated</span><i>→</i><span>Meaningfully engaged</span><i>→</i><span>Learning evidence</span></div></div></section>

    <section className="section sand"><div className="wrap"><p className="eyebrow">90-DAY DELIVERY PLAN</p><h2>Designed to stop, repair or scale.</h2><div className="timeline">{timeline.map(([days,title,body])=><article key={days}><span>{days}</span><h3>{title}</h3><p>{body}</p></article>)}</div></div></section>

    <section className="section"><div className="wrap trust"><div><p className="eyebrow">TRUST ARCHITECTURE</p><h2>Education sponsorship is not permission to harvest families.</h2><p className="intro">Political recognition can be transparent and bounded — for example, acknowledging the office that funded access. It must not become covert campaigning, a private contact list or a shortcut around child-safety and data-protection duties.</p><div className="actions"><Link className="outline" href="/trust/child-safety">Child safety</Link><Link className="outline" href="/legal/privacy">Privacy</Link></div></div><div className="boundary">{boundaries.map(item=><p key={item}><span>✓</span>{item}</p>)}</div></div></section>

    <section className="cta"><div className="wrap ctaGrid"><div><p className="eyebrow light">START WITH VERIFIED LOCAL TRUTH</p><h2>Bring the constituency. We will build the measurable pilot case.</h2><p>VibeSchool will replace planning assumptions with verified school coverage, learner scope, delivery cost, success gates and a 90-day accountability plan.</p></div><Link href="/contact">Discuss the constituency pilot →</Link></div></section>
  </main><PublicFooter/><style>{styles}</style></div>
}

const styles = `.page{background:#f7f6f1;color:#102035;font-family:var(--font-jakarta),Arial,sans-serif;line-height:1.65}.page *{box-sizing:border-box}.wrap{max-width:1160px;margin:auto}.hero{background:#08182b;color:#fff;padding:78px 24px 72px;border-bottom:7px solid #d3ad3b}.heroGrid{display:grid;grid-template-columns:minmax(0,1fr) 310px;gap:58px;align-items:end}.back{color:#bfccd9;text-decoration:none;font-weight:800}.eyebrow{font:850 11px var(--font-mono);letter-spacing:.16em;color:#765b10;margin:0 0 12px}.gold{color:#e5c86b;margin-top:34px}.light{color:#e5c86b}h1,h2,h3{font-family:var(--font-display),Arial,sans-serif;line-height:1.04;letter-spacing:-.035em}h1{font-size:clamp(43px,6.4vw,76px);max-width:850px;margin:12px 0 24px}h2{font-size:clamp(32px,4.6vw,52px);max-width:850px;margin:8px 0 22px}.lead,.intro{font-size:18px;max-width:820px}.lead,.pale{color:#c7d1dd}.actions{display:flex;flex-wrap:wrap;gap:11px;margin-top:28px}.primary,.secondary,.outline{display:inline-block;padding:13px 18px;border-radius:7px;font-weight:850;text-decoration:none}.primary{background:#e0bf54;color:#142033}.secondary{border:1px solid #52667d;color:#fff}.outline{border:1px solid #a7a290;color:#25354a}.decision{background:#102944;border:1px solid #38506a;padding:25px;border-radius:8px;box-shadow:18px 18px 0 #d3ad3b}.decision>span{font:800 10px var(--font-mono);letter-spacing:.14em;color:#e5c86b}.decision strong{display:block;font-size:25px;margin:9px 0}.decision p{color:#c7d1dd}.seal{border-top:1px solid #38506a;margin-top:22px;padding-top:18px;text-transform:uppercase;letter-spacing:.12em;font-weight:900;font-size:12px;line-height:1.8}.section,.dark,.cta{padding:82px 24px}.three{display:grid;grid-template-columns:repeat(3,1fr);gap:14px}.three article{background:#fff;border:1px solid #dcd8ca;border-top:4px solid #d3ad3b;padding:25px}.three b{font:800 11px var(--font-mono);color:#755b17}.three h3{font-size:25px;margin:16px 0 10px}.three p,.timeline p,.boundary p{color:#5f6874}.dark{background:#0c2036;color:#fff}.score{display:grid;grid-template-columns:repeat(2,1fr);gap:1px;background:#334a61;border:1px solid #334a61;margin-top:34px}.score article{background:#102944;padding:22px;display:grid;grid-template-columns:44px 1fr;gap:12px}.score article>span{color:#e5c86b;font:900 15px var(--font-mono)}.score h3{margin:0 0 6px;font-size:21px}.score p{color:#bfccd9;margin:0}.flow{display:flex;align-items:center;justify-content:center;flex-wrap:wrap;gap:10px;margin-top:35px}.flow span{border:1px solid #52667d;border-radius:999px;padding:9px 13px;font-weight:800;font-size:13px}.flow i{color:#e5c86b;font-style:normal}.sand{background:#ece8dc}.timeline{display:grid;grid-template-columns:repeat(4,1fr);gap:12px}.timeline article{background:#f9f8f3;border-top:5px solid #173553;padding:22px}.timeline span{font:850 12px var(--font-mono);color:#755b17}.timeline h3{font-size:22px;margin:16px 0 8px}.trust{display:grid;grid-template-columns:1.1fr .9fr;gap:60px}.boundary{background:#fff;border:1px solid #dcd8ca;padding:24px}.boundary p{display:grid;grid-template-columns:25px 1fr;gap:9px;margin:0;padding:15px 0;border-bottom:1px solid #e6e2d7}.boundary p:last-child{border-bottom:0}.boundary span{color:#75600f;font-weight:900}.cta{background:#173553;color:#fff}.ctaGrid{display:grid;grid-template-columns:1fr auto;gap:35px;align-items:center}.cta h2{margin-bottom:12px}.cta p{color:#c7d1dd;max-width:800px}.cta a{background:#e0bf54;color:#142033;padding:15px 20px;text-decoration:none;font-weight:900;border-radius:7px}@media(max-width:800px){.hero,.section,.dark,.cta{padding:58px 18px}.heroGrid,.trust,.ctaGrid{grid-template-columns:1fr}.decision{box-shadow:10px 10px 0 #d3ad3b}.three,.timeline,.score{grid-template-columns:1fr}.cta a{justify-self:start}.flow{justify-content:flex-start}}`
