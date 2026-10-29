'use client'

import { useEffect, useRef, useState } from 'react'
import styles from './SuccessWishesFloatingOffer.module.css'
import SuccessWishesGroupDemo from './SuccessWishesGroupDemo'

const SESSION_KEY = 'success-wishes-2026-floating-offer-dismissed'

export default function SuccessWishesFloatingOffer({ preview = false }: { preview?: boolean }) {
  const [visible, setVisible] = useState(false)
  const [demoOpen, setDemoOpen] = useState(false)
  const engaged = useRef(false)

  useEffect(() => {
    if (preview) { setVisible(true); return }
    try { if (sessionStorage.getItem(SESSION_KEY) === '1') return } catch { /* Keep advert available when storage is blocked. */ }
    engaged.current = false
    const timer = window.setTimeout(() => { if (!engaged.current) setVisible(true) }, 1400)
    // The approved offer belongs to browsing, never above personalisation or payment.
    const pauseOffer = () => {
      engaged.current = true
      window.clearTimeout(timer)
      setVisible(false)
    }
    const onInteraction = (event: Event) => {
      if (event.target instanceof Element && event.target.closest('#wish-composer, #wish-preview, [role="dialog"]')) pauseOffer()
    }
    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) pauseOffer()
    })
    for (const id of ['wish-composer', 'wish-preview']) {
      const section = document.getElementById(id)
      if (section) observer.observe(section)
    }
    document.addEventListener('focusin', onInteraction)
    document.addEventListener('pointerdown', onInteraction, true)
    return () => {
      window.clearTimeout(timer)
      observer.disconnect()
      document.removeEventListener('focusin', onInteraction)
      document.removeEventListener('pointerdown', onInteraction, true)
    }
  }, [preview])

  function close() {
    setVisible(false)
    try { sessionStorage.setItem(SESSION_KEY, '1') } catch { /* Non-persistent dismissal is fine. */ }
  }

  function chooseFour() {
    setVisible(false)
    setDemoOpen(true)
  }

  function chooseOne() {
    close()
    document.getElementById('choose-card')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  if (!visible && !demoOpen) return null

  return (
    <>
    {visible && <aside className={styles.floating} aria-label="Success Wishes 2026 offers">
      <button type="button" className={styles.dismiss} aria-label="Close Success Wishes offer" onClick={close}>×</button>
      <div className={styles.heading}>
        <span>VIBESCHOOL PRESENTS</span>
        <h2>Success Wishes 2026</h2>
        <p>A little wish. A big smile.</p>
      </div>
      <div className={styles.offers}>
        <div className={styles.single}>
          <span>PERSONAL WISH</span>
          <strong>KSh 50</strong>
          <p>1 student</p>
          <p className={styles.tagline}>Just for them.</p>
          <button type="button" onClick={chooseOne}>Choose One</button>
        </div>
        <div className={styles.group} role="button" tabIndex={0} aria-label="KSh 100 Group Wishes. Open four-student demo" onClick={chooseFour} onKeyDown={event => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); chooseFour() } }} style={{ cursor: "pointer" }}>
          <span>GROUP WISHES</span>
          <strong>KSh 100</strong>
          <p>Up to 4 students</p>
          <p className={styles.free}>Get 2 FREE</p>
          <button type="button" title="Try group wishes demo — no payment" onClick={event => { event.stopPropagation(); chooseFour() }}>Choose Four</button>
        </div>
      </div>
      <p className={styles.footer}>Personalised cards. Private wishes.</p>
    </aside>}
    {demoOpen && <SuccessWishesGroupDemo onClose={() => { setDemoOpen(false); setVisible(preview || !engaged.current) }} />}
    </>
  )
}
