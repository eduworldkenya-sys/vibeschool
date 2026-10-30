'use client'

import { useEffect, useState } from 'react'
import { UserRound, UsersRound } from 'lucide-react'
import styles from './SuccessWishesFloatingOffer.module.css'
import SuccessWishesGroupDemo from './SuccessWishesGroupDemo'

const SESSION_KEY = 'success-wishes-2026-floating-offer-dismissed'
const COLLAPSED_KEY = 'success-wishes-2026-floating-offer-collapsed'

export default function SuccessWishesFloatingOffer({ preview = false, homepage = false }: { preview?: boolean; homepage?: boolean }) {
  const [visible, setVisible] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [demoOpen, setDemoOpen] = useState(false)

  useEffect(() => {
    if (preview) { setVisible(true); setExpanded(true); return }
    try { if (sessionStorage.getItem(SESSION_KEY) === '1') return } catch { /* Browsers can block storage. */ }
    setVisible(true)
    try { setExpanded(sessionStorage.getItem(COLLAPSED_KEY) !== '1') } catch { setExpanded(true) }
  }, [preview])

  useEffect(() => {
    if (homepage) return
    const params = new URLSearchParams(window.location.search)
    if (params.get('offer') === 'group') {
      setVisible(true)
      setExpanded(false)
      setDemoOpen(true)
      window.history.replaceState({}, '', window.location.pathname)
    }
  }, [homepage])

  useEffect(() => {
    const openGroup = () => { setVisible(true); setExpanded(false); setDemoOpen(true) }
    window.addEventListener('success-wishes:open-group', openGroup)
    return () => window.removeEventListener('success-wishes:open-group', openGroup)
  }, [])

  useEffect(() => {
    if (!expanded || demoOpen) return
    const onEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') collapse() }
    document.addEventListener('keydown', onEscape)
    return () => document.removeEventListener('keydown', onEscape)
  }, [expanded, demoOpen])

  function collapse() {
    setExpanded(false)
    try { sessionStorage.setItem(COLLAPSED_KEY, '1') } catch { /* Keep local state. */ }
  }

  function dismiss() {
    setExpanded(false)
    setVisible(false)
    try { sessionStorage.setItem(SESSION_KEY, '1') } catch { /* Dismiss for this render if storage is unavailable. */ }
  }

  function chooseOne() {
    collapse()
    if (homepage) { window.location.assign('/success-wishes#choose-card'); return }
    document.getElementById('choose-card')?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' })
  }

  function chooseDesign() {
    collapse()
    if (homepage) { window.location.assign('/success-wishes#choose-card'); return }
    document.getElementById('choose-card')?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' })
  }

  function chooseFour() {
    collapse()
    if (homepage) { window.location.assign('/success-wishes?offer=group'); return }
    setDemoOpen(true)
  }

  return (
    <>
      {visible && !expanded && !demoOpen && <aside className={styles.teaser} aria-label="Digital Success Cards last-minute offer">
        <span className={styles.yearRibbon} aria-label="2026">2026</span>
        <button type="button" className={styles.teaserClose} onClick={dismiss} aria-label="Dismiss Success Cards advert">×</button>
        <div className={styles.teaserContent}>
          <strong className={styles.teaserHeadline}>Never late for a wish</strong>
          <strong className={styles.teaserFree}>Buy 2 Get 2 Free</strong>
          <span className={styles.teaserNow}>Send now</span>
          <div className={styles.teaserOptions}>
            <button type="button" className={styles.teaserOne} onClick={chooseOne} aria-label="KSh 50, one instant digital Success Card, send now">
              <strong>INSTANT</strong><span>KSh 50 · 1 card</span><b>Send →</b>
            </button>
            <button type="button" className={styles.teaserFour} onClick={chooseFour} aria-label="KSh 100, four digital Success Cards, buy two get two free, send now">
              <strong>Buy 2 Get 2 Free</strong><span>KSh 100 · 4 cards</span><b>Send →</b>
            </button>
          </div>
          <button type="button" className={styles.teaserMainCta} onClick={chooseDesign}>Send Success Card Now →</button>
        </div>
      </aside>}
      {visible && expanded && !demoOpen && <div className={styles.backdrop} onMouseDown={event => { if (event.target === event.currentTarget) collapse() }}>
        <section role="dialog" aria-modal="true" aria-labelledby="success-offer-heading" className={styles.modal}>
          <button type="button" className={styles.modalClose} onClick={collapse} aria-label="Close offer details">×</button>
          <div className={styles.heading}>
            <h2 id="success-offer-heading">Digital Success Cards 2026</h2>
            <p>A little wish. A big smile.</p>
          </div>
          <div className={styles.offers}>
            <div className={styles.single} role="button" tabIndex={0} aria-label="Choose one Success Card for KSh 50" onClick={chooseOne} onKeyDown={event => { if (event.target !== event.currentTarget) return; if (event.key === "Enter" || event.key === " ") { event.preventDefault(); chooseOne() } }}>
              <span className={styles.eyebrow}>Share Success Cards</span>
              <strong>INSTANT</strong>
              <div className={styles.cardIllustration} aria-hidden="true"><UserRound size={35} strokeWidth={1.7}/></div>
              <p>1 student · KSh 50</p>
              <p className={styles.tagline}>Just for them.</p>
              <button type="button" onClick={event => { event.stopPropagation(); chooseOne() }}>Choose One →</button>
            </div>
            <div className={styles.group} role="button" tabIndex={0} aria-label="Choose up to four Success Cards for KSh 100" onClick={chooseFour} onKeyDown={event => { if (event.target !== event.currentTarget) return; if (event.key === "Enter" || event.key === " ") { event.preventDefault(); chooseFour() } }}>
              <span className={styles.eyebrow}>2 FREE Success Cards</span>
              <strong>Buy 2 Get 2 Free</strong>
              <div className={styles.groupIllustration} aria-hidden="true"><UsersRound size={43} strokeWidth={1.7}/></div>
              <p>Up to 4 students · KSh 100</p>
              <p className={styles.free}>2 FREE Success Cards</p>
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
