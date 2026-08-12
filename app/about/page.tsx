import Link from "next/link"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "About VibeSchool",
  description: "VibeSchool connects curriculum, teaching, learning evidence and the people supporting a learner — so education can be clearer, more coordinated and more useful.",
  openGraph: {
    title: "About VibeSchool — Learning, connected",
    description: "A connected education experience for learners, teachers, parents and schools.",
  },
}

const audiences = [
  ["Learners", "Find learning in a clearer structure, practise with purpose and understand what to work on next — without feeling lost in a pile of resources."],
  ["Teachers", "Spend less time hunting for materials and reconstructing information. Plan, teach, observe evidence and focus your attention where it matters."],
  ["Parents", "Move beyond 'How was school today?' with a clearer picture of what your child is learning, where support may help and how home can reinforce school."],
  ["Schools", "Bring curriculum, people, learning activity and evidence into a more coordinated operating picture — without asking every team to work from disconnected systems."],
]

const principles = [
  ["The learner comes first", "Technology earns its place only when it improves learning or the decisions made around a learner."],
  ["Evidence before assumptions", "Useful insight should be connected to real educational evidence, not guesses dressed up as certainty."],
  ["AI assists people", "Intelligence should support teachers, learners, parents and schools — not fabricate educational reality or quietly replace human responsibility."],
  ["Curriculum matters", "Learning has sequence, context and purpose. VibeSchool is designed around curriculum alignment and progression."],
  ["Connection without overexposure", "The people supporting a learner need useful shared context, while access to learner information must still respect role and privacy."],
  ["Real conditions matter", "Mobile-first, low-bandwidth, offline and printable realities matter because education happens outside perfect internet and perfect offices."],
]

const faqs = [
  ["Is VibeSchool only for students?", "No. It is designed around the wider learning community: learners, teachers, parents and schools, with different experiences and responsibilities for each."],
  ["Is VibeSchool just a library of notes and past papers?", "Resources are part of the experience, but the broader vision is much bigger: connecting curriculum, teaching, evidence, learner understanding and decisions."],
  ["Does VibeSchool replace teachers?", "No. The product is designed to support human judgement. Teachers remain responsible for teaching, interpretation and decisions about learners."],
  ["Can a school use VibeSchool without changing everything at once?", "The goal is to make adoption practical. Different parts of the platform can serve different needs, while the underlying model keeps the educational picture connected."],
]

