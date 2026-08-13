import Link from 'next/link'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'VibeSchool | Learn, teach and support learning',
  description: 'VibeSchool connects learning resources, curriculum, teaching, evidence and the people supporting every learner.',
  alternates: { canonical: '/' },
  openGraph: {
    title: 'VibeSchool | Learn, teach and support learning',
    description: 'A connected education experience for learners, teachers, parents and schools.',
    url: '/',
    type: 'website',
  },
}

const roles = [
  { title: 'I am a learner', text: 'Find learning resources, practise, understand your work and know what to focus on next.', href: '/login/student' },
  { title: 'I am a teacher', text: 'Plan, teach, organise your work and use evidence to understand what your learners need next.', href: '/signup/teacher' },
  { title: 'I am a parent', text: 'Get a clearer view of your child’s learning and build a stronger connection between home and school.', href: '/login/parent' },
  { title: 'I run a school', text: 'Bring people, curriculum, learning activity and school operations into a more connected experience.', href: '/admin/signup' },
]

const outcomes = [
  ['Learn', 'Resources and curriculum give learners a clearer path from “I need help” to “I understand.”'],
  ['Teach', 'Teachers get support around planning, learning activity and evidence without losing the human role of the teacher.'],
  ['Support', 'Parents can move beyond occasional updates toward useful context about learning.'],
  ['Understand', 'Educational evidence becomes useful context instead of disconnected records.'],
]

export default function WelcomePage() {
  return (
    <main className="welcome">
      <header className="nav">
        <Link href="/" className="brand">Vibe<span>School</span></Link>
        <nav aria-label="Primary navigation">
          <Link href="/about">About</Link>
          <Link href="/contact">Contact</Link>
          <Link href="/login">Sign in</Link>
        </nav>
      </header>

      <section className="hero">
        <div className="eyebrow">LEARN · TEACH · SUPPORT · CONNECT</div>
        <h1>Education is a journey.<br /><i>VibeSchool connects the people and work around it.</i></h1>
        <p className="lead">Learning resources, curriculum, teaching, evidence and the people supporting a learner should not have to live in separate worlds.</p>
        <div className="actions">
          <Link href="/signup/teacher" className="primary">Get started</Link>
          <Link href="/login" className="secondary">Sign in</Link>
        </div>
        <p className="micro">Start with what you need. You can explore before creating an account.</p>
      </section>

      <section className="problem">
        <div className="eyebrow">WHY VIBESCHOOL</div>
        <div className="split">
          <h2>The people around a learner are already working hard. The system should help them connect the dots.</h2>
          <div>
            <p>A learner may have a question. A teacher may have a lesson to prepare. A parent may want to know how to help. A school may need a clearer picture of what is happening.</p>
            <p>Too often, the information needed for the next good decision is scattered across notebooks, messages, files and different systems.</p>
            <p><strong>VibeSchool is designed to make that work more connected — without taking away the people who make education human.</strong></p>
          </div>
        </div>
      </section>

      <section id="find-your-place" className="roles">
        <div className="eyebrow">START WITH YOU</div>
        <h2>What brings you here?</h2>
        <div className="role-grid">
          {roles.map(role => <article key={role.title}><h3>{role.title}</h3><p>{role.text}</p><Link href={role.href}>Continue →</Link></article>)}
        </div>
      </section>

      <section className="dark">
        <div className="eyebrow">THE VIBESCHOOL LOOP</div>
        <h2>From what should be learned to what should happen next.</h2>
        <div className="outcomes">{outcomes.map(([title, text], i) => <div key={title}><span>0{i + 1}</span><h3>{title}</h3><p>{text}</p></div>)}</div>
      </section>

      <section className="trust">
        <div className="eyebrow">BUILT WITH CARE</div>
        <h2>Technology should support education — not replace the people responsible for it.</h2>
        <p>VibeSchool is designed around curriculum, evidence, role-based access and responsible intelligence. AI can help people understand and act, but it should not invent a learner’s reality or silently replace human judgement.</p>
        <div className="trust-links"><Link href="/about">Understand what VibeSchool stands for →</Link><Link href="/contact">Have a question? Talk to us →</Link></div>
      </section>

      <section className="cta">
        <div className="eyebrow">YOUR NEXT STEP</div>
        <h2>Ready to see where VibeSchool can help?</h2>
        <p>Choose your role and continue straight to the right experience.</p>
        <div className="actions"><Link href="/signup/teacher" className="primary dark-button">Get started</Link><Link href="/about" className="secondary dark-outline">About VibeSchool</Link></div>
      </section>

      <footer><span>© VibeSchool</span><div><Link href="/">Home</Link><Link href="/about">About</Link><Link href="/contact">Contact</Link><Link href="/legal/privacy">Privacy</Link><Link href="/legal/terms">Terms</Link></div></footer>

      <style>{styles}</style>
    </main>
  )
}

