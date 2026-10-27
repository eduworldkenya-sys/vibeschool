'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import {
  Crown,
  Volume2,
  VolumeX,
  Sparkles,
  ShieldCheck,
  Lock,
  KeyRound,
  HelpCircle,
  LogOut,
  ArrowRight,
  Heart,
  Loader2,
  AlertTriangle
} from 'lucide-react'

import {
  BookCard,
  Template
} from '@/components/success-wishes/SuccessCardStudio'
import ReceiverGift from '@/components/success-wishes/ReceiverGift'
import {
  broadcastReceiverLogout,
  useReceiverSessionSafety
} from '@/lib/success-wishes/receiver-browser-session'
import { playWishRevealSound } from '@/lib/success-wishes/signature-sound'

type Wish = {
  id: string
  candidate: string
  sender: string
  message: string
  consentRequired?: boolean
  examYear: string
  school: string
  theme: Template
  expiresAt?: string
}

type PrivateCard = {
  id: string
  candidate: string
  sender: string | null
  message?: string
  consentRequired?: boolean
  examYear: string
  school: string
  theme: Template
}

type Mode = 'production' | 'development'

const PAID_API = '/api/success-wishes/receiver/card'
const TEST_API = '/api/success-wishes/test-access'

function fromPrivateCard(card: PrivateCard): Wish {
  return {
    id: card.id,
    candidate: card.candidate,
    sender: card.sender || '',
    message: card.message || '',
    examYear: card.examYear,
    school: card.school,
    theme: card.theme,
    consentRequired: card.consentRequired === true
  }
}

