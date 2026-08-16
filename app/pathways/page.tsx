import type { CSSProperties } from 'react'
import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Pathways Kenya | VibeSchool',
  description:
    'Free Kenyan education pathway guidance from VibeSchool. Explore pathways, careers, subjects and senior-school decisions with clear next steps and source-backed information.',
  alternates: {
    canonical: 'https://www.vibeschool.co.ke/pathways',
  },
  openGraph: {
    title: 'VibeSchool Pathways Kenya',
    description:
      'Understand your education options, explore careers and senior-school pathways, and know what to do next.',
    url: 'https://www.vibeschool.co.ke/pathways',
    siteName: 'VibeSchool',
    type: 'website',
  },
}

const entries = [
  {
    eyebrow: 'START HERE',
    title: 'I am not sure which direction fits me',
    body: 'Answer six short questions and get an early pathway indication. No login required.',
    href: '/pathways/check',
    action: 'Check my direction',
  },
  {
    eyebrow: 'CAREER',
    title: 'I know what I want to become',
    body: 'Start from a career and explore the learning direction behind it.',
    href: '/learn/careers',
    action: 'Explore careers',
  },
  {
    eyebrow: 'LEARN',
    title: 'I want to explore before deciding',
    body: 'Use VibeSchool learning resources while deeper Pathways data is source-verified.',
    href: '/global',
    action: 'Explore free',
  },
] as const

const pathwayFamilies = [
  {
    id: 'stem',
    name: 'STEM',
    summary: 'Science, technology, engineering and mathematics.',
  },
  {
    id: 'social-sciences',
    name: 'Social Sciences',
    summary: 'A pathway family covering social, humanities, language and business-oriented directions.',
  },
  {
    id: 'arts-and-sports-science',
    name: 'Arts & Sports Science',
    summary: 'A pathway family covering arts, creative expression and sports-oriented directions.',
  },
] as const

export default function PathwaysPage() {
  return (
    <main style={styles.root}>
      <div style={styles.shell}>
        <header style={styles.header}>
          <Link href="/" style={styles.brand} aria-label="VibeSchool home">
            Vibe<span style={styles.gold}>School</span>
          </Link>
          <Link href="/" style={styles.signIn}>Sign in</Link>
        </header>

        <section style={styles.hero}>
          <p style={styles.kicker}>VIBESCHOOL PATHWAYS · KENYA</p>
          <h1 style={styles.title}>What educational decision do you need help with?</h1>
          <p style={styles.lead}>
            Start with what you know. Get useful guidance first, then decide whether you want VibeSchool to remember and continue helping you.
          </p>
          <div style={styles.trustRow} aria-label="Pathways service principles">
            <span style={styles.trustPill}>Free to explore</span>
            <span style={styles.trustPill}>No login to start</span>
            <span style={styles.trustPill}>Evidence before claims</span>
          </div>
          <Link href="/pathways/check" style={styles.heroAction}>Check my direction — free</Link>
        </section>

        <section aria-labelledby="start-heading" style={styles.section}>
          <div style={styles.sectionHeadingRow}>
            <div>
              <p style={styles.kicker}>START WHERE YOU ARE</p>
              <h2 id="start-heading" style={styles.sectionTitle}>Choose the easiest starting point</h2>
            </div>
            <p style={styles.sectionHint}>You do not need to understand education policy terms before you start.</p>
          </div>

          <div style={styles.grid}>
            {entries.map((entry) => (
              <Link key={entry.title} href={entry.href} style={styles.card}>
                <span style={styles.cardEyebrow}>{entry.eyebrow}</span>
                <strong style={styles.cardTitle}>{entry.title}</strong>
                <span style={styles.cardBody}>{entry.body}</span>
                <span style={styles.cardAction}>{entry.action} →</span>
              </Link>
            ))}
          </div>
        </section>

        <section style={styles.section} aria-labelledby="families-heading">
          <p style={styles.kicker}>KENYA SENIOR SCHOOL</p>
          <h2 id="families-heading" style={styles.sectionTitle}>The three main pathway families</h2>
          <p style={{ ...styles.sectionHint, marginTop: 10, maxWidth: 700 }}>
            VibeSchool keeps official pathway facts separate from its own guidance. These high-level families are aligned to Kenya's Ministry of Education Grade 10 selection system; detailed combinations and school offerings will only be published when their source evidence is verified.
          </p>
          <div style={{ ...styles.grid, marginTop: 20 }}>
            {pathwayFamilies.map(pathway => (
              <article id={pathway.id} key={pathway.id} style={styles.familyCard}>
                <span style={styles.cardEyebrow}>OFFICIAL PATHWAY FAMILY</span>
                <h3 style={styles.familyTitle}>{pathway.name}</h3>
                <p style={styles.cardBody}>{pathway.summary}</p>
                <Link href="/pathways/check" style={styles.inlineAction}>See what fits me →</Link>
              </article>
            ))}
          </div>
        </section>

        <section style={styles.promise} aria-labelledby="promise-heading">
          <p style={styles.kicker}>THE PATHWAYS PROMISE</p>
          <h2 id="promise-heading" style={styles.promiseTitle}>Answer first. Sign in later.</h2>
          <p style={styles.promiseBody}>
            Pathways gives useful guidance before asking you to create an account. Signing in is for saving your pathway, connecting your own learning evidence and continuing the journey — not for unlocking a basic answer.
          </p>
        </section>

        <section style={styles.how} aria-labelledby="how-heading">
          <p style={styles.kicker}>HOW IT WORKS</p>
          <h2 id="how-heading" style={styles.sectionTitle}>Ask → Understand → Verify → Act</h2>
          <div style={styles.steps}>
            <div style={styles.step}><b>1</b><span><strong>Ask</strong><small>Start from yourself, a career, subject, school, location or question.</small></span></div>
            <div style={styles.step}><b>2</b><span><strong>Understand</strong><small>Get the shortest useful explanation first.</small></span></div>
            <div style={styles.step}><b>3</b><span><strong>Verify</strong><small>See evidence, source and uncertainty when it matters.</small></span></div>
            <div style={styles.step}><b>4</b><span><strong>Act</strong><small>Move to the next useful educational decision instead of reading a dead-end report.</small></span></div>
          </div>
        </section>

        <footer style={styles.footer}>
          <p>VibeSchool is an independent education platform. Official government information remains clearly identified and sourced; VibeSchool guidance is not an official placement decision.</p>
        </footer>
      </div>
    </main>
  )
}

