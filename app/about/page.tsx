import Link from "next/link"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "About VibeSchool",
  description: "Discover VibeSchool — an Education Operating System designed to connect curriculum, teaching, evidence, understanding and better decisions around every learner.",
  openGraph: {
    title: "About VibeSchool — Learning, connected",
    description: "VibeSchool brings the people, curriculum, teaching and evidence around a learner into one connected education experience.",
  },
}

const audiences = [
  ["For learners", "A place where learning can become clearer, more structured and more personal — with resources and guidance that help you understand, practise and grow."],
  ["For teachers", "Less time searching, rebuilding and piecing together information. More support for planning, teaching, observing evidence and deciding what a learner needs next."],
  ["For parents", "A clearer window into learning. VibeSchool is designed to help home and school move from occasional updates to a better shared understanding of the child."],
  ["For schools", "A connected operating layer for the work that surrounds learning — helping people, curriculum, evidence and decisions work together instead of living in disconnected systems."],
]

const principles = [
  ["The learner comes first", "Technology is useful only when it improves the learning experience and the decisions made around a learner."],
  ["Evidence before assumptions", "A learner insight should be traceable to real educational evidence. VibeSchool is designed to help people see what happened, understand it and act responsibly."],
  ["AI should assist, not invent", "VibeSchool's intelligence is intended to support teachers, learners, parents and schools — not fabricate educational reality or replace human responsibility."],
  ["Curriculum matters", "Learning is not a pile of disconnected content. VibeSchool is built around curriculum alignment and the progression of learning."],
  ["Connection is the point", "Teachers, learners, parents and schools should not have to operate as separate islands when they are all working toward the same learner's growth."],
  ["Real conditions matter", "Android, low-bandwidth, offline and printable workflows are treated as first-class needs, not afterthoughts."],
]

