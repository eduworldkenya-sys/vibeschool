'use client'

import Link from 'next/link'
import { broadcastReceiverLogout, useReceiverSessionSafety } from '@/lib/success-wishes/receiver-browser-session'
import { useEffect, useRef, useState } from 'react'
import { BookCard, Template } from '@/components/success-wishes/SuccessCardStudio'
import receiver from '../Receiver.module.css'
import ReceiverGift from '@/components/success-wishes/ReceiverGift'
import { Volume2, VolumeX } from 'lucide-react'
import { playWishRevealSound } from '@/lib/success-wishes/signature-sound'

type Wish = {
  id: string; candidate: string; sender: string; message: string; consentRequired?: boolean
  examYear: string; school: string; theme: Template; expiresAt?: string
}
type PrivateCard = {
  id: string; candidate: string; sender: string | null; message?: string; consentRequired?: boolean
  examYear: string; school: string; theme: Template
}
type Mode = 'production' | 'development'
const PAID_API = '/api/success-wishes/receiver/card'
const TEST_API = '/api/success-wishes/test-access'
function fromPrivateCard(card: PrivateCard): Wish {
  return { id: card.id, candidate: card.candidate, sender: card.sender || '',
    message: card.message || '', examYear: card.examYear, school: card.school, theme: card.theme,
    consentRequired: card.consentRequired === true }
}
async function requestCard(url: string, init?: RequestInit) {
  const response = await fetch(url, { cache: 'no-store', ...init })
  const payload = await response.json()
  if (!response.ok) throw new Error(payload.error || 'This invitation is unavailable.')
  return payload
}
export default function SuccessWishInvitationPage() {
  const [wish, setWish] = useState<Wish | null>(null)
  useReceiverSessionSafety(!!wish && !wish.consentRequired)
  const accessGeneration = useRef(0)
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
      const expectedId = new URLSearchParams(window.location.search).get('card')
      invitationLoad.current = (async () => {
        const privateInit = token ? { method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token }) } : undefined
        const privateUrl = token || !expectedId ? PAID_API : PAID_API + '?card=' + encodeURIComponent(expectedId)
        try {
          const payload = await requestCard(privateUrl, privateInit)
          const paidCard = payload.card as PrivateCard
          if (expectedId && paidCard.id !== expectedId) throw new Error('Another private card is active. Reopen this card link.')
          if (token) window.history.replaceState(null, '', '/success-wishes/invitation?card=' + encodeURIComponent(paidCard.id))
          return { wish: fromPrivateCard(paidCard), mode: 'production' as Mode }
        } catch (paidError) {
          // Synthetic local pilot stays available in development; never fall back to test data in production.
          if (process.env.NODE_ENV !== 'development') throw paidError
          const pilot = await requestCard(TEST_API, privateInit)
          // Remove synthetic test tokens only after development access succeeds; refresh then uses the session GET.
          if (token) window.history.replaceState(null, '', window.location.pathname)
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
  useEffect(() => { if (cardOpened) receivedWishHeading.current?.focus({ preventScroll: true }) }, [cardOpened])
  function playOpeningSound() {
    stopSound.current?.()
    stopSound.current = playWishRevealSound()
  }
  function toggleSound() {
    if (soundEnabled) { stopSound.current?.(); stopSound.current = null }
    setSoundEnabled(!soundEnabled)
  }
  async function revealCard(isOpen: boolean) {
    if (!isOpen) { setCardOpened(false); return true }
    if (wish?.consentRequired) {
      setError('Verify recipient consent before revealing your personal message.')
      return false
    }
    if (mode.current === 'development') { setCardOpened(true); return true }
    if (revealInFlight.current) return false
    revealInFlight.current = true
    const generation = accessGeneration.current
    setRevealing(true)
    try {
      const payload = await requestCard(PAID_API, { method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cardId: wish?.id }) })
      if (generation !== accessGeneration.current) return false
      setWish(fromPrivateCard(payload.card as PrivateCard))
      setCardOpened(true)
      setError('')
      return true
    } catch (reason) {
      if (generation !== accessGeneration.current) return false
      setError(reason instanceof Error ? reason.message : 'Could not reveal your message. Tap the envelope to retry.')
      return false
    } finally {
      setRevealing(false)
      revealInFlight.current = false
    }
  }
  async function signOut() {
    accessGeneration.current += 1
    setWish(null); setCardOpened(false)
    stopSound.current?.()
    stopSound.current = null
    try {
      await requestCard(mode.current === 'production' ? PAID_API : TEST_API, { method: 'DELETE' })
      setWish(null)
      setCardOpened(false)
      setError('You are signed out. Use your private invitation again to open this wish.')
    } catch (reason) {
      setError('This device was cleared, but server revocation could not be confirmed. Close this tab and contact support.')
    } finally {
      setWish(null); setCardOpened(false); broadcastReceiverLogout()
    }
  }
  return <div className={receiver.page}>
    <header className={receiver.top}><Link href="/success-wishes" className={receiver.brand}>VIBESCHOOL / SUCCESS WISHES</Link><span className={receiver.muted}>Private · Free to open</span></header>
    <main className={receiver.wrap + ' ' + receiver.invitation}>
      <div className={receiver.hero}><p className={receiver.eyebrow}>SOMEONE BELIEVES IN YOU</p>
        <h1>{wish ? (cardOpened ? `For ${wish.candidate}` : 'A little joy, just for you.') : busy ? 'Your surprise is on its way.' : 'Let’s find your wish.'}</h1>
      </div>
      {busy && <div className={receiver.giftStage}><ReceiverGift label="Finding your private gift…"/><p role="status" className={receiver.muted}>Opening your invitation…</p></div>}
      {error && !busy && <section className={receiver.panel} aria-live="polite">
        <h2>{wish ? 'Let’s try again' : 'Invitation unavailable'}</h2><p className={receiver.error}>{error}</p>
        {!wish && <div className={receiver.actions}><Link className={receiver.primary} href="/success-wishes/open">Enter access code</Link><Link className={receiver.secondary} href="/success-wishes/recover">Find my wishes</Link><Link className={receiver.secondary} href="/contact">Get help</Link></div>}
      </section>}
      {wish && !busy && <>
        <div className={receiver.toolbar}><p>{wish.consentRequired ? 'Your message stays sealed until verification.' : cardOpened ? 'Yours to keep. Yours to revisit.' : 'Tap your gift to reveal the message.'}</p>
          {!wish.consentRequired && <button type="button" className={receiver.secondary} aria-pressed={soundEnabled} onClick={toggleSound}>
            {soundEnabled ? <Volume2 size={16}/> : <VolumeX size={16}/>} Sound {soundEnabled ? 'on' : 'off'}
          </button>}
        </div>
        <section className={receiver.giftStage} aria-label="Your Success Wish">
          {wish.consentRequired ? <>
            <ReceiverGift theme={wish.theme} name={wish.candidate} label="Sealed with encouragement"/>
            <div className={receiver.actions}><Link className={receiver.primary} href={"/success-wishes/verify?card=" + encodeURIComponent(wish.id)}>Verify &amp; open my gift</Link></div>
            <p className={receiver.muted}>Under 18? Your registered parent or guardian approves access.</p>
          </> : <BookCard receiverView template={wish.theme} values={wish} soundEnabled={soundEnabled}
            onOpen={playOpeningSound} beforeOpen={() => revealCard(true)} onOpenedChange={opened => { if (!opened) setCardOpened(false) }}/>}
          {revealing && <p role="status" className={receiver.muted}>Revealing your message…</p>}
        </section>
        <div className={receiver.cardFooter}>
          {cardOpened && <h2 id="received-wish" ref={receivedWishHeading} tabIndex={-1}>A wish to remember.</h2>}
          <div className={receiver.actions}>
            {mode.current === 'production' && !wish.consentRequired && <Link className={receiver.primary} href={"/success-wishes/verify?card=" + encodeURIComponent(wish.id)}>Keep in my inbox</Link>}
            <Link className={receiver.secondary} href="/success-wishes/inbox">My wishes</Link>
            <Link className={receiver.secondary} href="/success-wishes">Send a wish</Link>
          </div>
        </div>
        <details className={receiver.help}><summary>Privacy &amp; help</summary>
          <p>Keep your link and access code private. Verify the registered contact on a new device. Sign out after using a shared phone.</p>
          <div className={receiver.links}><button type="button" className={receiver.secondary} onClick={() => void signOut()}>Sign out</button><Link href="/contact">Get help</Link></div>
          <p className={receiver.reference}>Wish reference: {wish.id}</p>
        </details>
      </>}
    </main>
  </div>
}
