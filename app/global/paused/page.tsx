import Link from 'next/link'

export default function GlobalPausedPage() {
  return (
    <main style={{ minHeight: '100dvh', display: 'grid', placeItems: 'center', background: '#05050F', color: '#fff', padding: 24 }}>
      <section style={{ width: 'min(100%, 620px)', textAlign: 'center', border: '1px solid rgba(255,255,255,.1)', borderRadius: 22, background: '#111827', padding: 'clamp(28px,7vw,52px)' }}>
        <div style={{ color: '#CCFF00', fontSize: 12, fontWeight: 900, letterSpacing: '.14em' }}>VIBESCHOOL</div>
        <h1 style={{ margin: '14px 0 10px', fontSize: 'clamp(28px,7vw,44px)', lineHeight: 1.08 }}>Global accounts are temporarily paused.</h1>
        <p style={{ margin: '0 auto', maxWidth: 490, color: 'rgba(255,255,255,.68)', lineHeight: 1.65 }}>
          We are improving the Global account experience. Your account and saved information remain protected. Reading stays open while this work continues.
        </p>
        <Link href="/global/read" style={{ display: 'inline-flex', marginTop: 24, minHeight: 46, alignItems: 'center', justifyContent: 'center', borderRadius: 12, background: '#CCFF00', color: '#090D16', padding: '0 20px', textDecoration: 'none', fontWeight: 900 }}>
          Open Reader
        </Link>
      </section>
    </main>
  )
}
