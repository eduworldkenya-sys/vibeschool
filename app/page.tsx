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
    setTimeout(() => router.push('/academy/select-role'), 280)
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      handleEnter()
    }
  }

  return (
    <>
      <style>{`
        .splash-root {
          position: relative;
          isolation: isolate;
          height: 100dvh;
          width: 100vw;
          overflow: clip;
          background: var(--color-void);
        }
        .splash-root::before {
          content: '';
          position: fixed;
          inset: 0;
          z-index: 1;
          pointer-events: none;
          background: radial-gradient(
            ellipse 72% 48% at 50% -4%,
            rgba(200, 168, 75, 0.09) 0%,
            transparent 72%
          );
        }
        .splash-root::after {
          content: '';
          position: fixed;
          inset: 0;
          z-index: 5;
          pointer-events: none;
          opacity: 0.038;
          filter: url(#grain);
          width: 100%;
          height: 100%;
        }
        .splash-scan-line {
          position: fixed;
          z-index: 2;
          pointer-events: none;
          width: 100vw;
          height: 1px;
          left: 0;
          background: linear-gradient(
            90deg,
            transparent 0%,
            rgba(200, 168, 75, 0.07) 40%,
            rgba(200, 168, 75, 0.11) 50%,
            rgba(200, 168, 75, 0.07) 60%,
            transparent 100%
          );
          transform: rotate(-12deg) scaleX(1.6);
          animation: scanDrift 18s linear infinite;
          will-change: top;
        }
        @keyframes scanDrift {
          from { top: -4%; }
          to   { top: 108%; }
        }
        .splash-bracket {
          position: fixed;
          z-index: 4;
          width: 28px;
          height: 28px;
          border-color: rgba(200, 168, 75, 0.55);
          border-style: solid;
          border-width: 0;
          pointer-events: none;
        }
        .splash-bracket-tl { top: 20px;    left: 20px;   border-top-width: 1px;    border-left-width: 1px;  }
        .splash-bracket-tr { top: 20px;    right: 20px;  border-top-width: 1px;    border-right-width: 1px; }
        .splash-bracket-bl { bottom: 20px; left: 20px;   border-bottom-width: 1px; border-left-width: 1px;  }
        .splash-bracket-br { bottom: 20px; right: 20px;  border-bottom-width: 1px; border-right-width: 1px; }
        .splash-top-rule {
          position: fixed;
          top: 0; left: 0;
          width: 100%; height: 1px;
          z-index: 4;
          pointer-events: none;
          background: linear-gradient(
            90deg,
            transparent 0%,
            rgba(200, 168, 75, 0.00) 8%,
            rgba(200, 168, 75, 0.72) 38%,
            rgba(200, 168, 75, 0.90) 50%,
            rgba(200, 168, 75, 0.72) 62%,
            rgba(200, 168, 75, 0.00) 92%,
            transparent 100%
          );
        }
        .splash-content {
          position: relative;
          z-index: 3;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          height: 100dvh;
          width: 100%;
          gap: 0;
        }
        .splash-crest {
          display: block;
          width: 72px;
          height: 84px;
          margin-bottom: 28px;
          filter:
            drop-shadow(0 0 7px rgba(200, 168, 75, 0.38))
            drop-shadow(0 0 18px rgba(200, 168, 75, 0.14));
        }
        .splash-wordmark {
          font-family: var(--font-display);
          font-weight: 800;
          font-size: clamp(28px, 5.2vw, 52px);
          color: var(--color-white);
          letter-spacing: 0.32em;
          text-transform: uppercase;
          margin-bottom: 14px;
        }
        .splash-academy {
          font-family: var(--font-mono);
          font-weight: 400;
          font-size: clamp(9px, 2.5vw, 11px);
          color: var(--color-gold);
          letter-spacing: 0.48em;
          text-transform: uppercase;
          margin-bottom: 18px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          max-width: 90vw;
        }
        .splash-covenant {
          font-family: var(--font-serif);
          font-style: italic;
          font-weight: 400;
          font-size: clamp(12px, 1.3vw, 15px);
          color: var(--color-white-soft);
          letter-spacing: 0.04em;
          margin-bottom: 56px;
        }
        .splash-enter {
          font-family: var(--font-display);
          font-weight: 600;
          font-size: clamp(11px, 1.2vw, 13px);
          color: var(--color-gold);
          letter-spacing: 0.58em;
          text-transform: uppercase;
          cursor: pointer;
          margin-bottom: 10px;
          user-select: none;
          transition: letter-spacing 320ms var(--ease-gold);
        }
        .splash-enter:hover,
        .splash-enter:focus-visible {
          letter-spacing: 0.72em;
          outline: none;
        }
        .splash-arrow {
          font-family: var(--font-display);
          font-weight: 300;
          font-size: 13px;
          color: rgba(200, 168, 75, 0.72);
          animation: arrowBounce 2.2s ease-in-out infinite;
          will-change: transform;
          cursor: pointer;
          user-select: none;
          margin-bottom: 32px;
        }
        @keyframes arrowBounce {
          0%, 100% { transform: translateY(0); }
          50%      { transform: translateY(5px); }
        }
        .splash-legal {
          position: fixed;
          bottom: 24px;
          left: 0;
          width: 100%;
          text-align: center;
          z-index: 6;
          font-family: monospace;
          font-size: 9px;
          color: rgba(255, 255, 255, 0.22);
          letter-spacing: 0.04em;
        }
        .splash-legal a {
          color: rgba(200, 168, 75, 0.45);
          text-decoration: none;
          transition: color 180ms ease-out;
        }
        .splash-legal a:hover {
          color: rgba(200, 168, 75, 0.82);
        }
      `}</style>

      <svg aria-hidden focusable="false" style={{ position: 'absolute', width: 0, height: 0, overflow: 'hidden' }}>
        <defs>
          <filter id="grain">
            <feTurbulence type="fractalNoise" baseFrequency="0.68" numOctaves={4} stitchTiles="stitch" result="noise" />
            <feColorMatrix type="saturate" values="0" in="noise" result="grayNoise" />
            <feBlend in="SourceGraphic" in2="grayNoise" mode="overlay" />
          </filter>
        </defs>
      </svg>

      <div className="splash-root">
        <div className="splash-scan-line" aria-hidden />
        <div className="splash-bracket splash-bracket-tl" aria-hidden />
        <div className="splash-bracket splash-bracket-tr" aria-hidden />
        <div className="splash-bracket splash-bracket-bl" aria-hidden />
        <div className="splash-bracket splash-bracket-br" aria-hidden />
        <div className="splash-top-rule" aria-hidden />

        <main className="splash-content" ref={contentRef}>
          <svg className="splash-crest" viewBox="0 0 72 84" xmlns="http://www.w3.org/2000/svg" aria-label="VibeSchool crest" role="img">
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

          <p className="splash-wordmark">VIBESCHOOL</p>
          <p className="splash-academy">ACADEMY</p>
          <p className="splash-covenant">Built around the teacher.</p>

          <span
            className="splash-enter"
            role="button"
            tabIndex={0}
            onClick={handleEnter}
            onKeyDown={handleKeyDown}
          >
            Learn. Explore. Discover.
          </span>
          <span className="splash-arrow" aria-hidden onClick={handleEnter}>↓</span>
        </main>

        <p className="splash-legal">
          By continuing you agree to our{' '}
          <a href="#" target="_blank" rel="noopener noreferrer">Terms &amp; Conditions</a>
          {' '}and{' '}
          <a href="#" target="_blank" rel="noopener noreferrer">Privacy Policy</a>
        </p>
      </div>
    </>
  )
}
