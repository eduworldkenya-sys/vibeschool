import Link from 'next/link'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'VibeSchool Kenya — Learn what matters next',
  description: 'VibeSchool connects Kenyan curriculum, teaching, learner evidence and parent support so every learner has a clearer next step.',
  alternates: { canonical: '/' },
  openGraph: {
    title: 'VibeSchool Kenya — Learn what matters next',
    description: 'Curriculum, teaching, learner evidence and family support connected around the learner.',
    url: '/',
    type: 'website',
  },
}

const roles = [
  { title: 'Learner', text: 'Learn, practise and understand what to focus on next.', href: '/login/student', action: 'Continue learning' },
  { title: 'Teacher', text: 'Plan, teach and turn classroom evidence into the next useful action.', href: '/signup/teacher', action: 'Start teaching' },
  { title: 'Parent', text: 'See the learning story clearly enough to know how to help.', href: '/login/parent', action: 'Support my child' },
  { title: 'School', text: 'Connect curriculum, people and learning activity without adding unnecessary work.', href: '/admin/signup', action: 'Set up my school' },
]

const loop = [
  ['01', 'Know', 'Start from the curriculum and the learner’s real context.'],
  ['02', 'Teach', 'Turn plans into learning, not more paperwork.'],
  ['03', 'See', 'Capture useful evidence of what the learner can do.'],
  ['04', 'Move', 'Use that evidence to decide what should happen next.'],
]

export default function WelcomePage() {
  return (
    <main className="welcome">
      <header className="nav">
        <Link href="/" className="brand">Vibe<span>School</span></Link>
        <nav aria-label="Primary navigation">
          <Link href="#for-you">For you</Link>
          <Link href="/about">About</Link>
          <Link href="/contact">Contact</Link>
          <Link href="/login" className="signin">Sign in</Link>
          <Link href="/signup/teacher" className="navCta">Get started</Link>
        </nav>
      </header>

      <section className="hero">
        <p className="eyebrow">BUILT FOR HOW LEARNING SHOULD FEEL</p>
        <h1>Every learner deserves to know<br /><em>what comes next.</em></h1>
        <p className="lead">VibeSchool connects curriculum, teaching, learning evidence and the people supporting a learner — so progress does not disappear between the classroom, home and the next lesson.</p>
        <div className="actions">
          <Link href="#for-you" className="primary">Find my path</Link>
          <Link href="/global/read" className="secondary">Explore learning resources</Link>
        </div>
        <p className="micro">For learners · teachers · parents · schools in Kenya</p>
      </section>

      <section className="promise">
        <p className="eyebrow darkEyebrow">THE PROBLEM IS NOT EFFORT</p>
        <div className="promiseGrid">
          <h2>People already care.<br />The information around learning is what gets lost.</h2>
          <div>
            <p>A teacher sees something in class. A learner struggles later. A parent wants to help. A school needs the bigger picture.</p>
            <p>When those moments live in different notebooks, chats, files and systems, everyone works harder and the learner still waits.</p>
            <p className="strong">VibeSchool turns those disconnected moments into one continuous learning story.</p>
          </div>
        </div>
      </section>

      <section className="loop">
        <p className="eyebrow">THE VIBESCHOOL LOOP</p>
        <h2>From “What should I learn?” to “I know what to do next.”</h2>
        <div className="loopGrid">{loop.map(([n, title, text]) => <article key={n}><span>{n}</span><h3>{title}</h3><p>{text}</p></article>)}</div>
      </section>

      <section id="for-you" className="roles">
        <p className="eyebrow darkEyebrow">START WITH YOU</p>
        <h2>One VibeSchool. A shorter path for everyone.</h2>
        <p className="sectionLead">Choose who you are. We take you directly to the experience that matters.</p>
        <div className="roleGrid">{roles.map(role => <article key={role.title}><h3>{role.title}</h3><p>{role.text}</p><Link href={role.href}>{role.action} →</Link></article>)}</div>
      </section>

      <section className="trust">
        <div>
          <p className="eyebrow darkEyebrow">HUMAN WHERE IT MATTERS</p>
          <h2>Technology should make good judgement easier — not quietly replace it.</h2>
        </div>
        <div>
          <p>VibeSchool is designed around curriculum, evidence, role-based access and responsible intelligence. High-stakes decisions should remain attributable and reviewable.</p>
          <div className="trustLinks"><Link href="/legal/privacy">Privacy →</Link><Link href="/about">Our approach →</Link><Link href="/contact">Talk to VibeSchool →</Link></div>
        </div>
      </section>

      <section className="finalCta">
        <p className="eyebrow goldDark">YOUR NEXT STEP</p>
        <h2>Start where you are.</h2>
        <p>You do not need to learn the platform first. Choose your role and continue.</p>
        <div className="finalGrid">
          <Link href="/signup/teacher"><strong>Teacher</strong><span>Create account</span></Link>
          <Link href="/login/student"><strong>Learner</strong><span>Continue learning</span></Link>
          <Link href="/login/parent"><strong>Parent</strong><span>Support my child</span></Link>
          <Link href="/admin/signup"><strong>School</strong><span>Set up school</span></Link>
        </div>
      </section>

      <footer><div><strong>VibeSchool</strong><span>Learning, connected around the learner.</span></div><nav><Link href="/about">About</Link><Link href="/contact">Contact</Link><Link href="/legal/privacy">Privacy</Link><Link href="/legal/terms">Terms</Link><Link href="/login">Sign in</Link></nav></footer>
      <style>{styles}</style>
    </main>
  )
}

