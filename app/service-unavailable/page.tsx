export default function ServiceUnavailablePage() {
  return (
    <main style={{ minHeight: '100dvh', display: 'grid', placeItems: 'center', background: '#07111f', color: '#f8fafc', padding: 24 }}>
      <section style={{ width: '100%', maxWidth: 520, border: '1px solid rgba(255,255,255,.08)', borderRadius: 18, padding: 24, background: '#0d1b2f', textAlign: 'center' }}>
        <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: 1.2, color: 'rgba(255,255,255,.48)', textTransform: 'uppercase' }}>VibeSchool HQ</div>
        <h1 style={{ margin: '12px 0 8px', fontSize: 24 }}>This service is temporarily unavailable</h1>
        <p style={{ margin: 0, color: 'rgba(255,255,255,.68)', lineHeight: 1.6 }}>
          Access is currently restricted by company policy. Your account and data remain intact.
        </p>
      </section>
    </main>
  )
}
