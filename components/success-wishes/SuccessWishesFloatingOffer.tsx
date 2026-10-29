'use client'

import { useEffect, useState } from 'react'
import styles from './SuccessWishesFloatingOffer.module.css'

const SESSION_KEY = 'success-wishes-2026-floating-offer-dismissed'

export default function SuccessWishesFloatingOffer({ preview = false }: { preview?: boolean }) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (preview) { setVisible(true); return }
    try { if (sessionStorage.getItem(SESSION_KEY) === '1') return } catch { /* Keep advert available when storage is blocked. */ }
    const timer = window.setTimeout(() => setVisible(true), 1400)
    return () => window.clearTimeout(timer)
  }, [preview])

  function close() {
    setVisible(false)
    try { sessionStorage.setItem(SESSION_KEY, '1') } catch { /* Non-persistent dismissal is fine. */ }
  }

  function chooseOne() {
    close()
    document.getElementById('choose-card')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  if (!visible) return null

  return (
    <aside className={styles.floating} aria-label="Success Wishes 2026 offers">
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
        <div className={styles.group}>
          <span>GROUP WISHES</span>
          <strong>KSh 100</strong>
          <p>Up to 4 students</p>
          <p className={styles.free}>Get 2 FREE</p>
          <button type="button" disabled title="Group checkout is not yet available">Choose Four</button>
        </div>
      </div>
      <p className={styles.footer}>Personalised cards. Private wishes.</p>
    </aside>
  )
}
