'use client'
import { useRouter } from 'next/navigation'

export default function NotFound() {
  const router = useRouter()

  return (
    <div style={{
      minHeight: '100dvh',
      background: '#0a0a0f',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '1.5rem',
      fontFamily: 'var(--font-mono, monospace)',
      color: '#C8A84B',
      textAlign: 'center',
      padding: '2rem',
    }}>
      <svg width="48" height="56" viewBox="0 0 72 84" xmlns="http://www.w3.org/2000/svg" aria-hidden>
        <path d="M36,4 L68,16 L68,52 Q68,76 36,82 Q4,76 4,52 L4,16 Z"
          fill="none" stroke="#C8A84B" strokeWidth="1.2" strokeLinejoin="round" />
        <path d="M36,10.76 L63.44,21.32 L63.44,52 Q63.44,72.52 36,77.64 Q8.56,72.52 8.56,52 L8.56,21.32 Z"
          fill="none" stroke="#C8A84B" strokeWidth="1.2" strokeLinejoin="round" />
        <line x1="36" y1="10.76" x2="36" y2="77.64" stroke="#C8A84B" strokeWidth="1.2" />
        <line x1="8.56" y1="44" x2="63.44" y2="44" stroke="#C8A84B" strokeWidth="1.2" />
        <circle cx="36"    cy="10.76" r="2.4" fill="#C8A84B" />
        <circle cx="36"    cy="77.64" r="2.4" fill="#C8A84B" />
        <circle cx="8.56"  cy="44"    r="2.4" fill="#C8A84B" />
        <circle cx="63.44" cy="44"    r="2.4" fill="#C8A84B" />
        <rect x="32.5" y="40.5" width="7" height="7" fill="#C8A84B" transform="rotate(45 36 44)" />
      </svg>

      <p style={{ fontSize: '0.7rem', letterSpacing: '0.3em', color: '#555' }}>ERROR 404</p>
      <p style={{ fontSize: '1.1rem', letterSpacing: '0.2em', margin: 0 }}>PAGE NOT FOUND</p>
      <p style={{ fontSize: '0.75rem', color: '#555', letterSpacing: '0.15em', maxWidth: '260px' }}>
        This page does not exist or has been moved.
      </p>

      <span
        role="button"
        tabIndex={0}
        onClick={() => router.push('/')}
        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') router.push('/') }}
        style={{
          marginTop: '1rem',
          fontSize: '0.7rem',
          letterSpacing: '0.3em',
          color: '#C8A84B',
          cursor: 'pointer',
          borderBottom: '1px solid #C8A84B44',
          paddingBottom: '2px',
        }}
      >
        RETURN HOME
      </span>
    </div>
  )
}