const styles: Record<string, CSSProperties> = {
  root: { minHeight: '100vh', background: '#f7f7fb', color: '#101018' },
  shell: { width: 'min(1120px, 100%)', margin: '0 auto', padding: '0 18px 56px' },
  header: { minHeight: 72, display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #e7e7ef' },
  brand: { color: '#0a0a0f', textDecoration: 'none', fontWeight: 800, fontSize: 24, letterSpacing: '-0.5px' },
  gold: { color: '#9c7820' },
  signIn: { color: '#242438', fontSize: 13, fontWeight: 700, textDecoration: 'none', border: '1px solid #d7d7e2', borderRadius: 999, padding: '9px 14px', background: '#fff' },
  hero: { padding: '72px 0 46px', maxWidth: 850 },
  kicker: { margin: '0 0 10px', fontSize: 11, fontWeight: 800, letterSpacing: '0.16em', color: '#725815' },
  title: { margin: 0, maxWidth: 800, fontSize: 'clamp(38px, 7vw, 68px)', lineHeight: 1.02, letterSpacing: '-0.045em' },
  lead: { maxWidth: 720, margin: '24px 0 0', color: '#555568', fontSize: 'clamp(16px, 2.2vw, 20px)', lineHeight: 1.6 },
  heroAction: { display: 'inline-block', marginTop: 25, padding: '14px 18px', borderRadius: 14, background: '#4f46e5', color: '#fff', textDecoration: 'none', fontWeight: 850, fontSize: 14 },
  trustRow: { display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 24 },
  trustPill: { border: '1px solid #dedee8', background: '#fff', borderRadius: 999, padding: '8px 11px', fontSize: 12, fontWeight: 700, color: '#47475a' },
  section: { padding: '32px 0 64px' },
  sectionHeadingRow: { display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: 18, alignItems: 'end', marginBottom: 20 },
  sectionTitle: { margin: 0, fontSize: 'clamp(25px, 4vw, 36px)', letterSpacing: '-0.025em' },
  sectionHint: { maxWidth: 430, margin: 0, color: '#6a6a7a', lineHeight: 1.55, fontSize: 13 },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 14 },
  card: { minHeight: 210, display: 'flex', flexDirection: 'column', padding: 24, border: '1px solid #dfdfe8', borderRadius: 20, background: '#fff', color: '#11111a', textDecoration: 'none' },
  familyCard: { minHeight: 190, padding: 22, border: '1px solid #dfdfe8', borderRadius: 20, background: '#fff' },
  familyTitle: { fontSize: 22, margin: '15px 0 8px', letterSpacing: '-0.02em' },
  cardEyebrow: { fontSize: 10, fontWeight: 800, letterSpacing: '0.15em', color: '#806216' },
  cardTitle: { marginTop: 18, fontSize: 22, letterSpacing: '-0.02em', lineHeight: 1.15 },
  cardBody: { marginTop: 10, color: '#626272', fontSize: 14, lineHeight: 1.55 },
  cardAction: { marginTop: 'auto', paddingTop: 24, color: '#5c460f', fontSize: 13, fontWeight: 800 },
  inlineAction: { display: 'inline-block', marginTop: 15, color: '#4f46e5', textDecoration: 'none', fontSize: 12, fontWeight: 850 },
  promise: { borderRadius: 24, background: '#0c0c16', color: '#fff', padding: 'clamp(28px, 6vw, 56px)', marginBottom: 64 },
  promiseTitle: { margin: 0, fontSize: 'clamp(28px, 5vw, 46px)', letterSpacing: '-0.03em' },
  promiseBody: { margin: '18px 0 0', maxWidth: 760, color: '#cacada', lineHeight: 1.7, fontSize: 16 },
  how: { paddingBottom: 64 },
  steps: { display: 'grid', gap: 10, marginTop: 22 },
  step: { display: 'flex', gap: 14, alignItems: 'flex-start', padding: 18, borderRadius: 16, border: '1px solid #e1e1e9', background: '#fff' },
  footer: { borderTop: '1px solid #e2e2ea', paddingTop: 24, color: '#777786', fontSize: 12, lineHeight: 1.6 },
}
