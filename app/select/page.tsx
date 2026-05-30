'use client'
import { useRouter } from 'next/navigation'
import { useRef, useEffect } from 'react'
import styles from './select.module.css'

export default function Select() {
  const router     = useRouter()
  const contentRef = useRef<HTMLDivElement>(null)
  const navTimer   = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => { if (navTimer.current) clearTimeout(navTimer.current) }
  }, [])

  function fadeOut(destination: string) {
    if (!contentRef.current) return
    contentRef.current.style.transition = 'opacity 280ms ease-in'
    contentRef.current.style.opacity    = '0'
    navTimer.current = setTimeout(() => router.push(destination), 280)
  }

  return (
    <>
      <svg aria-hidden focusable="false" style={{ position: 'absolute', width: 0, height: 0, overflow: 'hidden' }}>
        <defs>
          <filter id="grain-select">
            <feTurbulence type="fractalNoise" baseFrequency="0.68" numOctaves={4} stitchTiles="stitch" result="noise" />
            <feColorMatrix type="saturate" values="0" in="noise" result="grayNoise" />
            <feBlend in="SourceGraphic" in2="grayNoise" mode="overlay" />
          </filter>
        </defs>
      </svg>

      <div id="select-root">
        <div id="scan-line" aria-hidden />

        <div className={styles.content} ref={contentRef}>

          <div className={styles.crestWrapper} role="button" tabIndex={0}
            aria-label="Return to VibeSchool Hub"
            onClick={() => fadeOut('/')}
            onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fadeOut('/') } }}>
            <svg width="40" height="47" viewBox="0 0 72 84" xmlns="http://www.w3.org/2000/svg"
              aria-hidden className={styles.crest}>
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
              <circle cx="22.28" cy="27.38" r="1.4" fill="rgba(200,168,75,0.55)" />
              <circle cx="49.72" cy="27.38" r="1.4" fill="rgba(200,168,75,0.55)" />
              <circle cx="22.28" cy="60.82" r="1.4" fill="rgba(200,168,75,0.55)" />
              <circle cx="49.72" cy="60.82" r="1.4" fill="rgba(200,168,75,0.55)" />
            </svg>
          </div>

          <p className={styles.instruction}>CHOOSE YOUR WORLD</p>

          <div className={styles.cards}>

            <div className={`${styles.card} ${styles.cardAcademy}`}
              role="button" tabIndex={0}
              aria-label="Enter Academy — for schools, teachers and institutions"
              onClick={() => fadeOut('/academy/select-role')}
              onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fadeOut('/academy/select-role') } }}>
              <div className={styles.cardGlowAcademy} aria-hidden />
              <div className={styles.cardBody}>
                <p className={styles.cardTitle}>ACADEMY</p>
                <p className={styles.cardDescriptor}>For schools, teachers and institutions.</p>
              </div>
              <div className={styles.cardRuleAcademy} />
              <span className={styles.chevronAcademy} aria-hidden>›</span>
            </div>

            <div
              className={`${styles.card} ${styles.cardGlobal}`}
              aria-label="VibeGlobal — For everyone"
              tabIndex={0}
              onClick={() => fadeOut('/global/signin')}
              onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fadeOut('/global/signin') } }}
            >
              <div className={styles.cardGlowGlobal} aria-hidden />
              <div className={styles.cardBody}>
                <p className={styles.cardTitle}>GLOBAL</p>
                <p className={styles.cardDescriptor}>For everyone. Learn, earn, and vibe freely.</p>
              </div>
              <div className={styles.cardRuleGlobal} />
              <span style={{ fontSize: 11, color: 'rgba(200,168,75,0.7)', letterSpacing: '0.15em' }}>ENTER →</span>
            </div>

          </div>
        </div>
      </div>
    </>
  )
}
