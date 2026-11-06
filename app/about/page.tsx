import Link from "next/link"
import type { Metadata } from "next"
import { PublicHeader } from "@/components/public/PublicHeader"
import { PublicFooter } from "@/components/public/PublicFooter"

const description = "VibeSchool is a Kenyan education technology platform developed by Gilowinc Investment, connecting teaching, learning, assessment, tutoring and school services."

export const metadata: Metadata = {
  title: "About VibeSchool | Kenyan Education Technology Platform",
  description,
  alternates: { canonical: "/about" },
  openGraph: {
    title: "About VibeSchool | Kenyan Education Technology Platform",
    description,
    url: "/about",
    siteName: "VibeSchool",
    locale: "en_KE",
    type: "website",
  },
  twitter: { card: "summary_large_image", title: "About VibeSchool", description },
}

const audiences = [
  ["Learners", "Find resources, practise and understand what to learn next."],
  ["Teachers", "Plan lessons, teach, assess and support learner progress."],
  ["Parents & families", "Stay informed and support learning at home."],
  ["Schools", "Connect school activities, teaching and learner progress."],
] as const

const values = [
  ["Accessible", "Designed for Kenyan classrooms, families and everyday devices."],
  ["Connected", "Bringing learning activities and people together."],
  ["Trustworthy", "Respecting privacy, evidence and human responsibility."],
  ["Learner-focused", "Making each next learning step clearer."],
] as const

const organisation = {
  "@context": "https://schema.org",
  "@type": "Organization",
  "@id": "https://vibeschool.co.ke/#organization",
  name: "VibeSchool",
  url: "https://vibeschool.co.ke",
  description,
  parentOrganization: { "@type": "Organization", name: "Gilowinc Investment" },
  areaServed: { "@type": "Country", name: "Kenya" },
  sameAs: ["https://www.tiktok.com/@vibeschoolkenya"],
}

export default function AboutPage() {
  return <div className="about-page">
    <PublicHeader />
    <main id="main-content">
      <section className="about-hero">
        <div className="about-wrap">
          <p className="about-eyebrow">ABOUT VIBESCHOOL</p>
          <h1>Who We Are</h1>
          <p className="about-lead">VibeSchool is a Kenyan education technology platform developed by Gilowinc Investment. It provides digital solutions for schools, teachers, learners and parents, connecting curriculum, teaching, learning, assessment, tutoring and school services in one platform.</p>
          <div className="about-actions">
            <Link href="/product" className="about-primary">Explore VibeSchool</Link>
            <Link href="/contact" className="about-secondary">Contact us</Link>
          </div>
        </div>
      </section>

      <section className="about-section about-wrap" aria-labelledby="about-mission">
        <div className="about-duo">
          <article>
            <p className="about-eyebrow about-dark">OUR MISSION</p>
            <h2 id="about-mission">Make learning more connected.</h2>
            <p>Build the Education Operating System that turns curriculum into coordinated teaching, teaching into evidence, evidence into understanding, and understanding into better decisions for every learner.</p>
          </article>
          <article>
            <p className="about-eyebrow about-dark">OUR VISION</p>
            <h2>Every learner known. Every lesson connected. Every outcome visible.</h2>
            <p>Help teachers, learners, families and schools make better-informed educational decisions.</p>
          </article>
        </div>
      </section>

      <section className="about-section about-soft">
        <div className="about-wrap about-story">
          <div>
            <p className="about-eyebrow about-dark">WHY WE EXIST</p>
            <h2>Education works better when people are connected.</h2>
          </div>
          <p>Teachers plan and teach, learners practise, and families and schools support progress. VibeSchool brings those parts of education closer together, reducing the need to switch between disconnected tools.</p>
        </div>
      </section>

      <section className="about-section about-wrap">
        <p className="about-eyebrow about-dark">WHO WE SERVE</p>
        <h2>Built for the people behind learning.</h2>
        <div className="about-grid">
          {audiences.map(([title, body]) => <article key={title}><h3>{title}</h3><p>{body}</p></article>)}
        </div>
      </section>

      <section className="about-section about-soft">
        <div className="about-wrap">
          <p className="about-eyebrow about-dark">OUR VALUES</p>
          <h2>What guides our work.</h2>
          <div className="about-grid">
            {values.map(([title, body]) => <article key={title}><h3>{title}</h3><p>{body}</p></article>)}
          </div>
          <p className="about-trust">Learner safety, responsible technology and accurate educational information matter. <Link href="/trust">Read our Trust Centre</Link>.</p>
        </div>
      </section>

      <section className="about-cta">
        <div className="about-wrap">
          <h2>See what VibeSchool offers.</h2>
          <p>Explore our education platform or get in touch.</p>
          <div className="about-actions about-center">
            <Link href="/product" className="about-primary">Explore the product</Link>
            <Link href="/contact" className="about-secondary">Contact VibeSchool</Link>
          </div>
        </div>
      </section>
    </main>
    <PublicFooter />
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(organisation).replace(/</g, "\\u003c") }} />
    <style>{styles}</style>
  </div>
}