const styles = `
.welcome{background:#f7f6f2;color:#111827;min-height:100vh;font-family:var(--font-jakarta),Arial,sans-serif;line-height:1.7}.welcome *{box-sizing:border-box}.nav{height:76px;max-width:1180px;margin:auto;padding:0 24px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid #ddd8cc}.brand{font-family:var(--font-display),Arial,sans-serif;font-size:25px;font-weight:800;color:#111827;text-decoration:none}.brand span{color:#9a7b2f}.nav nav{display:flex;gap:26px}.nav nav a,footer a{font-size:14px;color:#596170;text-decoration:none}.nav nav a:hover,footer a:hover{color:#111827}.hero{background:#05050f;color:#fff;padding:120px 24px 115px;text-align:center}.hero>*{max-width:920px;margin-left:auto;margin-right:auto}.eyebrow{font-family:var(--font-mono),monospace;letter-spacing:.18em;font-size:11px;font-weight:700;color:#9a7b2f}.hero .eyebrow{color:#c8a84b}.hero h1{font-family:var(--font-display),Arial,sans-serif;font-size:clamp(44px,7vw,78px);line-height:1.04;letter-spacing:-.045em;font-weight:600;margin-top:22px;margin-bottom:28px}.hero h1 i{font-family:Georgia,serif;color:#c8a84b;font-weight:400}.lead{font-size:19px;color:rgba(255,255,255,.68);max-width:720px}.actions{display:flex;justify-content:center;gap:12px;flex-wrap:wrap;margin-top:30px}.primary,.secondary{padding:13px 21px;border-radius:8px;font-weight:700;font-size:14px;text-decoration:none}.primary{background:#c8a84b;color:#05050f}.secondary{border:1px solid rgba(255,255,255,.25);color:#fff}.micro{font-family:var(--font-mono),monospace;font-size:10px;color:rgba(255,255,255,.35);margin-top:18px}.problem,.roles,.trust{max-width:1180px;margin:auto;padding:105px 24px}.split{display:grid;grid-template-columns:1fr 1fr;gap:80px;margin-top:15px}.split h2,.roles h2,.dark h2,.trust h2,.cta h2{font-family:var(--font-display),Arial,sans-serif;font-size:clamp(34px,5vw,57px);line-height:1.08;letter-spacing:-.035em;font-weight:600;margin:0}.split p,.trust>p{font-size:17px;color:#5b6472}.roles{border-top:1px solid #ddd8cc}.roles h2{margin-top:12px}.role-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:1px;background:#ddd8cc;margin-top:45px}.role-grid article{background:#f7f6f2;padding:36px}.role-grid h3{font-size:21px;margin:0 0 10px}.role-grid p{color:#5b6472;margin:0 0 20px}.role-grid a,.trust-links a{color:#8a6b20;font-weight:700;text-decoration:none}.dark{background:#0a0a16;color:#fff;padding:105px max(24px,calc((100vw - 1132px)/2))}.dark .eyebrow{color:#c8a84b}.dark h2{max-width:850px;margin-top:12px}.outcomes{display:grid;grid-template-columns:repeat(4,1fr);margin-top:55px;border-top:1px solid rgba(255,255,255,.12)}.outcomes>div{padding:25px 20px 0 0;border-right:1px solid rgba(255,255,255,.1)}.outcomes>div:not(:first-child){padding-left:20px}.outcomes span{font-family:var(--font-mono);font-size:11px;color:#c8a84b}.outcomes h3{font-size:20px;margin:13px 0 5px}.outcomes p{font-size:14px;color:rgba(255,255,255,.56)}.trust{max-width:900px}.trust h2{margin-top:12px}.trust-links{display:flex;gap:28px;flex-wrap:wrap;margin-top:28px}.cta{background:#c8a84b;text-align:center;padding:100px 24px}.cta .eyebrow{color:#65521f}.cta h2{max-width:800px;margin:12px auto}.cta p{color:#413714}.dark-button{background:#05050f;color:#fff}.dark-outline{border-color:rgba(5,5,15,.35);color:#05050f}.cta .actions{justify-content:center}footer{background:#05050f;color:#fff;padding:28px max(24px,calc((100vw - 1132px)/2));display:flex;justify-content:space-between;gap:20px;flex-wrap:wrap;font-size:13px}footer a{color:rgba(255,255,255,.65)}footer div{display:flex;gap:22px}@media(max-width:800px){.nav nav a:nth-child(2){display:none}.hero{padding-top:80px;padding-bottom:80px}.split{grid-template-columns:1fr;gap:30px}.role-grid{grid-template-columns:1fr}.outcomes{grid-template-columns:1fr 1fr}.outcomes>div{padding-bottom:20px}.problem,.roles,.trust{padding-top:75px;padding-bottom:75px}}@media(max-width:520px){.nav nav{gap:12px}.outcomes{grid-template-columns:1fr}.hero h1{font-size:44px}}@media(prefers-reduced-motion:reduce){.welcome *{animation:none!important;transition:none!important;scroll-behavior:auto!important}}
`
