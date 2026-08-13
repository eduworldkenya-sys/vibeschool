import Link from 'next/link'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Learn, teach and support learning',
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
  { title: 'I am a learner', text: 'Find learning resources, practise, understand your work and know what to focus on next.', primary: 'Learner sign in', primaryHref: '/login/student', secondary: 'New learner', secondaryHref: '/signup/student' },
  { title: 'I am a teacher', text: 'Plan, teach, organise your work and use evidence to understand what your learners need next.', primary: 'Start as a teacher', primaryHref: '/signup/teacher', secondary: 'Teacher sign in', secondaryHref: '/login/teacher' },
  { title: 'I am a parent', text: 'Get a clearer view of your child’s learning and build a stronger connection between home and school.', primary: 'Parent sign in', primaryHref: '/login/parent', secondary: 'Create parent account', secondaryHref: '/signup/parent' },
  { title: 'I run a school', text: 'Bring people, curriculum, learning activity and school operations into a more connected experience.', primary: 'Set up a school', primaryHref: '/admin/signup', secondary: 'Sign in', secondaryHref: '/login' },
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
          <Link href="#find-your-place" className="nav-role">For you</Link>
          <Link href="/about">About</Link>
          <Link href="/contact" className="nav-contact">Contact</Link>
          <Link href="/login" className="nav-signin">Sign in</Link>
          <Link href="/signup/teacher" className="nav-cta">Get started</Link>
        </nav>
      </header>

      <section className="hero">
        <div className="eyebrow">LEARN · TEACH · SUPPORT · CONNECT</div>
        <h1>Education is a journey.<br /><i>VibeSchool connects the people and work around it.</i></h1>
        <p className="lead">Learning resources, curriculum, teaching, evidence and the people supporting a learner should not have to live in separate worlds.</p>
        <div className="actions hero-actions">
          <Link href="/signup/teacher" className="primary">Start as a teacher</Link>
          <Link href="/login/student" className="secondary">I’m a learner</Link>
          <Link href="/login" className="text-cta">Already have an account? Sign in →</Link>
        </div>
        <p className="micro">Choose your role and go straight to the right experience.</p>
      </section>

      <section className="quick-entry" aria-label="Quick access">
        <span>Quick access</span>
        <Link href="/login/teacher">Teacher sign in</Link>
        <Link href="/login/student">Learner sign in</Link>
        <Link href="/login/parent">Parent sign in</Link>
        <Link href="/admin/signup">School setup</Link>
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
        <p className="section-lead">No hunting through menus. Pick your role and continue.</p>
        <div className="role-grid">
          {roles.map(role => (
            <article key={role.title}>
              <h3>{role.title}</h3>
              <p>{role.text}</p>
              <div className="role-actions">
                <Link href={role.primaryHref} className="role-primary">{role.primary}</Link>
                <Link href={role.secondaryHref} className="role-secondary">{role.secondary} →</Link>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="dark">
        <div className="eyebrow">THE VIBESCHOOL LOOP</div>
        <h2>From what should be learned to what should happen next.</h2>
        <div className="outcomes">{outcomes.map(([title, text], i) => <div key={title}><span>0{i + 1}</span><h3>{title}</h3><p>{text}</p></div>)}</div>
        <div className="dark-actions"><Link href="/signup/teacher" className="primary">Create a teacher account</Link><Link href="/login" className="secondary">Sign in to VibeSchool</Link></div>
      </section>

      <section className="trust">
        <div className="eyebrow">BUILT WITH CARE</div>
        <h2>Technology should support education — not replace the people responsible for it.</h2>
        <p>VibeSchool is designed around curriculum, evidence, role-based access and responsible intelligence. AI can help people understand and act, but it should not invent a learner’s reality or silently replace human judgement.</p>
        <div className="trust-links"><Link href="/about">Understand what VibeSchool stands for →</Link><Link href="/contact">Have a question? Talk to us →</Link></div>
      </section>

      <section className="cta">
        <div className="eyebrow">YOUR NEXT STEP</div>
        <h2>Ready to start?</h2>
        <p>Choose the shortest path for you.</p>
        <div className="cta-grid">
          <Link href="/signup/teacher"><strong>Teacher</strong><span>Create account →</span></Link>
          <Link href="/login/student"><strong>Learner</strong><span>Sign in →</span></Link>
          <Link href="/login/parent"><strong>Parent</strong><span>Sign in →</span></Link>
          <Link href="/admin/signup"><strong>School</strong><span>Get started →</span></Link>
        </div>
        <p className="returning">Already use VibeSchool? <Link href="/login">Sign in here →</Link></p>
      </section>

      <footer><span>© VibeSchool</span><div><Link href="/">Home</Link><Link href="#find-your-place">Get started</Link><Link href="/login">Sign in</Link><Link href="/about">About</Link><Link href="/contact">Contact</Link><Link href="/legal/privacy">Privacy</Link><Link href="/legal/terms">Terms</Link></div></footer>

      <style>{styles}</style>
    </main>
  )
}

const styles = `
.welcome{background:#f7f6f2;color:#111827;min-height:100vh;font-family:var(--font-jakarta),Arial,sans-serif;line-height:1.7}.welcome *{box-sizing:border-box}.nav{height:76px;max-width:1180px;margin:auto;padding:0 24px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid #ddd8cc}.brand{font-family:var(--font-display),Arial,sans-serif;font-size:25px;font-weight:800;color:#111827;text-decoration:none}.brand span{color:#9a7b2f}.nav nav{display:flex;align-items:center;gap:22px}.nav nav a,footer a{font-size:14px;color:#596170;text-decoration:none}.nav nav a:hover,footer a:hover{color:#111827}.nav .nav-signin{font-weight:700;color:#111827}.nav .nav-cta{background:#111827;color:#fff;padding:9px 14px;border-radius:8px;font-weight:700}.nav .nav-cta:hover{color:#fff;background:#252b35}.hero{background:#05050f;color:#fff;padding:110px 24px 100px;text-align:center}.hero>*{max-width:920px;margin-left:auto;margin-right:auto}.eyebrow{font-family:var(--font-mono),monospace;letter-spacing:.18em;font-size:11px;font-weight:700;color:#9a7b2f}.hero .eyebrow{color:#c8a84b}.hero h1{font-family:var(--font-display),Arial,sans-serif;font-size:clamp(44px,7vw,78px);line-height:1.04;letter-spacing:-.045em;font-weight:600;margin-top:22px;margin-bottom:28px}.hero h1 i{font-family:Georgia,serif;color:#c8a84b;font-weight:400}.lead{font-size:19px;color:rgba(255,255,255,.68);max-width:720px}.actions{display:flex;justify-content:center;gap:12px;flex-wrap:wrap;margin-top:30px}.primary,.secondary,.text-cta{padding:13px 21px;border-radius:8px;font-weight:700;font-size:14px;text-decoration:none}.primary{background:#c8a84b;color:#05050f}.secondary{border:1px solid rgba(255,255,255,.25);color:#fff}.text-cta{color:#d8c47a;padding-left:8px;padding-right:8px}.micro{font-family:var(--font-mono),monospace;font-size:10px;color:rgba(255,255,255,.35);margin-top:18px}.quick-entry{max-width:1180px;margin:0 auto;padding:18px 24px;display:flex;align-items:center;justify-content:center;gap:22px;flex-wrap:wrap;border-bottom:1px solid #ddd8cc}.quick-entry span{font:700 10px var(--font-mono),monospace;letter-spacing:.14em;text-transform:uppercase;color:#8a6b20}.quick-entry a{font-size:13px;font-weight:700;color:#374151;text-decoration:none}.quick-entry a:hover{color:#8a6b20}.problem,.roles,.trust{max-width:1180px;margin:auto;padding:100px 24px}.split{display:grid;grid-template-columns:1fr 1fr;gap:80px;margin-top:15px}.split h2,.roles h2,.dark h2,.trust h2,.cta h2{font-family:var(--font-display),Arial,sans-serif;font-size:clamp(34px,5vw,57px);line-height:1.08;letter-spacing:-.035em;font-weight:600;margin:0}.split p,.trust>p{font-size:17px;color:#5b6472}.roles{border-top:1px solid #ddd8cc}.roles h2{margin-top:12px}.section-lead{color:#6b7280;margin:14px 0 0;font-size:16px}.role-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:1px;background:#ddd8cc;margin-top:40px}.role-grid article{background:#f7f6f2;padding:36px}.role-grid h3{font-size:21px;margin:0 0 10px}.role-grid p{color:#5b6472;margin:0 0 22px}.role-actions{display:flex;align-items:center;gap:14px;flex-wrap:wrap}.role-primary{background:#111827;color:#fff!important;padding:10px 14px;border-radius:8px;font-size:13px;text-decoration:none}.role-secondary,.trust-links a{color:#8a6b20;font-weight:700;text-decoration:none;font-size:13px}.dark{background:#0a0a16;color:#fff;padding:100px max(24px,calc((100vw - 1132px)/2))}.dark .eyebrow{color:#c8a84b}.dark h2{max-width:850px;margin-top:12px}.outcomes{display:grid;grid-template-columns:repeat(4,1fr);margin-top:55px;border-top:1px solid rgba(255,255,255,.12)}.outcomes>div{padding:25px 20px 0 0;border-right:1px solid rgba(255,255,255,.1)}.outcomes>div:not(:first-child){padding-left:20px}.outcomes span{font-family:var(--font-mono);font-size:11px;color:#c8a84b}.outcomes h3{font-size:20px;margin:13px 0 5px}.outcomes p{font-size:14px;color:rgba(255,255,255,.56)}.dark-actions{display:flex;gap:12px;flex-wrap:wrap;margin-top:42px}.trust{max-width:900px}.trust h2{margin-top:12px}.trust-links{display:flex;gap:28px;flex-wrap:wrap;margin-top:28px}.cta{background:#c8a84b;text-align:center;padding:90px 24px}.cta .eyebrow{color:#65521f}.cta h2{max-width:800px;margin:12px auto}.cta>p{color:#413714}.cta-grid{max-width:900px;margin:34px auto 0;display:grid;grid-template-columns:repeat(4,1fr);gap:10px}.cta-grid a{background:#05050f;color:#fff;text-decoration:none;padding:18px 14px;border-radius:10px;display:flex;flex-direction:column;gap:4px}.cta-grid strong{font-size:15px}.cta-grid span{font-size:12px;color:#d8c47a}.returning{margin-top:24px!important}.returning a{color:#05050f;font-weight:800}.returning a:hover{text-decoration:none}footer{background:#05050f;color:#fff;padding:28px max(24px,calc((100vw - 1132px)/2));display:flex;justify-content:space-between;gap:20px;flex-wrap:wrap;font-size:13px}footer a{color:rgba(255,255,255,.65)}footer div{display:flex;gap:18px;flex-wrap:wrap}@media(max-width:880px){.nav-contact{display:none}.hero{padding-top:80px;padding-bottom:80px}.split{grid-template-columns:1fr;gap:30px}.role-grid{grid-template-columns:1fr}.outcomes{grid-template-columns:1fr 1fr}.outcomes>div{padding-bottom:20px}.problem,.roles,.trust{padding-top:75px;padding-bottom:75px}.cta-grid{grid-template-columns:1fr 1fr}}@media(max-width:620px){.nav-role,.nav nav>a:nth-of-type(2){display:none}.nav nav{gap:10px}.nav .nav-signin{font-size:13px}.nav .nav-cta{padding:8px 11px;font-size:12px}.hero h1{font-size:42px}.hero-actions{flex-direction:column;max-width:360px}.hero-actions a{width:100%}.quick-entry{justify-content:flex-start;gap:12px 18px}.cta-grid{grid-template-columns:1fr}.outcomes{grid-template-columns:1fr}}@media(prefers-reduced-motion:reduce){.welcome *{animation:none!important;transition:none!important;scroll-behavior:auto!important}}
`