const styles = `
.about-page{font-family:var(--font-jakarta),Arial,sans-serif;color:#101827;background:#f8f8f5;line-height:1.65}
.about-page *{box-sizing:border-box}
.about-page .about-wrap{max-width:1120px;margin:0 auto}
.about-page .about-hero{background:#07111f;color:#fff;padding:80px 24px 88px}
.about-page .about-eyebrow{font:800 11px var(--font-mono),monospace;letter-spacing:.15em;color:#d0b154}
.about-page .about-dark{color:#80651f}
.about-page h1,.about-page h2{font-family:var(--font-display),Arial,sans-serif;letter-spacing:-.035em;line-height:1.13}
.about-page h1{font-size:clamp(45px,7vw,76px);margin:16px 0 22px}
.about-page h2{font-size:clamp(28px,4vw,43px);margin:12px 0 20px}
.about-page .about-lead{max-width:850px;font-size:clamp(18px,2vw,22px);color:#e2e7ef}
.about-page .about-actions{display:flex;gap:12px;flex-wrap:wrap;margin-top:28px}
.about-page .about-primary,.about-page .about-secondary{display:inline-flex;justify-content:center;align-items:center;padding:12px 20px;border-radius:9px;text-decoration:none;font-weight:800;min-height:46px}
.about-page .about-primary{background:#d0b154;color:#07111f}
.about-page .about-secondary{border:1px solid #8693a5;color:#fff}
.about-page .about-section{padding:70px 24px}
.about-page .about-duo{display:grid;grid-template-columns:1fr 1fr;gap:52px}
.about-page .about-duo article{min-width:0}
.about-page .about-section p:not(.about-eyebrow){color:#536072;font-size:17px}
.about-page .about-soft{background:#f0eee7}
.about-page .about-story{display:grid;grid-template-columns:1fr 1fr;gap:55px;align-items:center}
.about-page .about-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:14px;margin-top:30px}
.about-page .about-grid article{border:1px solid #e0e4e8;border-radius:12px;background:#fff;padding:22px}
.about-page .about-grid h3{font-size:19px;margin:0 0 8px}
.about-page .about-grid p{font-size:15px!important;margin:0}
.about-page .about-trust{margin:24px 0 0}
.about-page .about-trust a{color:#71591b;font-weight:750}
.about-page .about-cta{background:#13243a;color:#fff;text-align:center;padding:75px 24px}
.about-page .about-cta p{color:#d0d7e1}
.about-page .about-center{justify-content:center}
@media(max-width:900px){.about-page .about-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media(max-width:700px){.about-page .about-hero{padding:58px 20px 64px}.about-page .about-section{padding:54px 20px}.about-page .about-duo,.about-page .about-story{grid-template-columns:1fr;gap:22px}.about-page .about-grid{grid-template-columns:1fr}.about-page .about-cta{padding:58px 20px}.about-page .about-actions>a{flex:1 1 180px}}
`
