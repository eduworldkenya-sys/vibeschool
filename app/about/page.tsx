import Link from 'next/link'
import type { Metadata } from 'next'
import { PublicHeader } from '@/components/public/PublicHeader'
import { PublicFooter } from '@/components/public/PublicFooter'

export const metadata: Metadata = {
  title: 'About VibeSchool',
  description: 'Get to know VibeSchool, a Kenyan education platform being built to make teaching easier and learning better.',
}

const audiences = [
  {
    title: 'Teachers',
    description: 'Find curriculum-linked resources, prepare lessons and check learning without starting from scratch.',
    href: '/teacher',
    link: 'For teachers',
  },
  {
    title: 'Learners',
    description: 'Find material to study, practise questions and work on topics that need more attention.',
    href: '/global',
    link: 'Explore learning',
  },
  {
    title: 'Parents',
    description: 'Get a clearer understanding of learning and how to support children at home.',
    href: '/product',
    link: 'See the platform',
  },
  {
    title: 'Schools',
    description: 'Bring teaching, learning and school work into a more organised place.',
    href: '/institutions',
    link: 'For schools',
  },
] as const

export default function AboutPage() {
  return (
    <div className="about-page">
      <PublicHeader />
      <main id="main-content">
        <section className="about-hero" aria-labelledby="about-title">
          <div className="about-wrap">
            <p className="about-eyebrow">ABOUT VIBESCHOOL</p>
            <h1 id="about-title">Making teaching easier. <em>Making learning better.</em></h1>
            <p className="about-lead">
              VibeSchool is a Kenyan education platform being built for the people who teach,
              learn and support children every day.
            </p>
            <Link href="/product" className="about-primary">Explore VibeSchool</Link>
          </div>
        </section>

        <section className="about-section" aria-labelledby="about-why">
          <div className="about-wrap about-story">
            <div>
              <p className="about-eyebrow about-eyebrow-dark">WHY WE STARTED</p>
              <h2 id="about-why">Teachers already have enough work to do.</h2>
            </div>
            <div className="about-copy">
              <p>
                A teacher may have a scheme of work in one file, lesson notes in another
                and assessment records somewhere else. All that work is connected,
                but the tools often aren’t.
              </p>
              <p>
                We’re building VibeSchool to bring curriculum, teaching content,
                lesson preparation and learning activities closer together.
                Work done today should make tomorrow’s teaching easier.
              </p>
            </div>
          </div>
        </section>

        <section className="about-section about-section-soft" aria-labelledby="about-who">
          <div className="about-wrap">
            <p className="about-eyebrow about-eyebrow-dark">WHO WE SERVE</p>
            <h2 id="about-who">For everyone involved in learning.</h2>
            <div className="about-audiences">
              {audiences.map(person => (
                <article className="about-audience" key={person.title}>
                  <h3>{person.title}</h3>
                  <p>{person.description}</p>
                  <Link href={person.href}>{person.link} <span aria-hidden="true">→</span></Link>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="about-section" aria-labelledby="about-kenya">
          <div className="about-wrap about-story">
            <div>
              <p className="about-eyebrow about-eyebrow-dark">BUILT FOR KENYA</p>
              <h2 id="about-kenya">Built around Kenyan classrooms.</h2>
            </div>
            <div className="about-copy">
              <p>
                Our starting point is the Kenyan curriculum and the work teachers
                already do: preparing schemes, planning lessons, explaining topics,
                setting practice and checking progress.
              </p>
              <p>
                We’re developing the platform step by step, with practical tools,
                useful content and everyday devices in mind.
              </p>
              <Link href="/trust" className="about-text-link">How we approach trust <span aria-hidden="true">→</span></Link>
            </div>
          </div>
        </section>

        <section className="about-purpose" aria-labelledby="about-purpose">
          <div className="about-wrap">
            <p className="about-eyebrow">WHAT GUIDES US</p>
            <h2 id="about-purpose">Useful learning content. Less repetitive work. Better support for every learner.</h2>
            <p>That’s what we want VibeSchool to help make possible.</p>
          </div>
        </section>

        <section className="about-founder" aria-label="Founder’s note">
          <div className="about-wrap about-founder-inner">
            <div>
              <p className="about-eyebrow about-eyebrow-dark">FROM THE FOUNDER</p>
              <h2>There’s a personal story behind VibeSchool, too.</h2>
            </div>
            <Link href="/about/founder-note" className="about-text-link">Read the founder’s note <span aria-hidden="true">→</span></Link>
          </div>
        </section>

        <section className="about-cta" aria-labelledby="about-next">
          <div className="about-wrap">
            <h2 id="about-next">Want to know more about VibeSchool?</h2>
            <p>See how the platform works, or get in touch with us.</p>
            <Link href="/contact" className="about-primary">Contact VibeSchool</Link>
          </div>
        </section>
      </main>
      <PublicFooter />
      <style>{styles}</style>
    </div>
  )
}

const styles = `
.about-page{font-family:var(--font-jakarta),Arial,sans-serif;color:#101827;background:#f8f8f5;line-height:1.65}
.about-page *{box-sizing:border-box}
.about-page .about-wrap{width:min(1120px,100%);margin:0 auto}
.about-page .about-eyebrow{margin:0 0 16px;letter-spacing:.15em;font-size:11px;font-weight:800;color:#d4b65b}
.about-page .about-eyebrow-dark{color:#80651f}
.about-page h1,.about-page h2{font-family:var(--font-display),Arial,sans-serif;line-height:1.09;letter-spacing:-.038em}
.about-page .about-hero{background:#07111f;color:#fff;padding:84px 24px 94px}
.about-page .about-hero h1{font-size:clamp(40px,6.2vw,72px);max-width:960px;margin:0 0 25px;font-weight:650}
.about-page .about-hero h1 em{font-family:var(--font-serif),Georgia,serif;font-weight:400;color:#d4b65b}
.about-page .about-lead{font-size:clamp(17px,2vw,20px);color:#d2d9e2;max-width:730px;margin:0 0 30px}
.about-page .about-primary{display:inline-flex;align-items:center;justify-content:center;min-height:48px;padding:12px 20px;border-radius:10px;font-weight:800;font-size:14px;background:#d0b154;color:#07111f;text-decoration:none}
.about-page .about-primary:hover{background:#e4c771}
.about-page .about-section{padding:76px 24px}
.about-page .about-section-soft{background:#f0ece1}
.about-page .about-section h2,.about-page .about-founder h2{margin:0 0 22px;font-size:clamp(29px,4vw,48px);max-width:760px}
.about-page .about-story{display:grid;grid-template-columns:.88fr 1.12fr;gap:64px;align-items:start}
.about-page .about-copy p{margin:0 0 18px;font-size:17px;color:#4c596a;max-width:640px}
.about-page .about-audiences{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:14px;margin-top:30px}
.about-page .about-audience{background:#fff;border:1px solid #dedfdf;border-radius:14px;padding:24px;display:flex;flex-direction:column;min-width:0}
.about-page .about-audience h3{font-size:20px;line-height:1.3;margin:0 0 10px;color:#17243a}
.about-page .about-audience p{font-size:15px;margin:0 0 18px;color:#556273;flex:1}
.about-page .about-audience a,.about-page .about-text-link{color:#6c5214;text-decoration:underline;text-underline-offset:4px;font-weight:800;font-size:14px;min-height:44px;display:inline-flex;align-items:center;gap:6px}
.about-page .about-purpose{padding:68px 24px 76px;background:#07111f;color:#fff}
.about-page .about-purpose h2{font-size:clamp(31px,4.6vw,54px);max-width:940px;margin:0 0 15px}
.about-page .about-purpose p:last-child{font-size:17px;color:#c5cfdb;margin:0}
.about-page .about-founder{padding:42px 24px;background:#f0ece1}
.about-page .about-founder-inner{display:flex;align-items:center;justify-content:space-between;gap:20px 40px}
.about-page .about-founder .about-eyebrow{margin-bottom:8px}
.about-page .about-founder h2{font-size:clamp(22px,3vw,30px);margin:0;max-width:630px}
.about-page .about-founder a{flex-shrink:0}
.about-page .about-cta{padding:76px 24px 84px;background:#13243a;color:#fff;text-align:center}
.about-page .about-cta h2{font-size:clamp(30px,4vw,46px);margin:0 0 12px}
.about-page .about-cta p{margin:0 auto 25px;color:#d0d8e2;font-size:17px}
.about-page a:focus-visible{outline:3px solid #d4b65b;outline-offset:4px}
@media(max-width:950px){.about-page .about-audiences{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media(max-width:780px){
 .about-page .about-hero{padding:60px 20px 68px}
 .about-page .about-section{padding:58px 20px}
 .about-page .about-story{grid-template-columns:1fr;gap:10px}
 .about-page .about-founder-inner{display:block}
 .about-page .about-founder a{margin-top:14px}
 .about-page .about-cta,.about-page .about-purpose{padding:58px 20px}
}
@media(max-width:480px){
 .about-page .about-audiences{grid-template-columns:1fr}
 .about-page .about-audience{padding:20px}
 .about-page .about-copy p{font-size:16px}
}
@media(prefers-reduced-motion:reduce){.about-page .about-primary{transition:none}}
`