const styles = `
.welcome{background:#f7f6f2;color:#111827;min-height:100vh;font-family:var(--font-jakarta),Arial,sans-serif;line-height:1.65}.welcome *{box-sizing:border-box}.nav{height:76px;max-width:1180px;margin:auto;padding:0 24px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid #ddd8cc}.brand{font-family:var(--font-display),Arial,sans-serif;font-size:25px;font-weight:800;color:#111827;text-decoration:none}.brand span{color:#9a7b2f}.nav nav{display:flex;align-items:center;gap:21px}.nav nav a,footer a{font-size:14px;color:#596170;text-decoration:none}.nav .signin{font-weight:800;color:#111827}.nav .navCta{background:#111827;color:#fff;padding:9px 14px;border-radius:8px;font-weight:800}.hero{background:#05050f;color:#fff;padding:108px 24px 98px;text-align:center}.hero>*{max-width:950px;margin-left:auto;margin-right:auto}.eyebrow{font:700 10px var(--font-mono),monospace;letter-spacing:.2em;color:#c8a84b}.hero h1,.promise h2,.loop h2,.roles h2,.trust h2,.finalCta h2{font-family:var(--font-display),Arial,sans-serif;letter-spacing:-.04em}.hero h1{font-size:clamp(46px,7.4vw,82px);line-height:1.01;margin:20px auto 27px;font-weight:600}.hero h1 em{font-family:Georgia,serif;font-weight:400;color:#c8a84b}.lead{font-size:19px;color:rgba(255,255,255,.68);max-width:760px!important}.actions{display:flex;justify-content:center;gap:12px;flex-wrap:wrap;margin-top:31px}.primary,.secondary{padding:13px 20px;border-radius:9px;text-decoration:none;font-weight:800;font-size:14px}.primary{background:#c8a84b;color:#05050f}.secondary{border:1px solid rgba(255,255,255,.25);color:#fff}.micro{font:400 10px var(--font-mono),monospace;color:rgba(255,255,255,.36);margin-top:20px}.promise,.roles,.trust{max-width:1132px;margin:auto;padding:95px 24px}.darkEyebrow{color:#8a6b20}.promiseGrid,.trust{display:grid;grid-template-columns:1fr 1fr;gap:70px}.promise h2,.loop h2,.roles h2,.trust h2,.finalCta h2{font-size:clamp(34px,5vw,57px);line-height:1.07;margin:12px 0}.promiseGrid p,.trust p,.sectionLead{font-size:17px;color:#606978}.promiseGrid .strong{color:#111827;font-weight:800}.loop{background:#0a0a16;color:#fff;padding:95px max(24px,calc((100vw - 1132px)/2))}.loop h2{max-width:880px}.loopGrid{display:grid;grid-template-columns:repeat(4,1fr);margin-top:48px;border-top:1px solid rgba(255,255,255,.13)}.loopGrid article{padding:24px 20px 0 0}.loopGrid article+article{padding-left:20px;border-left:1px solid rgba(255,255,255,.1)}.loopGrid span{font:700 10px var(--font-mono),monospace;color:#c8a84b}.loopGrid h3{font-size:20px;margin:10px 0 5px}.loopGrid p{font-size:14px;color:rgba(255,255,255,.55)}.roles h2{max-width:800px}.sectionLead{margin-top:0}.roleGrid{display:grid;grid-template-columns:repeat(2,1fr);gap:12px;margin-top:36px}.roleGrid article{background:#fff;border:1px solid #e1ddd3;border-radius:14px;padding:30px}.roleGrid h3{font-size:21px;margin:0 0 8px}.roleGrid p{color:#626c79;margin:0 0 18px}.roleGrid a,.trustLinks a{font-weight:800;color:#80641e;text-decoration:none;font-size:13px}.trust{border-top:1px solid #ddd8cc}.trustLinks{display:flex;gap:22px;flex-wrap:wrap;margin-top:24px}.finalCta{background:#c8a84b;text-align:center;padding:85px 24px}.goldDark{color:#66511c}.finalCta>p:not(.eyebrow){color:#4b3d18}.finalGrid{max-width:900px;margin:32px auto 0;display:grid;grid-template-columns:repeat(4,1fr);gap:10px}.finalGrid a{background:#05050f;color:#fff;text-decoration:none;border-radius:11px;padding:18px 12px;display:flex;flex-direction:column}.finalGrid strong{font-size:15px}.finalGrid span{font-size:11px;color:#d8c47a;margin-top:3px}footer{background:#05050f;color:#fff;padding:28px max(24px,calc((100vw - 1132px)/2));display:flex;justify-content:space-between;gap:25px;flex-wrap:wrap;font-size:13px}footer>div{display:flex;flex-direction:column}footer>div span{color:rgba(255,255,255,.45);font-size:11px}footer nav{display:flex;gap:18px;flex-wrap:wrap}footer a{color:rgba(255,255,255,.65)}@media(max-width:820px){.promiseGrid,.trust{grid-template-columns:1fr;gap:28px}.loopGrid{grid-template-columns:1fr 1fr}.roleGrid{grid-template-columns:1fr}.finalGrid{grid-template-columns:1fr 1fr}.promise,.roles,.trust{padding-top:72px;padding-bottom:72px}}@media(max-width:620px){.nav nav>a:not(.signin):not(.navCta){display:none}.nav nav{gap:9px}.hero{padding-top:76px;padding-bottom:76px}.hero h1{font-size:43px}.actions{flex-direction:column;max-width:360px}.actions a{width:100%}.loopGrid,.finalGrid{grid-template-columns:1fr}.loopGrid article+article{padding-left:0;border-left:0;border-top:1px solid rgba(255,255,255,.08);padding-top:20px}.loopGrid article{padding-bottom:20px}}@media(prefers-reduced-motion:reduce){.welcome *{animation:none!important;transition:none!important}}
`
