import type { Metadata } from 'next'
import Link from 'next/link'
import { PublicHeader } from '@/components/public/PublicHeader'
import { PublicFooter } from '@/components/public/PublicFooter'
import { getEvidencePublicationState, getPublishableEvidenceClaims } from '@/lib/publicEvidence'

export const metadata: Metadata = {
  alternates: { canonical: '/evidence' },
  title: 'Evidence & Product Status',
  description: 'See what VibeSchool offers publicly and what school results have been verified for publication.',
}

// Page-specific navigation keeps this evidence page focused without changing
// the shared public navigation used by other VibeSchool experiences.
const evidenceNavigation = [
  ['/product', 'Product'],
  ['/sandbox', 'Experience'],
  ['/trust', 'Trust'],
] as const

export default function EvidencePage() {
  const claims = getPublishableEvidenceClaims()
  const state = getEvidencePublicationState()

  return <div className="page">
    <PublicHeader product="Evidence" navigation={evidenceNavigation}/>
    <main id="main-content">
      <section className="hero">
        <div className="wrap">
          <p className="eyebrow">VIBESCHOOL EVIDENCE</p>
          <h1>What works today. What the evidence shows.</h1>
          <p className="lead">See what you can explore now and which school results have been checked and approved for publication.</p>
          <div className="actions"><Link className="primary" href="/sandbox">Explore VibeSchool</Link></div>
        </div>
      </section>

      <section className="section wrap" aria-labelledby="status-title">
        <p className="eyebrow dark">PRODUCT STATUS</p>
        <h2 id="status-title">What you can inspect</h2>
        <div className="ledger">
          <article><div><h3>Public product experience</h3><p>Explore how VibeSchool connects teaching, learning and evidence.</p></div><strong data-status="Available">Available</strong></article>
          <article><div><h3>School readiness check</h3><p>An eight-question, browser-local planning tool; not an external certification.</p></div><strong data-status="Available">Available</strong></article>
          <article><div><h3>Measured school outcomes</h3><p>Results are published only after they are measured, verified and approved for public use.</p></div><strong data-status="Validation">Validation</strong></article>
        </div>
      </section>

      <section className="section alt" aria-labelledby="results-title">
        <div className="wrap">
          <p className="eyebrow dark">SCHOOL RESULTS</p>
          <h2 id="results-title">Verified outcomes</h2>
          {claims.length === 0
            ? <div className="empty"><strong>No verified pilot outcome has been published yet.</strong><p>Working features and successful product tests do not, by themselves, prove improved learning outcomes.</p></div>
            : <div className="claims">{claims.map(claim => <article key={claim.id}>
              <p className="status">VERIFIED &amp; PERMISSIONED</p><h3>{claim.title}</h3>
              <div className="metric">{claim.value}</div>
              <dl>
                <div><dt>Metric</dt><dd>{claim.metric_definition}</dd></div>
                <div><dt>Window</dt><dd>{claim.measurement_window}</dd></div>
                <div><dt>Population</dt><dd>{claim.population}</dd></div>
                <div><dt>Method</dt><dd>{claim.method}</dd></div>
                <div><dt>Limitations</dt><dd>{claim.limitations.join(' ')}</dd></div>
              </dl>
            </article>)}</div>}
          <p className="review">Evidence register last reviewed {state.reviewedAt}. Unverified claims remain unpublished.</p>
        </div>
      </section>

      <section className="section wrap" aria-labelledby="standard-title">
        <div className="two">
          <div><p className="eyebrow dark">OUR STANDARD</p><h2 id="standard-title">Proof before public claims.</h2></div>
          <div>
            <p>We define the measure, record a starting point, run the pilot, check the results and obtain permission before publication. Operational row counts alone are never treated as adoption or impact proof.</p>
            <p>Public evidence does not expose raw learner records or private school information.</p>
          </div>
        </div>
      </section>
    </main>
    <PublicFooter focused/>
    <style>{styles}</style>
  </div>
}

const styles = ".page{background:#f8f8f5;color:#101827;font-family:var(--font-jakarta),Arial,sans-serif;line-height:1.7}.page *{box-sizing:border-box}.wrap{max-width:1120px;margin:auto}.hero{background:#07111f;color:#fff;padding:74px 24px;background-image:radial-gradient(circle at 82% 8%,rgba(208,177,84,.14),transparent 31%)}.eyebrow{font:850 11px var(--font-mono),monospace;letter-spacing:.15em;color:#d0b154}.eyebrow.dark{color:#755b17}h1,h2{font-family:var(--font-display),Arial,sans-serif;letter-spacing:-.04em;line-height:1.05}h1{font-size:clamp(43px,6vw,72px);max-width:920px;margin:14px 0 22px}h2{font-size:clamp(31px,4.4vw,50px);margin:10px 0 28px}.lead{font-size:18px;color:#c6cfda;max-width:820px}.actions{display:flex;gap:11px;flex-wrap:wrap;margin-top:26px}.actions a{padding:12px 17px;border-radius:10px;font-weight:850;text-decoration:none}.primary{background:#d0b154;color:#07111f}.secondary{border:1px solid #687789;color:#fff}.outline{border:1px solid #c9ccd3;color:#202632}.section{padding:64px 24px}.alt{background:#eeeae0}.dark{background:#13243a;color:#fff}.empty{border:1px solid #d9dce3;background:#fff;border-radius:18px;padding:28px;max-width:850px}.empty strong{font-size:20px}.empty p,.ledger p,.two p{color:#5f6875}.review{font-size:13px;color:#707782;margin-top:18px}.claims{display:grid;grid-template-columns:repeat(2,1fr);gap:14px}.claims article{background:#fff;border:1px solid #dfe2e7;border-radius:16px;padding:26px}.status{font:800 11px var(--font-mono);letter-spacing:.12em;color:#6f5615}.metric{font-size:38px;font-weight:900}.claims dl div{margin-top:11px}.claims dt{font-size:11px;font-weight:850;text-transform:uppercase;letter-spacing:.08em}.claims dd{margin:2px 0;color:#5f6875}.ledger{display:grid;gap:10px}.ledger article{display:flex;justify-content:space-between;gap:24px;align-items:flex-start;background:#fff;border:1px solid #dfe2e7;border-radius:14px;padding:22px}.ledger h3{margin:0}.ledger p{margin:5px 0 0}.ledger strong{white-space:nowrap;border-radius:999px;padding:7px 10px;font-size:12px;background:#eef0f4}.ledger strong[data-status='Available']{background:#e7f4eb;color:#205c35}.ledger strong[data-status='Validation']{background:#fff2cf;color:#76580c}.two{display:grid;grid-template-columns:1fr 1fr;gap:64px}.dark .two p{color:#bdc7d4}@media(max-width:780px){.hero,.section{padding:62px 18px}.claims,.two{grid-template-columns:1fr}.ledger article{flex-direction:column;gap:10px}}"
