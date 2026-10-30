'use client'

import { useEffect, useState } from 'react'
import styles from './SuccessWishesFloatingOffer.module.css'
import SuccessWishesGroupDemo from './SuccessWishesGroupDemo'

const SESSION_KEY = 'success-wishes-2026-floating-offer-dismissed'

export default function SuccessWishesFloatingOffer({ preview = false }: { preview?: boolean }) {
  const [visible, setVisible] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [demoOpen, setDemoOpen] = useState(false)

  useEffect(() => {
    if (preview) { setVisible(true); setExpanded(true); return }
    try { if (sessionStorage.getItem(SESSION_KEY) === '1') return } catch { /* Browsers can block storage. */ }
    setVisible(true)
  }, [preview])

  useEffect(() => {
    const openGroup = () => { setVisible(true); setExpanded(false); setDemoOpen(true) }
    window.addEventListener('success-wishes:open-group', openGroup)
    return () => window.removeEventListener('success-wishes:open-group', openGroup)
  }, [])

  useEffect(() => {
    if (!expanded || demoOpen) return
    const onEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') setExpanded(false) }
    document.addEventListener('keydown', onEscape)
    return () => document.removeEventListener('keydown', onEscape)
  }, [expanded, demoOpen])

  function dismiss() {
    setExpanded(false)
    setVisible(false)
    try { sessionStorage.setItem(SESSION_KEY, '1') } catch { /* Dismiss for this render if storage is unavailable. */ }
  }

  function chooseOne() {
    setExpanded(false)
    document.getElementById('choose-card')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  function chooseFour() {
    setExpanded(false)
    setDemoOpen(true)
  }

  return (
    <>
      {visible && !demoOpen && <aside className={styles.teaser} aria-label="Success Wishes promotional offer">
        <button type="button" className={styles.teaserOpen} onClick={() => setExpanded(true)} aria-label="View KSh 50 and KSh 100 Success Card offers">
          <span className={styles.teaserBrand}>VIBESCHOOL PRESENTS</span>
          <strong>Success Wishes 2026</strong>
          <span className={styles.teaserBottom}><span>From KSh 50</span><span className={styles.teaserCta}>Choose Now →</span></span>
        </button>
        <button type="button" className={styles.teaserClose} onClick={dismiss} aria-label="Dismiss Success Wishes advert">×</button>
      </aside>}
      {visible && expanded && !demoOpen && <div className={styles.backdrop} onMouseDown={event => { if (event.target === event.currentTarget) setExpanded(false) }}>
        <section role="dialog" aria-modal="true" aria-labelledby="success-offer-heading" className={styles.modal}>
          <button type="button" className={styles.modalClose} onClick={() => setExpanded(false)} aria-label="Close offer details">×</button>
          <div className={styles.heading}>
            <span>VIBESCHOOL PRESENTS</span>
            <h2 id="success-offer-heading">Success Wishes 2026</h2>
            <p>A little wish. A big smile.</p>
          </div>
          <div className={styles.offers}>
            <div className={styles.single} role="button" tabIndex={0} aria-label="Choose one Success Card for KSh 50" onClick={chooseOne} onKeyDown={event => { if (event.target !== event.currentTarget) return; if (event.key === "Enter" || event.key === " ") { event.preventDefault(); chooseOne() } }}>
              <span className={styles.eyebrow}>PERSONAL WISH</span>
              <strong>KSh 50</strong>
              <div className={styles.cardIllustration} aria-hidden="true"><span className={styles.personHead}>👤</span></div>
              <p>1 student</p>
              <p className={styles.tagline}>Just for them.</p>
              <button type="button" onClick={event => { event.stopPropagation(); chooseOne() }}>Choose One →</button>
            </div>
            <div className={styles.group} role="button" tabIndex={0} aria-label="Choose up to four Success Cards for KSh 100" onClick={chooseFour} onKeyDown={event => { if (event.target !== event.currentTarget) return; if (event.key === "Enter" || event.key === " ") { event.preventDefault(); chooseFour() } }}>
              <span className={styles.eyebrow}>GROUP WISHES</span>
              <strong>KSh 100</strong>
              <div className={styles.groupIllustration} aria-hidden="true"><span>👤</span><span>👤</span><span>👤</span><span>👤</span></div>
              <p>Up to 4 students</p>
              <p className={styles.free}>Get 2 FREE</p>
              <button type="button" onClick={event => { event.stopPropagation(); chooseFour() }}>Choose Four →</button>
            </div>
          </div>
          <p className={styles.footer}>✦ Personalised cards. Private wishes. ✦</p>
        </section>
      </div>}
      {demoOpen && <SuccessWishesGroupDemo onClose={() => setDemoOpen(false)} />}
    </>
  )
}
