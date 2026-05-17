'use client'
import { useRouter } from 'next/navigation'
import { useRef } from 'react'

export default function Home() {
  const router = useRouter()
  const contentRef = useRef<HTMLDivElement>(null)

  function handleEnter() {
    if (!contentRef.current) return
    contentRef.current.style.transition = 'opacity 280ms ease-in'
    contentRef.current.style.opacity = '0'
    setTimeout(() => router.push('/select'), 280)
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      handleEnter()
    }
  }

  return (
    <>
      <svg aria-hidden focusable="false" style={{ position: 'absolute', width: 0, height: 0, overflow: 'hidden' }}>
        <defs>
          <filter id="grain">
            <feTurbulence type="fractalNoise" baseFrequency="0.68" numOctaves={4} stitchTiles="stitch" result="noise" />
            <feColorMatrix type="saturate" values="0" in="noise" result="grayNoise" />
            <feBlend in="SourceGraphic" in2="grayNoise" mode="overlay" />
          </filter>
        </defs>
      </svg>

      <div id="root">
        <div id="scan-line" aria-hidden />
        <div className="bracket bracket-tl" aria-hidden />
        <div className="bracket bracket-tr" aria-hidden />
        <div className="bracket bracket-bl" aria-hidden />
        <div className="bracket bracket-br" aria-hidden />
        <div id="top-rule" aria-hidden />

        <main id="content" ref={contentRef}>
          <svg id="crest" viewBox="0 0 72 84" xmlns="http://www.w3.org/2000/svg" aria-label="VibeSchool crest" role="img">
            <path d="M36,4 L68,16 L68,52 Q68,76 36,82 Q4,76 4,52 L4,16 Z" fill="none" stroke="#C8A84B" strokeWidth="1.2" strokeLinejoin="round" />
            <path d="M36,10.76 L63.44,21.32 L63.44,52 Q63.44,72.52 36,77.64 Q8.56,72.52 8.56,52 L8.56,21.32 Z" fill="none" stroke="#C8A84B" strokeWidth="1.2" strokeLinejoin="round" />
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

          <p id="wordmark">VIBESCHOOL</p>
          <p id="academy">ACADEMY · GLOBAL</p>
          <p id="covenant">Built around the teacher.</p>

          <span
            id="enter"
            role="button"
            tabIndex={0}
            onClick={handleEnter}
            onKeyDown={handleKeyDown}
          >
            ENTER
          </span>
          <span id="arrow" aria-hidden onClick={handleEnter}>↓</span>
        </main>
      </div>
    </>
  )
}