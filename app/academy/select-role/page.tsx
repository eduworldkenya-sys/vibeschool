"use client";
import { useRouter } from 'next/navigation'
import { useRef, useEffect } from 'react'
import styles from './select-role.module.css'

const ROLES = [
  { key: 'teacher', label: 'TEACHER', descriptor: 'Manage classes, lessons and assessments.' },
  { key: 'parent',  label: 'PARENT',  descriptor: "Track your child's progress and communications." },
  { key: 'admin',   label: 'ADMIN',   descriptor: 'Oversee the institution and its members.' },
] as const

export default function AcademySelectRole() {
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
    navTimer.current = setTimeout(() => { window.location.href = destination }, 280)
  }

  return (
    <>
      <svg aria-hidden focusable="false" style={{ position: 'absolute', width: 0, height: 0, overflow: 'hidden' }}>
        <defs>
          <filter id="grain-academy-role">
            <feTurbulence type="fractalNoise" baseFrequency="0.68" numOctaves={4} stitchTiles="stitch" result="noise" />
            <feColorMatrix type="saturate" values="0" in="noise" result="grayNoise" />
            <feBlend in="SourceGraphic" in2="grayNoise" mode="overlay" />
          </filter>
        </defs>
      </svg>

      <div id="academy-role-root">
        <div id="scan-line" aria-hidden />
        <div className={styles.content} ref={contentRef}>

          <button className={styles.back} onClick={() => fadeOut('/select')} aria-label="Back to world select">←</button>

          <p className={styles.world}>ACADEMY</p>
          <p className={styles.heading}>WHO ARE YOU?</p>
          <p className={styles.sub}>Choose your role to continue.</p>

          <div className={styles.cards}>
            {ROLES.map((role, i) => (
              <div key={role.key} className={styles.card}
                role="button" tabIndex={0}
                aria-label={`Continue as ${role.label}`}
                style={{ animationDelay: `${i * 120}ms` }}
                onClick={() => fadeOut(`/academy/signin?role=${role.key}`)}
                onKeyDown={e => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    fadeOut(`/academy/signin?role=${role.key}`)
                  }
                }}>
                <div className={styles.cardGlow} aria-hidden />
                <div className={styles.cardBody}>
                  <p className={styles.cardTitle}>{role.label}</p>
                  <p className={styles.cardDescriptor}>{role.descriptor}</p>
                </div>
                <div className={styles.cardRule} />
                <span className={styles.chevron} aria-hidden>›</span>
              </div>
            ))}
          </div>

        </div>
      </div>
    </>
  )
}