export default function AboutPage() {
  return (
    <main className="about-page">
      <section className="about-hero">
        <div className="about-nav">
          <Link href="/" className="about-brand">VibeSchool</Link>
          <nav aria-label="About navigation"><Link href="/about">About</Link><Link href="/contact">Contact</Link><Link href="/legal/privacy">Privacy</Link></nav>
        </div>
        <div className="about-hero-inner">
          <p className="eyebrow">LEARNING, CONNECTED</p>
          <h1>Education works better when the people supporting a learner can work from <em>trusted context.</em></h1>
          <p className="hero-copy">A learner can have a teacher, a parent, a school and a world of resources around them — yet those pieces can still feel disconnected. One person knows what was taught. Another knows what happened at home. The learner knows what feels difficult. The school may have records, but not always a clear path from information to action.</p>
          <p className="hero-copy strong">VibeSchool is built to connect those pieces: curriculum → teaching → evidence → understanding → better decisions.</p>
          <div className="hero-actions"><Link href="/" className="primary-action">Explore VibeSchool</Link><Link href="/contact" className="secondary-action">Talk to VibeSchool</Link></div>
          <p className="hero-note">Built for the realities of learning in Kenya and designed to grow with wider learning communities.</p>
        </div>
      </section>

      <section className="about-section problem-section">
        <div className="section-label">THE HUMAN PROBLEM</div>
        <div className="two-column"><div><h2>People are already trying. The system should help them connect the dots.</h2></div><div><p>Teachers are busy. Parents care. Learners are trying to keep up. School leaders are coordinating people, curriculum and results.</p><p>The problem is often not motivation. It is fragmentation: information in one place, resources in another, classroom activity somewhere else, and important decisions made with only part of the picture.</p><p><strong>VibeSchool is designed around that gap.</strong> The ambition is not to add another screen to a teacher's day. It is to make the work around learning more connected, visible and actionable.</p></div></div>
      </section>

      <section className="about-section dark-section">
        <div className="section-label">HOW VIBESCHOOL THINKS</div>
        <h2>From “What should we teach?” to “What should happen next?”</h2>
        <p className="section-intro">VibeSchool is an Education Operating System: a connected way of organising the work around learning instead of treating every educational task as an isolated feature.</p>
        <div className="journey">
          <div><span>01</span><strong>Curriculum</strong><p>Know what should be taught and how learning progresses.</p></div>
          <div><span>02</span><strong>Teaching</strong><p>Turn curriculum into real teaching and learning experiences.</p></div>
          <div><span>03</span><strong>Evidence</strong><p>Capture what a learner actually demonstrated.</p></div>
          <div><span>04</span><strong>Understanding</strong><p>Make evidence useful rather than leaving it as disconnected records.</p></div>
          <div><span>05</span><strong>Next step</strong><p>Help the responsible person decide what should happen next.</p></div>
        </div>
      </section>

      <section className="about-section">
        <div className="section-label">WHO BENEFITS</div>
        <h2>Different needs. One shared purpose.</h2>
        <p className="section-intro">VibeSchool does not treat everyone as the same user. A learner needs clarity. A teacher needs leverage. A parent needs meaningful context. A school needs coordination.</p>
        <div className="audience-grid">{audiences.map(([title, text]) => <article key={title}><h3>{title}</h3><p>{text}</p><Link href="/" className="audience-link">See the VibeSchool experience →</Link></article>)}</div>
      </section>

      <section className="about-section feature-section">
        <div className="section-label">THE BIGGER PICTURE</div>
        <div className="two-column"><div><h2>One system, different experiences.</h2></div><div><p>VibeSchool brings together the operating needs around education: school operations, teacher work, learner experiences, parent engagement, curriculum and learning resources.</p><p>The long-term product vision includes experiences such as Teacher OS, Learner OS, Parent OS, School OS, Publisher OS, VibeLearn, VibeTextbook and VibeTwin. They are intended to share trusted educational objects and evidence rather than create competing versions of the same truth.</p></div></div>
      </section>

      <section className="about-section dark-section">
        <div className="section-label">RESPONSIBLE INTELLIGENCE</div>
        <div className="two-column"><div><h2>AI should make good educational work stronger — not make things up.</h2></div><div><p>VibeTwin is VibeSchool's context-aware intelligence layer. It is intended to work from trusted educational evidence, support interpretation and help recommend responsible next actions.</p><p><strong>Human responsibility stays central.</strong> An AI-generated suggestion should not become a learner's “truth” simply because a machine produced it. Educational decisions need context, evidence and appropriate human judgement.</p></div></div>
      </section>

      <section className="about-section principles-section">
        <div className="section-label">OUR STANDARD</div><h2>Technology should earn its place in education.</h2>
        <div className="principles">{principles.map(([title, text], i) => <article key={title}><span>0{i + 1}</span><div><h3>{title}</h3><p>{text}</p></div></article>)}</div>
      </section>

      <section className="about-section faq-section">
        <div className="section-label">QUESTIONS PEOPLE MAY HAVE</div><h2>Before you decide whether VibeSchool is for you.</h2>
        <div className="faq-grid">{faqs.map(([q, a]) => <details key={q}><summary>{q}</summary><p>{a}</p></details>)}</div>
      </section>

      <section className="about-section trust-section">
        <div className="section-label">THE PROMISE</div><h2>We don't want to build another system people are forced to feed.</h2>
        <p>We want VibeSchool to give something back: clearer context, less unnecessary work, better communication, stronger evidence and more useful decisions.</p>
        <p>That requires more than attractive screens. It requires careful product design, clear authority, security boundaries, curriculum alignment and verification before something is called done.</p>
        <p className="closing-line">Because behind every record, lesson, assessment and dashboard is a real learner whose future matters.</p>
      </section>

      <section className="about-cta"><p className="eyebrow">START WITH YOUR REAL NEED</p><h2>Don't take our word for it. Explore VibeSchool.</h2><p>See what is available, ask a question, or tell us where your current learning workflow is getting in the way.</p><div className="hero-actions"><Link href="/" className="primary-action">Explore VibeSchool</Link><Link href="/contact" className="secondary-action">Contact VibeSchool</Link></div></section>
      <footer className="about-footer"><span>© VibeSchool</span><div><Link href="/about">About</Link><Link href="/contact">Contact</Link><Link href="/legal/privacy">Privacy</Link><Link href="/legal/terms">Terms</Link><Link href="/legal/aup">Acceptable Use</Link></div></footer>
      <style>{styles}</style>
    </main>
  )
}