async function requestCard(url: string, init?: RequestInit) {
  const response = await fetch(url, { cache: 'no-store', ...init })
  const payload = await response.json()
  if (!response.ok) {
    throw new Error(payload.error || 'This invitation is unavailable.')
  }
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
      const token = new URLSearchParams(window.location.hash.slice(1)).get(
        'token'
      )
      const expectedId = new URLSearchParams(window.location.search).get('card')
      invitationLoad.current = (async () => {
        const privateInit = token
          ? {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ token })
            }
          : undefined
        const privateUrl =
          token || !expectedId
            ? PAID_API
            : PAID_API + '?card=' + encodeURIComponent(expectedId)
        try {
          const payload = await requestCard(privateUrl, privateInit)
          const paidCard = payload.card as PrivateCard
          if (expectedId && paidCard.id !== expectedId) {
            throw new Error(
              'Another private card is active. Reopen this card link.'
            )
          }
          if (token) {
            window.history.replaceState(
              null,
              '',
              '/success-wishes/invitation?card=' +
                encodeURIComponent(paidCard.id)
            )
          }
          return { wish: fromPrivateCard(paidCard), mode: 'production' as Mode }
        } catch (paidError) {
          if (process.env.NODE_ENV !== 'development') throw paidError
          const pilot = await requestCard(TEST_API, privateInit)
          if (token) {
            window.history.replaceState(null, '', window.location.pathname)
          }
          return { wish: pilot.wish as Wish, mode: 'development' as Mode }
        }
      })()
    }

    void invitationLoad.current
      .then((result) => {
        mode.current = result.mode
        if (!cancelled) setWish(result.wish)
      })
      .catch((reason) => {
        if (!cancelled) {
          setError(
            reason instanceof Error
              ? reason.message
              : 'This invitation could not be opened.'
          )
        }
      })
      .finally(() => {
        if (!cancelled) setBusy(false)
      })

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    return () => {
      stopSound.current?.()
    }
  }, [])

  useEffect(() => {
    if (cardOpened) {
      receivedWishHeading.current?.focus({ preventScroll: true })
    }
  }, [cardOpened])

  function playOpeningSound() {
    stopSound.current?.()
    stopSound.current = playWishRevealSound()
  }

  function toggleSound() {
    if (soundEnabled) {
      stopSound.current?.()
      stopSound.current = null
    }
    setSoundEnabled(!soundEnabled)
  }

  async function revealCard(isOpen: boolean) {
    if (!isOpen) {
      setCardOpened(false)
      return true
    }
    if (wish?.consentRequired) {
      setError(
        'Verify recipient consent before revealing your personal message.'
      )
      return false
    }
    if (mode.current === 'development') {
      setCardOpened(true)
      return true
    }
    if (revealInFlight.current) return false

    revealInFlight.current = true
    const generation = accessGeneration.current
    setRevealing(true)
    try {
      const payload = await requestCard(PAID_API, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cardId: wish?.id })
      })
      if (generation !== accessGeneration.current) return false
      setWish(fromPrivateCard(payload.card as PrivateCard))
      setCardOpened(true)
      setError('')
      return true
    } catch (reason) {
      if (generation !== accessGeneration.current) return false
      setError(
        reason instanceof Error
          ? reason.message
          : 'Could not reveal your message. Tap the envelope to retry.'
      )
      return false
    } finally {
      setRevealing(false)
      revealInFlight.current = false
    }
  }

  async function signOut() {
    accessGeneration.current += 1
    setWish(null)
    setCardOpened(false)
    stopSound.current?.()
    stopSound.current = null
    try {
      await requestCard(
        mode.current === 'production' ? PAID_API : TEST_API,
        { method: 'DELETE' }
      )
      setWish(null)
      setCardOpened(false)
      setError(
        'You are signed out. Use your private invitation again to open this wish.'
      )
    } catch (reason) {
      setError(
        'This device was cleared, but server revocation could not be confirmed. Close this tab and contact support.'
      )
    } finally {
      setWish(null)
      setCardOpened(false)
      broadcastReceiverLogout()
    }
  }

  return (
    <div className="min-h-screen bg-[#0A0D14] text-slate-200 antialiased selection:bg-[#D4AF37] selection:text-black flex flex-col justify-between relative overflow-x-hidden">
      
      {/* TOP HEADER */}
      <header className="max-w-6xl w-full mx-auto px-4 sm:px-8 py-4 flex items-center justify-between border-b border-[#D4AF37]/20 relative z-10">
        <Link
          href="/success-wishes"
          className="font-extrabold tracking-wider text-xs sm:text-sm text-slate-200 hover:text-[#D4AF37] transition-colors flex items-center gap-2"
        >
          <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-[#D4AF37] via-[#00A896] to-[#800020] p-0.5 flex items-center justify-center">
            <div className="w-full h-full bg-[#0A0D14] rounded-full flex items-center justify-center">
              <Crown className="w-3.5 h-3.5 text-[#D4AF37]" />
            </div>
          </div>
          <span className="font-cinzel bg-gradient-to-r from-[#FFF5C0] via-[#D4AF37] to-[#AA7C11] bg-clip-text text-transparent">
            VIBESCHOOL / SUCCESS WISHES
          </span>
        </Link>
        <span className="text-xs text-slate-400 font-medium tracking-wide">
          Private · Free to open
        </span>
      </header>

      {/* MAIN CONTAINER */}
      <main className="max-w-3xl w-full mx-auto px-4 sm:px-6 py-8 sm:py-12 flex-1 flex flex-col justify-center space-y-6 relative z-10">
        
        {/* HERO TITLE BANNER */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-[#D4AF37]/15 border border-[#D4AF37]/30 text-[#D4AF37] text-[10px] font-bold uppercase tracking-wider mb-1">
            <Heart className="w-3.5 h-3.5 fill-current text-[#A51C30]" />
            <span>Someone Believes In You</span>
          </div>
          <h1 className="font-cinzel text-3xl sm:text-4xl font-extrabold bg-gradient-to-r from-[#FFF5C0] via-[#D4AF37] to-[#AA7C11] bg-clip-text text-transparent">
            {wish
              ? cardOpened
                ? `For ${wish.candidate}`
                : 'A little joy, just for you.'
              : busy
              ? 'Your surprise is on its way.'
              : 'Let’s find your wish.'}
          </h1>
        </div>

        {/* LOADING STATE */}
        {busy && (
          <div className="glass-panel rounded-3xl p-8 sm:p-12 text-center space-y-4 border border-[#D4AF37]/30">
            <ReceiverGift label="Finding your private gift…" />
            <p role="status" className="text-xs text-slate-400 animate-pulse flex items-center justify-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-[#D4AF37]" />
              <span>Opening your invitation…</span>
            </p>
          </div>
        )}

        {/* ERROR PANEL */}
        {error && !busy && (
          <div
            className="glass-panel rounded-3xl p-6 sm:p-8 border border-red-500/40 text-center space-y-4"
            aria-live="polite"
          >
            <div className="w-12 h-12 rounded-2xl bg-red-950/60 border border-red-800/60 text-red-400 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <h2 className="font-cinzel text-lg font-bold text-slate-100">
              {wish ? 'Let’s try again' : 'Invitation unavailable'}
            </h2>
            <p className="text-xs sm:text-sm text-red-300 max-w-md mx-auto leading-relaxed">
              {error}
            </p>
            {!wish && (
              <div className="pt-2 flex flex-wrap items-center justify-center gap-3">
                <Link
                  className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#D4AF37] to-[#AA7C11] text-slate-950 font-bold text-xs"
                  href="/success-wishes/open"
                >
                  Enter access code
                </Link>
                <Link
                  className="px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 text-xs"
                  href="/success-wishes/recover"
                >
                  Find my wishes
                </Link>
                <Link
                  className="px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 text-xs"
                  href="/contact"
                >
                  Get help
                </Link>
              </div>
            )}
          </div>
        )}

        {/* ACTIVE WISH DISPLAY */}
        {wish && !busy && (
          <div className="space-y-6">
            
            {/* Toolbar */}
            <div className="flex items-center justify-between px-2 text-xs text-slate-400">
              <p className="flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-[#D4AF37]" />
                <span>
                  {wish.consentRequired
                    ? 'Your message stays sealed until verification.'
                    : cardOpened
                    ? 'Yours to keep. Yours to revisit.'
                    : 'Tap your gift to reveal the message.'}
                </span>
              </p>
              {!wish.consentRequired && (
                <button
                  type="button"
                  aria-pressed={soundEnabled}
                  onClick={toggleSound}
                  className="px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 hover:border-[#D4AF37]/40 text-slate-300 font-medium text-xs flex items-center space-x-1.5 active:scale-95 transition-all"
                >
                  {soundEnabled ? (
                    <Volume2 className="w-3.5 h-3.5 text-[#D4AF37]" />
                  ) : (
                    <VolumeX className="w-3.5 h-3.5 text-slate-500" />
                  )}
                  <span>Sound {soundEnabled ? 'On' : 'Off'}</span>
                </button>
              )}
            </div>

            {/* Gift Unboxing Area */}
            <section
              className="glass-panel rounded-3xl p-6 sm:p-8 border-2 border-[#D4AF37]/40 shadow-2xl space-y-6 text-center relative overflow-hidden"
              aria-label="Your Success Wish"
            >
              {wish.consentRequired ? (
                <div className="space-y-5">
                  <ReceiverGift
                    theme={wish.theme}
                    name={wish.candidate}
                    label="Sealed with encouragement"
                  />
                  <div className="pt-2">
                    <Link
                      className="inline-flex items-center space-x-2 px-6 py-3 rounded-xl bg-gradient-to-r from-[#D4AF37] to-[#AA7C11] text-slate-950 font-bold text-xs sm:text-sm shadow-lg shadow-[#D4AF37]/20 hover:brightness-110 active:scale-95 transition-all"
                      href={'/success-wishes/verify?card=' + encodeURIComponent(wish.id)}
                    >
                      <Lock className="w-4 h-4" />
                      <span>Verify &amp; Open My Gift</span>
                    </Link>
                  </div>
                  <p className="text-[11px] text-slate-500">
                    Under 18? Your registered parent or guardian approves access.
                  </p>
                </div>
              ) : (
                <BookCard
                  receiverView
                  template={wish.theme}
                  values={wish}
                  soundEnabled={soundEnabled}
                  onOpen={playOpeningSound}
                  beforeOpen={() => revealCard(true)}
                  onOpenedChange={(opened) => {
                    if (!opened) setCardOpened(false)
                  }}
                />
              )}

              {revealing && (
                <div role="status" className="text-xs text-[#00A896] font-semibold flex items-center justify-center gap-1.5 animate-pulse">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Revealing your message…</span>
                </div>
              )}
            </section>

            {/* Card Footer Actions */}
            <div className="space-y-4 pt-2">
              {cardOpened && (
                <h2
                  id="received-wish"
                  ref={receivedWishHeading}
                  tabIndex={-1}
                  className="font-cinzel text-center text-xl font-bold bg-gradient-to-r from-[#FFF5C0] via-[#D4AF37] to-[#AA7C11] bg-clip-text text-transparent outline-none"
                >
                  A wish to remember.
                </h2>
              )}

              <div className="flex flex-wrap items-center justify-center gap-3">
                {mode.current === 'production' && !wish.consentRequired && (
                  <Link
                    className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#D4AF37] to-[#AA7C11] text-slate-950 font-bold text-xs sm:text-sm shadow-lg shadow-[#D4AF37]/20 hover:brightness-110 active:scale-95 transition-all flex items-center space-x-1.5"
                    href={'/success-wishes/verify?card=' + encodeURIComponent(wish.id)}
                  >
                    <ShieldCheck className="w-4 h-4" />
                    <span>Keep in my inbox</span>
                  </Link>
                )}
                <Link
                  className="px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-200 font-semibold text-xs sm:text-sm hover:border-[#D4AF37]/40 active:scale-95 transition-all"
                  href="/success-wishes/inbox"
                >
                  My wishes
                </Link>
                <Link
                  className="px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-200 font-semibold text-xs sm:text-sm hover:border-[#D4AF37]/40 active:scale-95 transition-all"
                  href="/success-wishes"
                >
                  Send a wish
                </Link>
              </div>
            </div>

            {/* Privacy & Help Disclosure Details */}
            <details className="glass-panel rounded-2xl p-4 border border-slate-800 text-xs text-slate-400 space-y-3">
              <summary className="cursor-pointer font-semibold text-slate-300 hover:text-[#D4AF37] flex items-center space-x-2 select-none">
                <HelpCircle className="w-4 h-4 text-[#D4AF37]" />
                <span>Privacy &amp; help</span>
              </summary>
              <p className="text-[11px] text-slate-400 leading-relaxed pt-2 pl-6">
                Keep your link and access code private. Verify the registered contact on a new device. Sign out after using a shared phone.
              </p>
              <div className="pl-6 pt-1 flex items-center space-x-4">
                <button
                  type="button"
                  onClick={() => void signOut()}
                  className="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 hover:text-red-400 font-medium text-xs transition-colors flex items-center gap-1.5"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Sign out</span>
                </button>
                <Link href="/contact" className="hover:text-[#D4AF37] transition-colors">
                  Get help
                </Link>
              </div>
              <p className="text-[10px] text-slate-500 font-mono pl-6 pt-1">
                Wish reference: {wish.id}
              </p>
            </details>

          </div>
        )}

      </main>

      {/* FOOTER */}
      <footer className="max-w-6xl w-full mx-auto px-4 sm:px-8 py-6 border-t border-[#D4AF37]/15 text-center text-xs text-slate-500 relative z-10">
        VibeSchool Receiver Protocol · Private Wish Invitation
      </footer>

    </div>
  )
}
