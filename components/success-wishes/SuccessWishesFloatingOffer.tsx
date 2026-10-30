'use client'

import { useEffect, useState } from 'react'
import styles from './SuccessWishesFloatingOffer.module.css'

const SESSION_KEY = 'success-wishes-2026-floating-offer-dismissed'
const COLLAPSED_KEY = 'success-wishes-2026-floating-offer-collapsed'

export default function SuccessWishesFloatingOffer({ preview = false, homepage = false }: { preview?: boolean; homepage?: boolean }) {
  const [visible, setVisible] = useState(false)
  const [expanded, setExpanded] = useState(false)

  useEffect(() => {
    if (preview) { setVisible(true); setExpanded(true); return }
    try { if (sessionStorage.getItem(SESSION_KEY) === '1') return } catch { /* Browsers can block storage. */ }
    setVisible(true)
    try { setExpanded(sessionStorage.getItem(COLLAPSED_KEY) !== '1') } catch { setExpanded(true) }
  }, [preview])

  useEffect(() => {
    if (!expanded) return
    const onEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') collapse() }
    document.addEventListener('keydown', onEscape)
    return () => document.removeEventListener('keydown', onEscape)
  }, [expanded])

  function collapse() {
    setExpanded(false)
    try { sessionStorage.setItem(COLLAPSED_KEY, '1') } catch { /* Keep local state. */ }
  }

  function dismiss() {
    setExpanded(false)
    setVisible(false)
    try { sessionStorage.setItem(SESSION_KEY, '1') } catch { /* Dismiss for this render if storage is unavailable. */ }
  }

  function chooseDesign() {
    collapse()
    if (homepage) { window.location.assign('/success-wishes#choose-card'); return }
    document.getElementById('choose-card')?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' })
  }

  return (
    <>
      {visible && !expanded && <aside className={styles.teaser} aria-label="Free Digital Success Cards offer">
        <span className={styles.yearRibbon} aria-hidden="true">2026</span>
        <button type="button" className={styles.teaserClose} aria-label="Dismiss free card advert" onClick={dismiss}>×</button>
        <div className={styles.teaserContent}><strong className={styles.teaserHeadline}>Send 5 FREE Success Cards</strong><strong className={styles.teaserFree}>Never late for a wish</strong><span className={styles.teaserNow}>Personalise · Share instantly</span><button type="button" className={styles.teaserMainCta} onClick={chooseDesign}>Send Free Cards →</button></div>
      </aside>}
      {visible && expanded && <div className={styles.backdrop} onMouseDown={e=>{if(e.target===e.currentTarget)collapse()}}>
        <section className={styles.freeCampaign} role="dialog" aria-modal="true" aria-labelledby="free-trial-offer">
          <button type="button" className={styles.modalClose} aria-label="Close free offer" onClick={collapse}>×</button>
          <div className={styles.freeCampaignCopy}>
            <strong id="free-trial-offer" className={styles.freeBrush}>FREE</strong>
            <strong className={styles.freeCampaignTitle}><span>Digital</span>Success Cards</strong>
            <p>Wish your students success in exams with a beautiful personalised digital card.</p>
          </div>
          <div className={styles.freeBook} aria-hidden="true"><span className={styles.freePage}><small>✦　✧　✦</small><strong>Good Luck<br/>and<br/>Great Success!</strong><small>✦　✧　✦</small></span><span className={styles.freePage}><small>✧　✦　✧</small><em>Believe in yourself.<br/>You can do it!<br/>Wishing you success<br/>in your exams.</em><small>♥</small></span></div>
          <div className={styles.freeCampaignCode}><span>Use code: <strong>DNJIMAX3</strong></span><small>Free for now!</small></div>
          <div className={styles.freeCampaignFeatures}><span>Create instantly</span><span>Beautiful designs</span><span>Share via WhatsApp</span></div>
          <button type="button" className={styles.freeCampaignAction} onClick={chooseDesign}>Create Free Card →</button>
        </section>
      </div>}
    </>
  )
}