const styles = `
.about-page{font-family:var(--font-jakarta),Arial,sans-serif;color:#111827;background:#f7f6f2;line-height:1.7}.about-page *{box-sizing:border-box}.about-hero{background:#05050f;color:#fff;padding:0 24px 100px}.about-nav{max-width:1180px;margin:auto;height:78px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid rgba(255,255,255,.1)}.about-brand{font-family:var(--font-display),Arial,sans-serif;font-size:24px;font-weight:800;color:#fff;text-decoration:none}.about-nav nav{display:flex;gap:26px}.about-nav nav a,.about-footer a{color:rgba(255,255,255,.7);text-decoration:none;font-size:14px}.about-nav nav a:hover,.about-footer a:hover{color:#fff}.about-hero-inner{max-width:1000px;margin:82px auto 0}.eyebrow,.section-label{font-family:var(--font-mono),monospace;letter-spacing:.18em;font-size:11px;font-weight:700}.eyebrow{color:#c8a84b}.about-hero h1{font-family:var(--font-display),Arial,sans-serif;font-size:clamp(43px,6.6vw,78px);line-height:1.03;letter-spacing:-.045em;max-width:1000px;margin:20px 0 30px;font-weight:600}.about-hero h1 em{font-family:var(--font-serif),Georgia,serif;color:#c8a84b;font-weight:400}.hero-copy{font-size:18px;line-height:1.8;max-width:800px;color:rgba(255,255,255,.68);margin:14px 0}.hero-copy.strong{color:rgba(255,255,255,.95);font-weight:600}.hero-note{font-size:13px;color:rgba(255,255,255,.42);margin-top:22px}.hero-actions{display:flex;gap:12px;flex-wrap:wrap;margin-top:32px}.primary-action,.secondary-action{display:inline-flex;align-items:center;padding:13px 20px;border-radius:8px;text-decoration:none;font-weight:700;font-size:14px}.primary-action{background:#c8a84b;color:#05050f}.secondary-action{border:1px solid rgba(255,255,255,.25);color:#fff}.about-section{max-width:1180px;margin:auto;padding:100px 24px}.section-label{color:#9a7b2f;margin-bottom:20px}.dark-section{max-width:none;background:#0a0a16;color:#fff;padding-left:max(24px,calc((100vw - 1132px)/2));padding-right:max(24px,calc((100vw - 1132px)/2))}.dark-section .section-label{color:#c8a84b}.about-section h2,.about-cta h2{font-family:var(--font-display),Arial,sans-serif;font-size:clamp(34px,5vw,58px);line-height:1.08;letter-spacing:-.035em;margin:0 0 25px;font-weight:600}.two-column{display:grid;grid-template-columns:1fr 1fr;gap:80px}.two-column p,.section-intro{font-size:17px;color:#5b6472;max-width:680px}.dark-section .two-column p,.dark-section .section-intro{color:rgba(255,255,255,.62)}.journey{display:grid;grid-template-columns:repeat(5,1fr);margin-top:55px;border-top:1px solid rgba(255,255,255,.13)}.journey>div{padding:25px 20px 0 0;border-right:1px solid rgba(255,255,255,.1)}.journey>div:not(:first-child){padding-left:20px}.journey span{font-family:var(--font-mono);font-size:11px;color:#c8a84b}.journey strong{display:block;font-size:19px;margin:13px 0 5px}.journey p{color:rgba(255,255,255,.55);font-size:14px}.audience-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:1px;background:#ddd8cc;margin-top:45px}.audience-grid article{background:#f7f6f2;padding:38px}.audience-grid h3{font-size:21px;margin:0 0 10px}.audience-grid p{color:#5b6472;margin:0 0 20px}.audience-link{font-size:13px;font-weight:700;color:#80641e;text-decoration:none}.feature-section{background:#eeece5;max-width:none;padding-left:max(24px,calc((100vw - 1132px)/2));padding-right:max(24px,calc((100vw - 1132px)/2))}.principles{display:grid;grid-template-columns:repeat(2,1fr);gap:0 70px;margin-top:40px}.principles article{display:grid;grid-template-columns:42px 1fr;gap:12px;padding:28px 0;border-top:1px solid #d8d4c9}.principles span{font-family:var(--font-mono);font-size:11px;color:#9a7b2f}.principles h3{font-size:20px;margin:0 0 8px}.principles p,.trust-section>p{color:#5b6472;margin:0}.faq-section{background:#fff}.faq-grid{max-width:900px;margin-top:38px}.faq-grid details{border-top:1px solid #ddd8cc;padding:22px 0}.faq-grid details:last-child{border-bottom:1px solid #ddd8cc}.faq-grid summary{cursor:pointer;font-weight:700;font-size:18px;color:#20242b}.faq-grid p{color:#5b6472;max-width:760px;margin:14px 0 0}.trust-section{max-width:900px}.trust-section>p{font-size:18px;line-height:1.85}.trust-section .closing-line{font-family:var(--font-serif),Georgia,serif;font-size:30px;color:#111827;margin-top:40px}.about-cta{background:#c8a84b;color:#05050f;text-align:center;padding:95px 24px}.about-cta .eyebrow{color:#65521f}.about-cta h2{max-width:800px;margin:15px auto}.about-cta>p:not(.eyebrow){max-width:650px;margin:0 auto;color:#413714}.about-cta .primary-action{background:#05050f;color:#fff}.about-cta .secondary-action{border-color:rgba(5,5,15,.35);color:#05050f}.about-cta .hero-actions{justify-content:center}.about-footer{background:#05050f;color:#fff;display:flex;justify-content:space-between;gap:20px;flex-wrap:wrap;padding:28px max(24px,calc((100vw - 1132px)/2));font-size:13px}.about-footer div{display:flex;gap:22px}@media(max-width:800px){.about-nav nav{gap:12px}.about-nav nav a:nth-child(3){display:none}.about-hero{padding-bottom:75px}.about-hero-inner{margin-top:60px}.two-column,.principles{grid-template-columns:1fr;gap:35px}.journey{grid-template-columns:1fr 1fr}.journey>div{border-bottom:1px solid rgba(255,255,255,.1)}.audience-grid{grid-template-columns:1fr}.about-section{padding-top:72px;padding-bottom:72px}.about-footer{flex-direction:column}.about-footer div{flex-wrap:wrap}}
`
