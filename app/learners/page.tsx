import type { Metadata } from 'next'
import Link from 'next/link'
import { PublicHeader } from '@/components/public/PublicHeader'
import { PublicFooter } from '@/components/public/PublicFooter'

export const metadata: Metadata = {
  title: 'VibeSchool for Learners | Learn, practise, understand, progress',
  description: 'Explore VibeSchool for learners: learning resources, practice, evidence, progress, next actions and Senior School Pathways in one continuing learning experience.',
}

const loop = [
  ['01','Learn','Use curriculum-connected resources and explanations.'],
  ['02','Practise','Attempt exercises and learning tasks rather than only reading.'],
  ['03','Show','Create evidence through work, submissions and assessment.'],
  ['04','Understand','See what appears strong and where more support is needed.'],
  ['05','Act','Revise, practise, ask for help or take the next learning action.'],
  ['06','Progress','Carry useful learning context forward instead of starting from zero.'],
]

const experiences = [
  ['Learning library','Explore educational resources through VibeSchool’s public learning environment.'],
  ['Practice & assessment','Move from consuming information to demonstrating understanding.'],
  ['Progress & mastery','Build a clearer picture of what has been learned and what still needs work.'],
  ['Personalised support','Use learner context to make support more relevant while keeping important decisions appropriately bounded.'],
  ['Senior School Pathways','Explore pathways, tracks, subject combinations, careers and school information for future-direction decisions.'],
  ['Connected school learning','Where a learner belongs to a participating school or class, classroom activity can contribute to the wider learning story under appropriate authority.'],
]

export default function LearnersPage(){return <div className="page"><PublicHeader product="Learners"/><main id="main-content">
<section className="hero"><div className="wrap"><p className="eyebrow">VIBESCHOOL FOR LEARNERS</p><h1>Don’t just finish the lesson. Know what to do next.</h1><p className="lead">VibeSchool is designed as a continuing learning place: learn, practise, show what you understand, see what needs attention and move forward with better context.</p><div className="actions"><Link className="primary" href="/global">Start learning</Link><Link className="secondary" href="/pathways/check">Try Pathways Quick Check</Link></div></div></section>
<section className="section wrap"><p className="eyebrow dark">THE LEARNING LOOP</p><h2>Learning should create the next useful action.</h2><div className="loop">{loop.map(([n,t,d])=><article key={n}><span>{n}</span><h3>{t}</h3><p>{d}</p></article>)}</div></section>
<section className="section alt"><div className="wrap"><p className="eyebrow dark">ONE LEARNER · CONNECTED EXPERIENCES</p><h2>Resources are only one part of learning.</h2><p className="intro">The stronger product is not the one with the longest content list. It is the one that helps the learner turn content, practice and evidence into understanding and progress.</p><div className="grid">{experiences.map(([t,d])=><article key={t}><h3>{t}</h3><p>{d}</p></article>)}</div></div></section>
<section className="section dark"><div className="wrap two"><div><p className="eyebrow">SENIOR SCHOOL PATHWAYS</p><h2>Explore your direction with evidence, not a label.</h2></div><div><p className="light">Pathways guidance should help a learner explore possibilities without pretending a quick check can decide their future. VibeSchool separates guidance from placement and keeps uncertainty visible.</p><div className="actions"><Link className="gold" href="/pathways">Explore Pathways</Link><Link className="darkLink" href="/learn/careers">Explore careers</Link></div></div></div></section>
<section className="section wrap"><div className="two"><div><p className="eyebrow dark">BUILT AROUND THE LEARNER</p><h2>Your learning history should become useful context.</h2></div><div><p className="intro">VibeSchool’s direction is to connect curriculum, classroom activity, learning resources, practice, evidence and assessment into a learner state that can support better next actions. It should not quietly make consequential educational decisions for the learner.</p><div className="actions"><Link className="primary" href="/product">See the full system</Link><Link className="outline" href="/trust/responsible-ai">Responsible AI</Link></div></div></div></section>
</main><PublicFooter/><style>{styles}</style></div>}

const styles=`.page{background:#f7f8fc;color:#111827;font-family:var(--font-jakarta),Arial,sans-serif;line-height:1.7}.page *{box-sizing:border-box}.wrap{width:min(1120px,100%);margin:auto}.hero{padding:92px 22px 100px;background:radial-gradient(circle at 82% 15%,rgba(89,80,220,.2),transparent 30%),linear-gradient(180deg,#f2f1ff,#fff)}.eyebrow{font:900 11px var(--font-mono),monospace;letter-spacing:.15em;color:#6358d5}.eyebrow.dark{color:#4d43b6}h1,h2{font-family:var(--font-display),Arial,sans-serif;letter-spacing:-.045em;line-height:1.04}h1{font-size:clamp(44px,6.6vw,76px);max-width:900px;margin:14px 0 22px}h2{font-size:clamp(32px,4.5vw,52px);margin:10px 0 22px;max-width:850px}.lead,.intro{max-width:820px;color:#626777;font-size:18px}.actions{display:flex;gap:11px;flex-wrap:wrap;margin-top:27px}.actions a{display:inline-flex;align-items:center;justify-content:center;min-height:46px;padding:0 18px;border-radius:11px;text-decoration:none;font-weight:850}.primary{background:#4f46d8;color:#fff}.secondary,.outline{background:#fff;color:#252838;border:1px solid #d8dae5}.section{padding:86px 22px}.loop{display:grid;grid-template-columns:repeat(6,1fr);gap:8px;margin-top:32px}.loop article{background:#fff;border:1px solid #e0e2eb;border-radius:16px;padding:20px;min-height:190px}.loop span{font:900 10px var(--font-mono);color:#6258d2}.loop h3{font-size:20px;margin:12px 0 7px}.loop p,.grid p{color:#656a79;margin:0;font-size:14px}.alt{background:#ececf5}.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:13px;margin-top:32px}.grid article{background:#fff;border:1px solid #dedfe8;border-radius:18px;padding:25px;min-height:200px}.grid h3{margin:0 0 9px;font-size:21px}.dark{background:#10111c;color:#fff}.two{display:grid;grid-template-columns:1fr 1fr;gap:68px}.light{color:#b9bbca;font-size:17px}.gold{background:#d7b55b;color:#11131c}.darkLink{border:1px solid #494b59;color:#fff}@media(max-width:980px){.loop{grid-template-columns:repeat(3,1fr)}.grid{grid-template-columns:1fr 1fr}}@media(max-width:700px){.hero,.section{padding:62px 18px}.loop,.grid,.two{grid-template-columns:1fr}.two{gap:18px}.primary,.secondary,.outline{width:100%}}`
