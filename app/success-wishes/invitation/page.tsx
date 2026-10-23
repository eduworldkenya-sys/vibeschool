'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { CardArt, Template } from '@/components/success-wishes/SuccessCardStudio'
import styles from '@/components/success-wishes/SuccessCardStudio.module.css'
import { Volume2, VolumeX } from 'lucide-react'
import { playWishRevealSound } from '@/lib/success-wishes/signature-sound'

type Wish = {
  id: string
  candidate: string
  sender: string
  message: string
  examYear: string
  school: string
  theme: Template
  expiresAt: string
}

export default function SuccessWishInvitationPage() {
  const [wish, setWish] = useState<Wish | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(true)
  const [envelopeOpened, setEnvelopeOpened] = useState(false)
  const [cardOpened, setCardOpened] = useState(false)
  const [soundEnabled, setSoundEnabled] = useState(true)
  const stopSound = useRef<(() => void) | null>(null)
  const revealTimer = useRef<number | null>(null)
  const receivedWishHeading = useRef<HTMLHeadingElement>(null)
  const invitationLoad = useRef<Promise<Wish> | null>(null)

  useEffect(() => {
    let cancelled = false
    if (!invitationLoad.current) {
      const token = new URLSearchParams(window.location.hash.slice(1)).get('token')
      if (token) {
        window.history.replaceState(null, '', window.location.pathname)
      }
      invitationLoad.current = (async () => {
        if (token) {
          const response = await fetch('/api/success-wishes/test-access', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token }), cache: 'no-store',
          })
          const payload = await response.json()
          if (!response.ok) throw new Error(payload.error || 'This invitation could not be opened.')
          return payload.wish as Wish
        }
        const response = await fetch('/api/success-wishes/test-access', { cache: 'no-store' })
        const payload = await response.json()
        if (!response.ok) throw new Error(payload.error || 'Use the private invitation link to open this wish.')
        return payload.wish as Wish
      })()
    }
    void invitationLoad.current.then(loadedWish => {
      if (!cancelled) setWish(loadedWish)
    }).catch(reason => {
      if (!cancelled) setError(reason instanceof Error ? reason.message : 'This invitation could not be opened.')
    }).finally(() => {
      if (!cancelled) setBusy(false)
    })
    return () => { cancelled = true }
  }, [])

  useEffect(() => () => {
    stopSound.current?.()
    if (revealTimer.current !== null) window.clearTimeout(revealTimer.current)
  }, [])
  useEffect(() => { if (cardOpened) receivedWishHeading.current?.focus() }, [cardOpened])

  function openWish() {
    if (envelopeOpened) return
    setEnvelopeOpened(true)
    if (soundEnabled) stopSound.current = playWishRevealSound()
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setCardOpened(true)
      return
    }
    revealTimer.current = window.setTimeout(() => {
      setCardOpened(true)
      revealTimer.current = null
    }, 560)
  }

  function toggleSound() {
    if (soundEnabled) {
      stopSound.current?.()
      stopSound.current = null
    }
    setSoundEnabled(!soundEnabled)
  }

  async function signOut() {
    stopSound.current?.()
    stopSound.current = null
    await fetch('/api/success-wishes/test-access', { method: 'DELETE', cache: 'no-store' })
    if (revealTimer.current !== null) window.clearTimeout(revealTimer.current)
    revealTimer.current = null
    setWish(null)
    setEnvelopeOpened(false)
    setCardOpened(false)
    setError('You are signed out. Use the private invitation again to open this wish.')
  }

  return <div className={styles.page}>
    <header className={styles.header}><Link href="/" className={styles.brand}>VibeSchool <span>/ Success Wishes</span></Link><span>Private wish</span></header>
    <main className={styles.main}>
      <div className={styles.intro}><p className={styles.eyebrow}>A PRIVATE SUCCESS WISH</p><h1>{wish && cardOpened ? `A wish for ${wish.candidate}` : 'Your private invitation'}</h1>
        <p>This wish is free to open. The private link grants access to whoever has it; it does not verify a person’s real-world identity.</p></div>
      {busy && <p role="status" className={styles.status}>Opening your invitation…</p>}
      {error && !busy && <section className={styles.form} aria-live="polite"><h2>Invitation unavailable</h2><p>{error}</p><p>Check that the full private invitation link was copied. Names, school and exam year cannot recover access.</p><Link href="/success-wishes">Return to Success Wishes</Link></section>}
      {wish && !busy && <>
        <div className={styles.recipientSoundRow}>
          <span>Your wish is sealed. Tap to open it.</span>
          <button type="button" className={styles.soundToggle} aria-pressed={soundEnabled} onClick={toggleSound}>{soundEnabled ? <Volume2 size={16}/> : <VolumeX size={16}/>} Sound {soundEnabled ? 'on' : 'off'}</button>
        </div>
        <section className={styles.recipient} aria-labelledby="received-wish">
        <div className={styles.recipientCard}>
          <button type="button" className={styles.recipientEnvelope + (envelopeOpened ? ` ${styles.recipientEnvelopeOpened}` : '')} data-theme={wish.theme} onClick={openWish} disabled={envelopeOpened} aria-hidden={envelopeOpened} tabIndex={envelopeOpened ? -1 : 0} aria-label={`Break the seal and open the private wish for ${wish.candidate}`}>
            <span className={styles.recipientEnvelopeBrand}>VIBESCHOOL <small>SUCCESS WISHES</small></span>
            <strong>A note for {wish.candidate}</strong>
            {wish.school && <small className={styles.recipientEnvelopeSchool}>{wish.school}</small>}
            <span className={styles.recipientEnvelopeFlap} aria-hidden="true"/>
            <span className={styles.recipientEnvelopeFold} aria-hidden="true"/>
            <span className={styles.recipientEnvelopeSeal} aria-hidden="true">{wish.candidate.trim().split(/\s+/).filter(Boolean).slice(0, 2).map(part => part.charAt(0)).join('').toUpperCase() || '✧'}</span>
            <span className={styles.recipientEnvelopeHint}>Tap to break the seal</span>
          </button>
          <div className={styles.recipientBook + (cardOpened ? ` ${styles.recipientBookOpened}` : '')} aria-hidden={!cardOpened}>
            <div className={styles.recipientBookArt}><CardArt template={wish.theme} values={wish}/></div>
            <div className={styles.recipientCardCover + (cardOpened ? ` ${styles.recipientCardCoverOpened}` : '')} aria-hidden={cardOpened}>
              <span>VIBESCHOOL <small>SUCCESS WISHES</small></span><b aria-hidden="true">✧</b><strong>A special wish for {wish.candidate}</strong><small>Opening your card</small>
            </div>
            {cardOpened && <div className={styles.recipientSparkles} aria-hidden="true"><span>✦</span><span>✧</span><span>✦</span><span>✧</span><span>✦</span><span>✧</span></div>}
          </div>
        </div>
        <div className={styles.recipientDetails}>
          <p className={styles.eyebrow}>TEXT WISH · FREE TO OPEN</p><h2 id="received-wish" ref={receivedWishHeading} tabIndex={cardOpened ? -1 : undefined}>{cardOpened ? `For ${wish.candidate}` : 'Your card is ready'}</h2>
          {cardOpened ? <>
          <p className={styles.recipientMessage}>{wish.message}</p><p className={styles.recipientFrom}>With love, {wish.sender}</p>
          <dl><div><dt>Exam year</dt><dd>{wish.examYear}</dd></div>{wish.school && <div><dt>School label</dt><dd>{wish.school}</dd></div>}</dl>
          </> : <p className={styles.recipientPrompt}>Tap the card to reveal your personal message. Sound plays only after you open it.</p>}
          <p className={styles.privacy}>This private link is a bearer invitation, not identity proof. Anyone who has the link may read this wish. It is stored in this local test environment for up to 30 days; return with the same invitation link. A browser with an active private session can revisit it for up to 7 days.</p>
          <div className={styles.actions}><button type="button" className={styles.secondary} onClick={() => void signOut()}>Sign out on this device</button></div>
          <p className={styles.hint}>Wish reference: {wish.id}</p>
        </div>
        </section>
      </>}
      <footer className={styles.footer}><p>Local test environment. No payment was taken and no message was sent to a school or candidate.</p></footer>
    </main>
  </div>
}
