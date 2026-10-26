'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { BookCard, Template } from '@/components/success-wishes/SuccessCardStudio'
import styles from '@/components/success-wishes/SuccessCardStudio.module.css'
import { Volume2, VolumeX } from 'lucide-react'
import { playWishRevealSound } from '@/lib/success-wishes/signature-sound'

type Wish = {
  id: string; candidate: string; sender: string; message: string
  examYear: string; school: string; theme: Template; expiresAt?: string
}
type PrivateCard = {
  id: string; candidate: string; sender: string | null; message?: string
  examYear: string; school: string; theme: Template
}
type Mode = 'production' | 'development'
const PAID_API = '/api/success-wishes/receiver/card'
const TEST_API = '/api/success-wishes/test-access'
function fromPrivateCard(card: PrivateCard): Wish {
  return { id: card.id, candidate: card.candidate, sender: card.sender || '',
    message: card.message || '', examYear: card.examYear, school: card.school, theme: card.theme }
}
async function requestCard(url: string, init?: RequestInit) {
  const response = await fetch(url, { cache: 'no-store', ...init })
  const payload = await response.json()
  if (!response.ok) throw new Error(payload.error || 'This invitation is unavailable.')
  return payload
}
export default function SuccessWishInvitationPage() {
  const [wish, setWish] = useState<Wish | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(true)
  const [revealing, setRevealing] = useState(false)
  const [cardOpened, setCardOpened] = useState(false)
  const [soundEnabled, setSoundEnabled] = useState(true)
  const stopSound = useRef<(() => void) | null>(null)
  const receivedWishHeading = useRef<HTMLHeadingElement>(null)
  const invitationLoad = useRef<Promise<{ wish: Wish; mode: Mode }> | null>(null)
  const mode = useRef<Mode>('production')
  const revealInFlight = useRef(false)

  useEffect(() => {
    let cancelled = false
    if (!invitationLoad.current) {
      const token = new URLSearchParams(window.location.hash.slice(1)).get('token')
      if (token) window.history.replaceState(null, '', window.location.pathname)
      invitationLoad.current = (async () => {
        const privateInit = token ? { method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token }) } : undefined
        try {
          const payload = await requestCard(PAID_API, privateInit)
          return { wish: fromPrivateCard(payload.card as PrivateCard), mode: 'production' as Mode }
        } catch (paidError) {
          // Synthetic local pilot stays available in development; never fall back to test data in production.
          if (process.env.NODE_ENV !== 'development') throw paidError
          const pilot = await requestCard(TEST_API, privateInit)
          return { wish: pilot.wish as Wish, mode: 'development' as Mode }
        }
      })()
    }
    void invitationLoad.current.then(result => {
      mode.current = result.mode
      if (!cancelled) setWish(result.wish)
    }).catch(reason => {
      if (!cancelled) setError(reason instanceof Error ? reason.message : 'This invitation could not be opened.')
    }).finally(() => {
      if (!cancelled) setBusy(false)
    })
    return () => { cancelled = true }
  }, [])
  useEffect(() => () => { stopSound.current?.() }, [])
  useEffect(() => { if (cardOpened) receivedWishHeading.current?.focus() }, [cardOpened])
  function playOpeningSound() {
    stopSound.current?.()
    stopSound.current = playWishRevealSound()
  }
  function toggleSound() {
    if (soundEnabled) { stopSound.current?.(); stopSound.current = null }
    setSoundEnabled(!soundEnabled)
  }
  async function revealCard(isOpen: boolean) {
    if (!isOpen) { setCardOpened(false); return }
    if (mode.current === 'development') { setCardOpened(true); return }
    if (revealInFlight.current) return
    revealInFlight.current = true
    setRevealing(true)
    try {
      const payload = await requestCard(PAID_API, { method: 'PUT' })
      setWish(fromPrivateCard(payload.card as PrivateCard))
      setCardOpened(true)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not reveal your message. Reopen your private link.')
    } finally {
      setRevealing(false)
      revealInFlight.current = false
    }
  }
  async function signOut() {
    stopSound.current?.()
    stopSound.current = null
    try {
      await requestCard(mode.current === 'production' ? PAID_API : TEST_API, { method: 'DELETE' })
      setWish(null)
      setCardOpened(false)
      setError('Signed out on this device. Open your private link again to read this card.')
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not sign out. Try again.')
    }
  }
  return <div className={styles.page}>
    <header className={styles.header}><Link href="/" className={styles.brand}>VibeSchool <span>/ Success Wishes</span></Link><span>Private wish</span></header>
    <main className={styles.main}>
      <div className={styles.intro}><p className={styles.eyebrow}>A PRIVATE SUCCESS WISH</p><h1>{wish && cardOpened ? `A wish for ${wish.candidate}` : 'A little encouragement, just for you'}</h1>
        <p>Your gift is free to open. Keep your private link or access code safe; it grants access to this card.</p></div>
      {busy && <p role="status" className={styles.status}>Finding your private invitation…</p>}
      {error && !busy && <section className={styles.form} aria-live="polite">
        <h2>{wish ? 'Could not finish this action' : 'Invitation unavailable'}</h2><p>{error}</p>
        {!wish && <p>Check that your complete invitation link was copied. A name or school alone cannot recover a private card.</p>}
        {!wish && <Link href="/success-wishes">Return to Success Wishes</Link>}
      </section>}
      {wish && !busy && <>
        <div className={styles.recipientSoundRow}>
          <span>Tap the envelope to discover your surprise.</span>
          <button type="button" className={styles.soundToggle} aria-pressed={soundEnabled} onClick={toggleSound}>
            {soundEnabled ? <Volume2 size={16}/> : <VolumeX size={16}/>} Sound {soundEnabled ? 'on' : 'off'}
          </button>
        </div>
        <section className={styles.recipient} aria-labelledby="received-wish">
          <div className={styles.recipientCard}>
            <BookCard template={wish.theme} values={wish} soundEnabled={soundEnabled}
              onOpen={playOpeningSound} onOpenedChange={opened => { void revealCard(opened) }}/>
            {revealing && <p role="status" className={styles.status}>Revealing your personal message…</p>}
          </div>
          <div className={styles.recipientDetails}>
            <p className={styles.eyebrow}>TEXT WISH · FREE TO OPEN</p>
            <h2 id="received-wish" ref={receivedWishHeading} tabIndex={cardOpened ? -1 : undefined}>
              {cardOpened ? `For ${wish.candidate}` : 'Your surprise is ready'}
            </h2>
            <p className={styles.recipientPrompt}>
              {cardOpened ? 'This message was saved for you. You can revisit using the same private link.' : 'The message and sender are waiting inside your card.'}
            </p>
            <p className={styles.privacy}>This is a private bearer card, not proof of identity. Anyone with your card link or access code may read it. Full inbox recovery requires separate verification.</p>
            <div className={styles.actions}>
              <button type="button" className={styles.secondary} onClick={() => void signOut()}>Sign out on this device</button>
              <Link href="/success-wishes">Send a wish</Link>
            </div>
            <p className={styles.hint}>Wish reference: {wish.id}</p>
          </div>
        </section>
      </>}
      <footer className={styles.footer}><p>Success Wishes · Private encouragement for every candidate.</p></footer>
    </main>
  </div>
}
