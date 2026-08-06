'use client'

import { useEffect } from 'react'

export default function StudentError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error('Student route error', error) }, [error])
  return <section role="alert" style={{ margin: '24px auto', maxWidth: 520, padding: 20, border: '1px solid #fecaca', borderRadius: 16, background: '#fef2f2', color: '#991b1b' }}>
    <div style={{ fontSize: 10, fontWeight: 900, letterSpacing: 1 }}>LEARNER HOME RECOVERY</div>
    <h1 style={{ margin: '7px 0', fontSize: 20 }}>Your home could not finish loading</h1>
    <p style={{ margin: '0 0 14px', fontSize: 12, lineHeight: 1.55 }}>Your learning data is safe. Reload this screen to restore the latest home state.</p>
    <button type="button" onClick={reset} style={{ width: '100%', border: 0, borderRadius: 10, padding: '11px 14px', background: '#991b1b', color: '#fff', fontFamily: 'inherit', fontWeight: 900, cursor: 'pointer' }}>Reload learner home</button>
  </section>
}
