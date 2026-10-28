'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import {
  Crown,
  Bell,
  Volume2,
  VolumeX,
  PlusCircle,
  KeyRound,
  ShieldCheck,
  CheckCircle2,
  Lock,
  Search,
  ArrowRight,
  LogOut,
  Sparkles,
  Inbox as InboxIcon,
  Shield
} from 'lucide-react'

import { useReceiverTheme } from '@/components/success-wishes/ReceiverShell'
import {
  broadcastReceiverLogout,
  useReceiverSessionSafety
} from '@/lib/success-wishes/receiver-browser-session'

type Card = {
  id: string
  theme: string
  sender: string | null
  opened: boolean
  createdAt: string
}

type Inbox = {
  recipient: { name: string; school: string }
  count: number
  unopened: number
  cards: Card[]
}

const API = '/api/success-wishes/receiver/inbox'

export default function SuccessWishesInboxPage() {
  const router = useRouter()
  const { setSummary } = useReceiverTheme()
  const [data, setData] = useState<Inbox | null>(null)
  useReceiverSessionSafety(!!data)
  useEffect(() => {
    setSummary(data ? { ...data.recipient, count: data.count, unopened: data.unopened } : null)
    return () => setSummary(null)
  }, [data, setSummary])

  const [error, setError] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  const [filter, setFilter] = useState<'all' | 'unopened'>('all')
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    let active = true
    fetch(API, { cache: 'no-store' })
      .then(async (r) => {
        const p = await r.json()
        if (!r.ok) {
          throw new Error(p.error || 'Verify your phone to open this inbox.')
        }
        return p as Inbox
      })
      .then((p) => {
        if (active) setData(p)
      })
      .catch((e) => {
        if (active) setError(e.message)
      })
    return () => {
      active = false
    }
  }, [])

  async function openCard(id: string) {
    setBusy(id)
    setError('')
    try {
      const r = await fetch(API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cardId: id })
      })
      const p = await r.json()
      if (!r.ok) throw new Error(p.error || 'Could not open this card.')
      router.push(p.url)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not open this card.')
    } finally {
      setBusy(null)
    }
  }

  async function signOut() {
    setBusy('signout')
    try {
      const r = await fetch(API, { method: 'DELETE' })
      if (!r.ok) throw new Error('Could not sign out.')
      setData(null)
      broadcastReceiverLogout()
      router.replace('/success-wishes/recover')
    } catch (e) {
      setData(null)
      broadcastReceiverLogout()
      setError(
        'This device was cleared, but server sign-out could not be confirmed. Close this tab and contact support.'
      )
      setBusy(null)
    }
  }

  // Filter & search logic
  const cards = (data?.cards || [])
    .filter((c) => filter === 'all' || !c.opened)
    .filter((c) => {
      if (!searchQuery.trim()) return true
      const sender = (c.sender || 'Someone special').toLowerCase()
      const theme = c.theme.toLowerCase()
      return (
        sender.includes(searchQuery.toLowerCase()) ||
        theme.includes(searchQuery.toLowerCase())
      )
    })


  return (
    <div className="min-h-0 bg-[#0A0D14] text-slate-200 antialiased selection:bg-[#D4AF37] selection:text-black flex flex-col md:flex-row">

      {/* DESKTOP SIDEBAR NAVIGATION */}


      {/* MOBILE TOP HEADER */}


      {/* MAIN CONTENT AREA */}
      <main className="flex-1 overflow-y-auto p-4 sm:p-6 md:p-8 pb-20 md:pb-8 max-w-5xl mx-auto space-y-6 w-full">

        {/* Hero Section */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800/80">
          <div>
            <span className="text-[10px] font-extrabold uppercase tracking-widest text-[#D4AF37]">
              MADE FOR YOU
            </span>
            <h2 className="font-cinzel text-xl sm:text-2xl font-bold bg-gradient-to-r from-[#FFF5C0] via-[#D4AF37] to-[#AA7C11] bg-clip-text text-transparent mt-0.5">
              My wishes
            </h2>
            <p className="text-xs sm:text-sm text-slate-400 mt-1">
              {data
                ? `Every kind word, saved for ${data.recipient.name}.`
                : 'Every wish, kept close.'}
            </p>
          </div>
          <Link
            href="/success-wishes/request"
            className="self-start sm:self-auto px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#D4AF37] to-[#AA7C11] text-slate-950 font-bold text-xs sm:text-sm shadow-lg shadow-[#D4AF37]/20 hover:brightness-110 active:scale-95 transition-all flex items-center space-x-2"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Request a wish</span>
          </Link>
        </div>

        {/* Error Alert */}
        {error && (
          <div
            className="p-4 rounded-2xl bg-red-950/40 border border-red-800/50 text-red-300 text-xs sm:text-sm space-y-3"
            role="alert"
          >
            <p className="font-medium">{error}</p>
            {!data && (
              <div className="flex flex-wrap gap-2 pt-1">
                <Link
                  className="px-3 py-1.5 rounded-lg bg-gradient-to-r from-[#D4AF37] to-[#AA7C11] text-slate-950 font-semibold text-xs"
                  href="/success-wishes/recover"
                >
                  Recover access
                </Link>
                <Link
                  className="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-slate-300 text-xs"
                  href="/success-wishes/open"
                >
                  Open a wish
                </Link>
                <Link
                  className="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-slate-300 text-xs"
                  href="/success-wishes/demo"
                >
                  Try demo inbox
                </Link>
              </div>
            )}
          </div>
        )}

        {/* Loading State */}
        {!data && !error && (
          <div
            className="p-8 rounded-2xl bg-slate-900/50 border border-slate-800 text-center text-slate-400 text-sm animate-pulse"
            role="status"
          >
            Opening your private inbox…
          </div>
        )}

        {/* Data Loaded View */}
        {data && (
          <>
            {/* Filter Tabs & Search */}
            <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
              <div className="flex items-center bg-slate-900/90 p-1 rounded-xl border border-slate-800 overflow-x-auto text-xs gap-1">
                <button
                  type="button"
                  aria-pressed={filter === 'all'}
                  onClick={() => setFilter('all')}
                  className={`whitespace-nowrap px-3.5 py-2 rounded-lg font-medium transition-all ${
                    filter === 'all'
                      ? 'bg-[#D4AF37]/20 text-[#D4AF37]'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  All wishes ({data.count})
                </button>
                <button
                  type="button"
                  aria-pressed={filter === 'unopened'}
                  onClick={() => setFilter('unopened')}
                  className={`whitespace-nowrap px-3.5 py-2 rounded-lg font-medium transition-all ${
                    filter === 'unopened'
                      ? 'bg-amber-500/20 text-amber-400'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Unopened ({data.unopened})
                </button>
              </div>

              {/* Search Bar */}
              <div className="relative min-w-[220px]">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  aria-label="Search wishes by sender or theme" placeholder="Search sender or theme..."
                  className="w-full bg-slate-900/80 border border-slate-800 text-xs text-slate-200 pl-9 pr-4 py-2 rounded-xl focus:outline-none focus:border-[#D4AF37]/60 placeholder:text-slate-500"
                />
              </div>
            </div>

            {/* Gift Card Grid */}
            {cards.length ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {cards.map((card) => {
                  const isUnopened = !card.opened
                  const senderDisplay = card.opened
                    ? card.sender || 'Someone special'
                    : 'Someone believes in you'
                  const formattedDate = new Date(card.createdAt).toLocaleDateString(
                    'en-KE',
                    { month: 'short', day: 'numeric', year: 'numeric' }
                  )

                  return (
                    <button
                      key={card.id}
                      type="button"
                      disabled={busy !== null}
                      onClick={() => void openCard(card.id)}
                      aria-label={`Open ${
                        card.opened ? 'previously opened' : 'unopened'
                      } private wish`}
                      className={`text-left group p-4 rounded-2xl bg-[#0F172A]/75 backdrop-blur-md border transition-all flex flex-col justify-between space-y-3 relative overflow-hidden ${
                        isUnopened
                          ? 'border-amber-500/30 hover:border-amber-500/60 shadow-lg shadow-amber-500/5'
                          : 'border-[#D4AF37]/20 hover:border-[#D4AF37]/50'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <span className="receiver-inbox-monogram">{card.opened ? senderDisplay.slice(0,2).toUpperCase() : <Lock size={18}/>}</span>
                        <span className={isUnopened ? 'receiver-inbox-status receiver-inbox-sealed' : 'receiver-inbox-status'}>{isUnopened ? 'Sealed Wish' : 'Opened'}</span>
                      </div>
                      {/* Card Content Summary */}
                      <div className="space-y-1">
                        <strong className="font-cinzel text-sm font-bold text-slate-100 block truncate">
                          {senderDisplay}
                        </strong>
                        <p className="text-[11px] text-slate-400">{formattedDate}</p>
                        <p className="receiver-inbox-theme">{card.theme.charAt(0).toUpperCase()+card.theme.slice(1)} Envelope</p>
                        <p className="receiver-inbox-teaser">{isUnopened ? 'A private wish waiting to be opened.' : 'Your personal message is ready to read again.'}</p>
                      </div>

                      {/* Card Bottom CTA */}
                      <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-xs">
                        <span className="text-[10px] text-slate-400 flex items-center">
                          <Sparkles className="w-3 h-3 mr-1 text-[#D4AF37]" />
                          {isUnopened ? 'Sealed Wish' : 'Saved wish'}
                        </span>
                        <span className="font-bold text-[#D4AF37] group-hover:translate-x-1 transition-transform flex items-center gap-0.5">
                          {busy === card.id
                            ? 'Opening…'
                            : card.opened
                            ? 'Read again ↗'
                            : 'Unwrap my wish ↗'}
                        </span>
                      </div>
                    </button>
                  )
                })}
              </div>
            ) : (
              <div className="p-8 rounded-2xl bg-slate-900/60 border border-slate-800 text-center space-y-3">
                <h2 className="font-cinzel text-lg font-semibold text-slate-200">
                  {searchQuery.trim() ? 'No matching wishes' : filter === 'unopened'
                    ? 'You have opened every wish'
                    : 'Your inbox is ready'}
                </h2>
                <p className="text-xs text-slate-400 max-w-md mx-auto">
                  {searchQuery.trim() ? 'Try another sender or theme, or clear your search.' : filter === 'unopened'
                    ? 'Switch to All to revisit your cards.'
                    : 'Your first surprise will appear here. Ask someone for a little encouragement.'}
                </p>
                <Link
                  href="/success-wishes/request"
                  className="inline-flex items-center space-x-2 px-4 py-2 rounded-xl bg-[#00A896] text-slate-950 font-bold text-xs hover:brightness-110 transition-all mt-2"
                >
                  <PlusCircle className="w-4 h-4" />
                  <span>Request a wish</span>
                </Link>
              </div>
            )}

            {/* Bottom Actions & Recovery Links */}
            <nav className="flex flex-wrap gap-3 pt-2" aria-label="Inbox actions">
              <Link
                className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#D4AF37] to-[#AA7C11] text-slate-950 font-bold text-xs sm:text-sm shadow-lg shadow-[#D4AF37]/20 hover:brightness-110 active:scale-95 transition-all flex items-center gap-1.5"
                href="/success-wishes/request"
              >
                <PlusCircle className="w-4 h-4" />
                <span>Request a wish</span>
              </Link>
              <Link
                className="px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-white font-semibold text-xs sm:text-sm active:scale-95 transition-all flex items-center gap-1.5"
                href="/success-wishes/settings"
              >
                <Shield className="w-4 h-4 text-[#00A896]" />
                <span>Privacy &amp; safety</span>
              </Link>
            </nav>

            <div className="pt-6 border-t border-slate-800/80 flex flex-wrap items-center justify-between text-xs text-slate-400 gap-4">
              <div className="flex items-center space-x-4">
                <Link
                  href="/success-wishes/recover"
                  className="hover:text-[#D4AF37] transition-colors"
                >
                  Recover access
                </Link>
                <button
                  type="button"
                  onClick={() => void signOut()}
                  disabled={busy !== null}
                  className="hover:text-red-400 transition-colors"
                >
                  Sign out
                </button>
                <Link
                  href="/success-wishes"
                  className="hover:text-[#D4AF37] transition-colors"
                >
                  Send a Wish
                </Link>
              </div>
              <p className="text-[10px] text-slate-500">
                VibeSchool Security Protocol
              </p>
            </div>
          </>
        )}
      </main>

      {/* MOBILE BOTTOM NAVIGATION BAR */}

    </div>
  )
}