export default function AboutPage() {
  return (
    <main className="about-page">
      <section className="about-hero">
        <div className="about-nav">
          <Link href="/" className="about-brand">VibeSchool</Link>
          <nav aria-label="About navigation">
            <Link href="/about">About</Link>
            <Link href="/contact">Contact</Link>
            <Link href="/legal/privacy">Privacy</Link>
          </nav>
        </div>
        <div className="about-hero-inner">
          <p className="eyebrow">THE EDUCATION OPERATING SYSTEM</p>
          <h1>Education works better when <em>everyone can see the same learner.</em></h1>
          <p className="hero-copy">VibeSchool exists because education can become fragmented. A teacher sees one part. A parent sees another. A learner experiences another. School records, curriculum, resources and evidence can live in different places. The result is often more work, less visibility and decisions made with incomplete context.</p>
          <p className="hero-copy strong">VibeSchool is built to connect those pieces — turning curriculum into coordinated teaching, teaching into evidence, evidence into understanding, and understanding into better decisions for every learner.</p>
          <div className="hero-actions"><Link href="/" className="primary-action">Explore VibeSchool</Link><Link href="/contact" className="secondary-action">Talk to us</Link></div>
        </div>
      </section>

      <section className="about-section problem-section">
        <div className="section-label">THE PROBLEM WE CARE ABOUT</div>
        <div className="two-column">
          <div><h2>The problem isn't a lack of effort. It's a lack of connection.</h2></div>
          <div><p>Teachers are working. Parents care. Learners are trying. Schools are coordinating. Yet the systems around them can make good work harder than it needs to be.</p><p>A lesson may happen without the next person knowing what the learner understood. A parent may want to help but lack useful context. A teacher may spend valuable time searching for resources or reconstructing information that already exists somewhere else. A school may have data without a clear path from that data to action.</p><p><strong>VibeSchool is designed around that gap.</strong> Not simply to put more software into a school, but to make the educational journey more connected, visible and actionable.</p></div>
        </div>
      </section>

      <section className="about-section dark-section">
        <div className="section-label">WHAT VIBESCHOOL IS</div>
        <h2>One connected education experience — from curriculum to decision.</h2>
        <p className="section-intro">VibeSchool is an Education Operating System. At its core, it is designed to coordinate the work around learning rather than treating every task as an isolated application.</p>
        <div className="journey">
          <div><span>01</span><strong>Curriculum</strong><p>Know what should be taught and how learning progresses.</p></div>
          <div><span>02</span><strong>Teaching</strong><p>Turn curriculum into real, dated teaching and learning experiences.</p></div>
          <div><span>03</span><strong>Evidence</strong><p>Capture what actually happened and what the learner demonstrated.</p></div>
          <div><span>04</span><strong>Understanding</strong><p>Make evidence useful instead of leaving it as disconnected records.</p></div>
          <div><span>05</span><strong>Better decisions</strong><p>Help the people responsible decide what should happen next.</p></div>
        </div>
      </section>

      <section className="about-section">
        <div className="section-label">WHO IT IS FOR</div>
        <h2>Different people. One shared purpose.</h2>
        <p className="section-intro">A child's education does not belong to one screen. VibeSchool is designed to respect the different responsibilities of the people who make learning possible.</p>
        <div className="audience-grid">{audiences.map(([title, text]) => <article key={title}><h3>{title}</h3><p>{text}</p></article>)}</div>
      </section>

      <section className="about-section feature-section">
        <div className="section-label">THE VIBESCHOOL ECOSYSTEM</div>
        <div className="two-column"><div><h2>Built as a system, not a collection of disconnected features.</h2></div><div><p>VibeSchool brings together the operating needs around education: school operations, teacher work, learner experiences, parent engagement, curriculum and learning resources.</p><p>Its long-term vision includes dedicated experiences such as Teacher OS, Learner OS, Parent OS, School OS, Publisher OS, VibeLearn, VibeTextbook and VibeTwin — connected through shared educational objects and evidence rather than parallel versions of the same truth.</p></div></div>
      </section>

      <section className="about-section dark-section">
        <div className="section-label">VIBETWIN</div>
        <div className="two-column"><div><h2>Intelligence with responsibility.</h2></div><div><p>VibeTwin is VibeSchool's context-aware intelligence layer. It is designed to interpret trusted educational evidence, recommend the next responsible action and support the people working with a learner.</p><p>The principle is simple: <strong>AI can help people think and act better, but it should never fabricate educational reality.</strong> Learner insights should remain traceable to evidence, and human responsibility remains central.</p></div></div>
      </section>

      <section className="about-section principles-section">
        <div className="section-label">WHAT WE BELIEVE</div>
        <h2>Technology should earn its place in education.</h2>
        <div className="principles">{principles.map(([title, text], i) => <article key={title}><span>0{i + 1}</span><div><h3>{title}</h3><p>{text}</p></div></article>)}</div>
      </section>

      <section className="about-section trust-section">
        <div className="section-label">A DIFFERENT KIND OF PROMISE</div>
        <h2>We don't want VibeSchool to become another system people are forced to feed.</h2>
        <p>We want it to become a system that gives something back: clearer context, less unnecessary work, better communication, stronger evidence and more useful decisions.</p>
        <p>That means we build deliberately. One authoritative object per concept. Shared domain authority. Traceable learner insights. Curriculum alignment. Security boundaries. And verification before we call something done.</p>
        <p className="closing-line">Because behind every record, lesson, assessment and dashboard is a real learner whose future matters.</p>
      </section>

      <section className="about-cta">
        <p className="eyebrow">LEARNING, CONNECTED</p>
        <h2>See what VibeSchool can do for your learning community.</h2>
        <p>Start exploring, bring your questions, or tell us where your current education workflow is getting in the way.</p>
        <div className="hero-actions"><Link href="/" className="primary-action">Explore VibeSchool</Link><Link href="/contact" className="secondary-action">Contact VibeSchool</Link></div>
      </section>

      <footer className="about-footer"><span>© VibeSchool</span><div><Link href="/about">About</Link><Link href="/contact">Contact</Link><Link href="/legal/privacy">Privacy</Link><Link href="/legal/terms">Terms</Link><Link href="/legal/aup">Acceptable Use</Link></div></footer>

      <style>{styles}</style>
    </main>
  )
}

