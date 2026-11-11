import type { Metadata } from 'next'
import Link from 'next/link'
import { PublicHeader } from '@/components/public/PublicHeader'
import { PublicFooter } from '@/components/public/PublicFooter'

export const metadata: Metadata = {
  title: 'Trust Centre',
  description: 'How VibeSchool approaches child safety, personal information, account access, learning content and AI — and how to raise a concern.',
}

const answers = [
  {
    title: 'How do you protect children?',
    body: 'Children need more protection than adult users. Learner information is intended for people with the right school or family relationship, not anyone who asks to see it. Parental or guardian consent is required where the law calls for it. Safety concerns must be taken seriously and handled by people.',
  },
  {
    title: 'What happens to personal information?',
    body: 'We use information to provide learning and school services, manage accounts and provide support. We aim to collect only what is needed for a clear purpose. VibeSchool does not sell personal data or use learner information for behavioural advertising. You can ask about accessing, correcting or deleting your information, subject to applicable rules.',
  },
  {
    title: 'Who can see my account or school records?',
    body: 'Being signed in does not give someone access to every learner or school. Access should depend on verified identity, assigned responsibilities and the right relationship to the information. Private records must not become public simply because someone knows a name, phone number or link. Never share passwords or one-time codes with support staff.',
  },
  {
    title: 'Can I rely on learning information?',
    body: 'We work to keep curriculum information, teaching materials and learning records accurate. Official sources, VibeSchool-created content and user-provided information are different, and should be clearly distinguished. When something is incomplete or unverified, we should say so instead of presenting a guess as a fact. You can report a mistake.',
  },
  {
    title: 'What does VibeSchool use AI for?',
    body: 'AI can help explain a topic, prepare material or suggest practice. Its answers can still be wrong. Teachers and other responsible adults remain in charge of important educational and safeguarding decisions. AI-generated suggestions should not be treated as official curriculum or as proof that a learner has mastered a skill.',
  },
] as const

