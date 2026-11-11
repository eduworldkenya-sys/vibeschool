import Link from 'next/link'
import type { Metadata } from 'next'
import { PublicHeader } from '@/components/public/PublicHeader'
import { PublicFooter } from '@/components/public/PublicFooter'

export const metadata: Metadata = {
  title: 'A Note from the Founder | VibeSchool',
  description: 'A personal dedication from the founder of VibeSchool.',
  alternates: { canonical: '/about/founder-note' },
}

export default function FounderNotePage() {
  return (
    <div className="founder-page">
      <PublicHeader />
      <main id="main-content">
        <section className="founder-hero">
          <div className="founder-wrap">
            <Link href="/about" className="founder-back">← About VibeSchool</Link>
            <p className="founder-eyebrow">A DEDICATION FROM THE FOUNDER</p>
            <h1>The People Who Matter</h1>
            <p>Some bonds remain strong, regardless of time or distance.</p>
          </div>
        </section>

        <article className="founder-note" aria-labelledby="dedication-title">
          <div className="founder-wrap">
            <p className="founder-names">Ramadhan Ali · Brian Kariara · James Maina</p>
            <h2 id="dedication-title">To All My Sons</h2>
            <p>You are part of my journey, my inspiration, and the legacy I hope to leave behind. Each of you holds a special place in my heart, whether named here or not.</p>
            <p className="founder-signature">— Founder, VibeSchool</p>
          </div>
        </article>
      </main>
      <PublicFooter />
      <style>{styles}</style>
    </div>
  )
}

const styles = `
.founder-page{font-family:var(--font-jakarta),Arial,sans-serif;color:#101827;background:#f8f8f5;line-height:1.7}
.founder-page *{box-sizing:border-box}
.founder-page .founder-wrap{width:min(850px,100%);margin:0 auto}
.founder-page .founder-hero{background:#07111f;color:#fff;padding:70px 24px 75px}
.founder-page .founder-back{display:inline-flex;align-items:center;min-height:44px;color:#e2c979;font-size:14px;font-weight:750;margin-bottom:24px;text-underline-offset:4px}
.founder-page .founder-eyebrow{margin:0 0 12px;color:#d4b65b;font-size:11px;letter-spacing:.15em;font-weight:800}
.founder-page h1,.founder-page h2{font-family:var(--font-display),Arial,sans-serif;line-height:1.12;letter-spacing:-.04em}
.founder-page h1{font-size:clamp(42px,6vw,70px);margin:0 0 14px}
.founder-page .founder-hero p:last-child{font-size:19px;color:#d1d9e4;max-width:670px;margin:0}
.founder-page .founder-note{text-align:center;padding:70px 24px 86px}
.founder-page .founder-names{font-size:clamp(18px,2.4vw,23px);font-weight:800;color:#17243a;line-height:1.8;margin:0 0 36px}
.founder-page .founder-note h2{font-size:clamp(28px,4vw,42px);margin:0 0 18px}
.founder-page .founder-note h2+p{color:#4c596a;font-size:18px;max-width:700px;margin:0 auto}
.founder-page .founder-signature{margin:26px 0 0;color:#596474;font-size:14px}
.founder-page a:focus-visible{outline:3px solid #d4b65b;outline-offset:4px}
@media(max-width:640px){.founder-page .founder-hero{padding:48px 20px 56px}.founder-page .founder-note{padding:52px 20px 65px}.founder-page .founder-note h2+p{font-size:16px}}
`