const styles = `
.about-page{font-family:var(--font-jakarta),Arial,sans-serif;color:#111827;background:#f7f6f2;line-height:1.7}.about-page *{box-sizing:border-box}.about-hero{background:#05050f;color:#fff;padding:0 24px 110px}.about-nav{max-width:1180px;margin:auto;height:78px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid rgba(255,255,255,.1)}.about-brand{font-family:var(--font-display),Arial,sans-serif;font-size:24px;font-weight:800;color:#fff;text-decoration:none}.about-nav nav{display:flex;gap:26px}.about-nav nav a,.about-footer a{color:rgba(255,255,255,.7);text-decoration:none;font-size:14px}.about-nav nav a:hover,.about-footer a:hover{color:#fff}.about-hero-inner{max-width:1000px;margin:90px auto 0}.eyebrow,.section-label{font-family:var(--font-mono),monospace;letter-spacing:.18em;font-size:11px;font-weight:700}.eyebrow{color:#c8a84b}.about-hero h1{font-family:var(--font-display),Arial,sans-serif;font-size:clamp(46px,7vw,82px);line-height:1.02;letter-spacing:-.045em;max-width:980px;margin:20px 0 30px;font-weight:600}.about-hero h1 em{font-family:var(--font-serif),Georgia,serif;color:#c8a84b;font-weight:400}.hero-copy{font-size:18px;line-height:1.8;max-width:790px;color:rgba(255,255,255,.68);margin:14px 0}.hero-copy.strong{color:rgba(255,255,255,.92);font-weight:600}.hero-actions{display:flex;gap:12px;flex-wrap:wrap;margin-top:32px}.primary-action,.secondary-action{display:inline-flex;align-items:center;padding:13px 20px;border-radius:8px;text-decoration:none;font-weight:700;font-size:14px}.primary-action{background:#c8a84b;color:#05050f}.secondary-action{border:1px solid rgba(255,255,255,.25);color:#fff}.about-section{max-width:1180px;margin:auto;padding:110px 24px}.section-label{color:#9a7b2f;margin-bottom:20px}.dark-section{max-width:none;background:#0a0a16;color:#fff;padding-left:max(24px,calc((100vw - 1132px)/2));padding-right:max(24px,calc((100vw - 1132px)/2))}.dark-section .section-label{color:#c8a84b}.about-section h2,.about-cta h2{font-family:var(--font-display),Arial,sans-serif;font-size:clamp(34px,5vw,58px);line-height:1.08;letter-spacing:-.035em;margin:0 0 25px;font-weight:600}.two-column{display:grid;grid-template-columns:1fr 1fr;gap:80px}.two-column p,.section-intro{font-size:17px;color:#5b6472;max-width:680px}.dark-section .two-column p,.dark-section .section-intro{color:rgba(255,255,255,.62)}.journey{display:grid;grid-template-columns:repeat(5,1fr);margin-top:55px;border-top:1px solid rgba(255,255,255,.13)}.journey>div{padding:25px 20px 0 0;border-right:1px solid rgba(255,255,255,.1)}.journey>div:not(:first-child){padding-left:20px}.journey span{font-family:var(--font-mono);font-size:11px;color:#c8a84b}.journey strong{display:block;font-size:19px;margin:13px 0 5px}.journey p{color:rgba(255,255,255,.55);font-size:14px}.audience-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:1px;background:#ddd8cc;margin-top:45px}.audience-grid article{background:#f7f6f2;padding:38px}.audience-grid h3,.principles h3{font-size:20px;margin:0 0 10px}.audience-grid p,.principles p,.trust-section>p{color:#5b6472;margin:0}.feature-section{background:#eeece5;max-width:none;padding-left:max(24px,calc((100vw - 1132px)/2));padding-right:max(24px,calc((100vw - 1132px)/2))}.principles{display:grid;grid-template-columns:repeat(2,1fr);gap:0 70px;margin-top:40px}.principles article{display:grid;grid-template-columns:42px 1fr;gap:12px;padding:28px 0;border-top:1px solid #d8d4c9}.principles span{font-family:var(--font-mono);font-size:11px;color:#9a7b2f}.trust-section{max-width:900px}.trust-section>p{font-size:18px;line-height:1.85}.trust-section .closing-line{font-family:var(--font-serif),Georgia,serif;font-size:30px;color:#111827;margin-top:40px}.about-cta{background:#c8a84b;color:#05050f;text-align:center;padding:100px 24px}.about-cta .eyebrow{color:#65521f}.about-cta h2{max-width:800px;margin:15px auto}.about-cta>p:not(.eyebrow){max-width:620px;margin:0 auto;color:#413714}.about-cta .primary-action{background:#05050f;color:#fff}.about-cta .secondary-action{border-color:rgba(5,5,15,.35);color:#05050f}.about-cta .hero-actions{justify-content:center}.about-footer{background:#05050f;color:#fff;display:flex;justify-content:space-between;gap:20px;flex-wrap:wrap;padding:28px max(24px,calc((100vw - 1132px)/2));font-size:13px}.about-footer div{display:flex;gap:22px}@media(max-width:800px){.about-nav nav{gap:12px}.about-nav nav a:nth-child(3){display:none}.about-hero{padding-bottom:80px}.about-hero-inner{margin-top:65px}.two-column,.principles{grid-template-columns:1fr;gap:35px}.journey{grid-template-columns:1fr 1fr}.journey>div{border-bottom:1px solid rgba(255,255,255,.1)}.audience-grid{grid-template-columns:1fr}.about-section{padding-top:75px;padding-bottom:75px}.about-footer{flex-direction:column}.about-footer div{flex-wrap:wrap}}
`