export default function TrustPage() {
  return (
    <div className="trust-page">
      <PublicHeader product="Trust"/>
      <main id="main-content">
        <section className="trust-hero" aria-labelledby="trust-heading">
          <div className="trust-wrap">
            <p className="trust-eyebrow">VIBESCHOOL TRUST CENTRE</p>
            <h1 id="trust-heading">Your safety and information matter.</h1>
            <p className="trust-lead">Here is how we approach children’s safety, your information and the learning content you use. You should not have to read a legal document to understand the basics.</p>
          </div>
        </section>

        <section className="trust-section" aria-labelledby="trust-answers-heading">
          <div className="trust-wrap">
            <p className="trust-eyebrow trust-eyebrow-dark">YOUR QUESTIONS, ANSWERED</p>
            <h2 id="trust-answers-heading">What you should know</h2>
            <div className="trust-grid">
              {answers.map(item => (
                <article key={item.title} className="trust-answer">
                  <h3>{item.title}</h3>
                  <p>{item.body}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="trust-section trust-soft" aria-labelledby="trust-report-heading">
          <div className="trust-wrap trust-report">
            <div>
              <p className="trust-eyebrow trust-eyebrow-dark">NEED TO REPORT A PROBLEM?</p>
              <h2 id="trust-report-heading">Tell us what happened.</h2>
            </div>
            <div>
              <p>Found incorrect learning information? Worried about privacy, a school account or a child’s safety? Tell VibeSchool so the concern can be reviewed.</p>
              <p>For an account-related concern, sign in on the Contact page and choose <strong>Privacy</strong> or <strong>Safety / safeguarding</strong> when submitting a support request. For a general question, you can contact us without an account.</p>
              <p className="trust-caution">Do not send passwords, access codes or private learner records through public WhatsApp. If someone is in immediate danger, contact local emergency or safeguarding authorities instead of relying on a website response.</p>
              <Link href="/contact" className="trust-primary">Contact VibeSchool</Link>
            </div>
          </div>
        </section>

        <section className="trust-policy" aria-labelledby="trust-policy-heading">
          <div className="trust-wrap trust-policy-inner">
            <div>
              <p className="trust-eyebrow">FORMAL POLICIES</p>
              <h2 id="trust-policy-heading">Need the full rules?</h2>
              <p>Our policy hub includes privacy, terms, acceptable use and detailed guidance on child safety, security and responsible AI. Schools can use these documents when evaluating VibeSchool.</p>
            </div>
            <Link href="/legal" className="trust-policy-link">Read policies and guidance <span aria-hidden="true">→</span></Link>
          </div>
        </section>
      </main>
      <PublicFooter/>
      <style>{styles}</style>
    </div>
  )
}

const styles = `
.trust-page{background:#f8f8f5;color:#101827;font-family:var(--font-jakarta),Arial,sans-serif;line-height:1.7}
.trust-page *{box-sizing:border-box}
.trust-page .trust-wrap{max-width:1100px;margin:0 auto}
.trust-page .trust-hero{background:#07111f;color:#fff;padding:78px 24px 86px}
.trust-page .trust-eyebrow{font:850 11px var(--font-mono),monospace;letter-spacing:.15em;color:#d0b154;margin:0 0 13px}
.trust-page .trust-eyebrow-dark{color:#755b17}
.trust-page h1,.trust-page h2{font-family:var(--font-display),Arial,sans-serif;letter-spacing:-.04em;line-height:1.08}
.trust-page .trust-hero h1{font-size:clamp(40px,6vw,68px);max-width:900px;margin:0 0 20px}
.trust-page .trust-lead{font-size:clamp(17px,2vw,19px);color:#cbd4df;max-width:760px;margin:0}
.trust-page .trust-section{padding:70px 24px}
.trust-page .trust-section h2{font-size:clamp(30px,4vw,46px);margin:0 0 25px}
.trust-page .trust-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}
.trust-page .trust-answer{border:1px solid #e0e3e7;border-radius:14px;background:#fff;padding:25px;min-width:0}
.trust-page .trust-answer h3{font-size:20px;line-height:1.3;margin:0 0 11px;color:#17243a}
.trust-page .trust-answer p{font-size:15px;color:#505d6c;margin:0;line-height:1.72}
.trust-page .trust-soft{background:#eeeae0}
.trust-page .trust-report{display:grid;grid-template-columns:.85fr 1.15fr;gap:56px;align-items:start}
.trust-page .trust-report h2{margin-bottom:0}
.trust-page .trust-report p{font-size:16px;color:#4f5967;margin:0 0 14px}
.trust-page .trust-report .trust-caution{font-size:14px;color:#5a5147}
.trust-page .trust-primary{display:inline-flex;align-items:center;justify-content:center;min-height:48px;padding:11px 19px;background:#13243a;color:#fff;border-radius:10px;text-decoration:none;font-weight:800;margin-top:6px}
.trust-page .trust-policy{background:#13243a;color:#fff;padding:52px 24px}
.trust-page .trust-policy-inner{display:flex;align-items:center;justify-content:space-between;gap:28px}
.trust-page .trust-policy h2{font-size:clamp(29px,3.5vw,39px);margin:0 0 10px}
.trust-page .trust-policy p:last-child{color:#c5cfdb;max-width:720px;margin:0;font-size:15px}
.trust-page .trust-policy-link{display:inline-flex;align-items:center;justify-content:center;min-height:48px;padding:10px 17px;border:1px solid #d0b154;border-radius:10px;color:#e5cb7c;text-decoration:none;font-weight:800;white-space:nowrap;flex-shrink:0}
.trust-page a:focus-visible{outline:3px solid #d0b154;outline-offset:4px}
.trust-page .trust-primary:hover{background:#243956}
.trust-page .trust-policy-link:hover{background:rgba(208,177,84,.12)}
@media(max-width:750px){.trust-page .trust-hero{padding:61px 20px 70px}.trust-page .trust-section{padding:55px 20px}.trust-page .trust-grid,.trust-page .trust-report{grid-template-columns:1fr}.trust-page .trust-report{gap:15px}.trust-page .trust-policy{padding:46px 20px}.trust-page .trust-policy-inner{flex-direction:column;align-items:stretch}.trust-page .trust-policy-link{align-self:flex-start;white-space:normal}}
@media(max-width:480px){.trust-page .trust-answer{padding:20px}.trust-page .trust-answer p{font-size:15px}}
`
