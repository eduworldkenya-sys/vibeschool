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
  Clock,
  Search,
  ArrowRight,
  LogOut,
  Sparkles,
  Inbox as InboxIcon,
  UserCheck
} from 'lucide-react'
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
  const [data, setData] = useState<Inbox | null>(null)
  useReceiverSessionSafety(!!data)

  const [error, setError] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  const [filter, setFilter] = useState<'all' | 'unopened' | 'opened'>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [soundEnabled, setSoundEnabled] = useState(true)

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

  // Filter & Search computation
  const cards = (data?.cards || [])
    .filter((c) => {
      if (filter === 'unopened') return !c.opened
      if (filter === 'opened') return c.opened
      return true
    })
    .filter((c) => {
      if (!searchQuery.trim()) return true
      const sender = (c.sender || 'Someone special').toLowerCase()
      const theme = c.theme.toLowerCase()
      return (
        sender.includes(searchQuery.toLowerCase()) ||
        theme.includes(searchQuery.toLowerCase())
      )
    })

  const unopenedCount = data?.unopened ?? 0
  const totalCount = data?.count ?? 0
  const openedCount = totalCount - unopenedCount

  return (
    <div className="min-h-screen bg-[#0A0D14] text-slate-200 antialiased selection:bg-[#D4AF37] selection:text-black flex flex-col md:flex-row">
      
      {/* DESKTOP SIDEBAR NAVIGATION */}
      <aside className="hidden md:flex flex-col w-72 bg-[#0F172A]/75 backdrop-blur-xl border-r border-[#D4AF37]/20 p-6 justify-between sticky top-0 h-screen z-20">
        <div>
          {/* Brand Header */}
          <div className="flex items-center space-x-3 mb-8 pb-6 border-b border-slate-800">
            <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-[#D4AF37] via-[#00A896] to-[#800020] p-0.5 shadow-lg shadow-[#D4AF37]/10">
              <div className="w-full h-full bg-[#0A0D14] rounded-full flex items-center justify-center">
                <Crown className="w-5 h-5 text-[#D4AF37]" />
              </div>
            </div>
            <div>
              <h1 className="font-cinzel text-sm font-bold bg-gradient-to-r from-[#FFF5C0] via-[#D4AF37] to-[#AA7C11] bg-clip-text text-transparent tracking-wider">
                VIBESCHOOL
              </h1>
              <p className="text-[10px] text-slate-400 font-medium tracking-widest uppercase">
                Receiver Hub
              </p>
            </div>
          </div>

          {/* Navigation Items */}
          <nav className="space-y-2">
            <div className="w-full flex items-center justify-between px-4 py-3 rounded-xl bg-slate-800/80 text-[#D4AF37] border border-[#D4AF37]/30 transition-all shadow-md">
              <div className="flex items-center space-x-3">
                <InboxIcon className="w-5 h-5" />
                <span className="text-sm font-semibold">Wish Vault Inbox</span>
              </div>
              <span className="bg-[#D4AF37] text-slate-950 text-xs px-2 py-0.5 rounded-full font-bold">
                {unopenedCount}
              </span>
            </div>

            <Link
              href="/success-wishes/request"
              className="w-full flex items-center justify-between px-4 py-3 rounded-xl text-slate-400 hover:bg-slate-800/50 hover:text-slate-200 border border-transparent transition-all"
            >
              <div className="flex items-center space-x-3">
                <PlusCircle className="w-5 h-5 text-[#A51C30]" />
                <span class="text-sm font-semibold">Request Wish</span>
              </div>
              <ArrowRight className="w-4 h-4" />
            </Link>

            <Link
              href="/success-wishes/recover"
              className="w-full flex items-center justify-between px-4 py-3 rounded-xl text-slate-400 hover:bg-slate-800/50 hover:text-slate-200 border border-transparent transition-all"
            >
              <div className="flex items-center space-x-3">
                <KeyRound className="w-5 h-5 text-amber-400" />
                <span className="text-sm font-semibold">Recover Access</span>
              </div>
            </Link>
          </nav>

          {/* Vault Security Summary Widget */}
          <div className="mt-8 p-4 rounded-2xl bg-slate-900/80 border border-slate-800/80 space-y-3">
            <div className="flex justify-between items-center text-xs">
              <span className="text-slate-400">Vault Security</span>
              <span className="text-[#00A896] font-semibold flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5" /> Encrypted
              </span>
            </div>
            <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
              <div
                className="bg-gradient-to-r from-[#D4AF37] to-[#00A896] h-full"
                style={{
                  width: totalCount > 0 ? `${(openedCount / totalCount) * 100}%` : '0%'
                }}
              ></div>
            </div>
            <div className="flex justify-between text-[11px] text-slate-500">
              <span>{openedCount} Opened</span>
              <span>{unopenedCount} Waiting</span>
            </div>
          </div>
        </div>

        {/* Footer & User / Signout Options */}
        <div className="space-y-4 pt-6 border-t border-slate-800">
          <button
            onClick={() => setSoundEnabled(!soundEnabled)}
            className="w-full flex items-center justify-between px-4 py-2.5 rounded-xl bg-slate-900/60 border border-slate-800 text-xs text-slate-300 hover:border-[#D4AF37]/50 transition-all"
          >
            <span className="flex items-center space-x-2">
              {soundEnabled ? (
                <Volume2 className="w-4 h-4 text-[#D4AF37]" />
              ) : (
                <VolumeX className="w-4 h-4 text-slate-500" />
              )}
              <span>Audio Chimes</span>
            </span>
            <span
              className={`text-[10px] font-semibold uppercase ${
                soundEnabled ? 'text-[#00A896]' : 'text-slate-500'
              }`}
            >
              {soundEnabled ? 'ON' : 'OFF'}
            </span>
          </button>

          {data && (
            <div className="flex items-center justify-between pt-2">
              <div className="flex items-center space-x-3 overflow-hidden">
                <div className="w-9 h-9 shrink-0 rounded-full bg-[#D4AF37]/20 border border-[#D4AF37]/40 flex items-center justify-center font-bold text-xs text-[#D4AF37]">
                  {data.recipient.name.slice(0, 2).toUpperCase()}
                </div>
                <div className="overflow-hidden">
                  <p className="text-xs font-semibold text-slate-200 truncate">
                    {data.recipient.name}
                  </p>
                  <p className="text-[10px] text-slate-400 truncate">
                    {data.recipient.school || 'VibeSchool Member'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => void signOut()}
                disabled={busy !== null}
                title="Sign out"
                className="p-2 text-slate-400 hover:text-red-400 rounded-lg hover:bg-slate-800/60 transition-colors"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* MOBILE TOP HEADER */}
      <header className="md:hidden sticky top-0 z-40 bg-[#0A0D14]/90 backdrop-blur-md px-4 py-3 border-b border-[#D4AF37]/20 flex items-center justify-between shadow-lg">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-[#D4AF37] to-[#800020] p-0.5 flex items-center justify-center">
            <div className="w-full h-full bg-[#0A0D14] rounded-full flex items-center justify-center">
              <Crown className="w-4 h-4 text-[#D4AF37]" />
            </div>
          </div>
          <div>
            <h1 className="font-cinzel text-xs font-bold bg-gradient-to-r from-[#FFF5C0] via-[#D4AF37] to-[#AA7C11] bg-clip-text text-transparent tracking-wider">
              VIBESCHOOL
            </h1>
            <p className="text-[9px] text-slate-400 font-medium tracking-tight">RECEIVER HUB</p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          {data && (
            <button
              onClick={() => void signOut()}
              disabled={busy !== null}
              className="p-2 rounded-xl bg-slate-900/60 border border-slate-800 text-slate-300 hover:text-red-400 active:scale-95 transition-all text-xs flex items-center gap-1"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </header>

      {/* MAIN CONTENT AREA */}
      <main className="flex-1 overflow-y-auto p-4 sm:p-6 md:p-8 pb-20 md:pb-8 max-w-5xl mx-auto space-y-6 w-full">
        
        {/* Header Banner */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800/80">
          <div>
            <h2 className="font-cinzel text-xl sm:text-2xl font-bold bg-gradient-to-r from-[#FFF5C0] via-[#D4AF37] to-[#AA7C11] bg-clip-text text-transparent">
              Wish Vault Inbox
            </h2>
            <p className="text-xs sm:text-sm text-slate-400 mt-1">
              {data
                ? `Every kind word and keepsake, saved for ${data.recipient.name}.`
                : 'Your private collection of encrypted graduation wishes.'}
            </p>
          </div>
          <Link
            href="/success-wishes/request"
            className="self-start sm:self-auto px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#D4AF37] to-[#AA7C11] text-slate-950 font-bold text-xs sm:text-sm shadow-lg shadow-[#D4AF37]/20 hover:brightness-110 active:scale-95 transition-all flex items-center space-x-2"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Request Wish Link</span>
          </Link>
        </div>

        {/* Error / Loading States */}
        {error && (
          <div
            className="p-4 rounded-2xl bg-red-950/40 border border-red-800/50 text-red-300 text-xs sm:text-sm space-y-3"
            role="alert"
          >
            <p className="font-medium">{error}</p>
            {!data && (
              <div className="flex flex-wrap gap-2 pt-1">
                <Link
                  className="px-3 py-1.5 rounded-lg bg-red-800 text-white font-semibold text-xs"
                  href="/success-wishes/recover"
                >
                  Find My Wishes
                </Link>
                <Link
                  className="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-slate-300 text-xs"
                  href="/success-wishes/open"
                >
                  Open Card Link
                </Link>
              </div>
            )}
          </div>
        )}

        {!data && !error && (
          <div className="p-8 rounded-2xl bg-slate-900/50 border border-slate-800 text-center text-slate-400 text-sm animate-pulse">
            Opening your private wish vault...
          </div>
        )}

        {/* Data Loaded */}
        {data && (
          <>
            {/* Filters & Mobile Search */}
            <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
              {/* Category Filter Chips */}
              <div className="flex items-center bg-slate-900/90 p-1 rounded-xl border border-slate-800 overflow-x-auto text-xs gap-1">
                <button
                  onClick={() => setFilter('all')}
                  className={`whitespace-nowrap px-3.5 py-2 rounded-lg font-medium transition-all ${
                    filter === 'all'
                      ? 'bg-[#D4AF37]/20 text-[#D4AF37]'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  All Wishes ({totalCount})
                </button>
                <button
                  onClick={() => setFilter('unopened')}
                  className={`whitespace-nowrap px-3.5 py-2 rounded-lg font-medium transition-all ${
                    filter === 'unopened'
                      ? 'bg-amber-500/20 text-amber-400'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Unopened ({unopenedCount})
                </button>
                <button
                  onClick={() => setFilter('opened')}
                  className={`whitespace-nowrap px-3.5 py-2 rounded-lg font-medium transition-all ${
                    filter === 'opened'
                      ? 'bg-[#00A896]/20 text-[#00A896]'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Opened ({openedCount})
                </button>
              </div>

              {/* Search Bar */}
              <div className="relative min-w-[220px]">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search sender or theme..."
                  className="w-full bg-slate-900/80 border border-slate-800 text-xs text-slate-200 pl-9 pr-4 py-2.5 rounded-xl focus:outline-none focus:border-[#D4AF37]/60 placeholder:text-slate-500"
                />
              </div>
            </div>

            {/* Inbox Card Grid */}
            {cards.length ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {cards.map((card) => {
                  const isUnopened = !card.opened
                  const senderName = card.opened
                    ? card.sender || 'Someone Special'
                    : 'Someone believes in you'
                  const formattedDate = new Date(card.createdAt).toLocaleDateString(
                    'en-KE',
                    {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric'
                    }
                  )

                  return (
                    <div
                      key={card.id}
                      className={`group p-5 rounded-2xl bg-[#0F172A]/75 backdrop-blur-md border transition-all relative overflow-hidden flex flex-col justify-between space-y-4 ${
                        isUnopened
                          ? 'border-amber-500/30 hover:border-amber-500/60 shadow-lg shadow-amber-500/5'
                          : 'border-[#D4AF37]/20 hover:border-[#D4AF37]/50'
                      }`}
                    >
                      {/* Top Header */}
                      <div className="flex justify-between items-start">
                        <div className="flex items-center space-x-3">
                          <div
                            className={`w-10 h-10 rounded-full border flex items-center justify-center font-bold text-sm ${
                              isUnopened
                                ? 'bg-amber-500/20 border-amber-500/40 text-amber-400'
                                : 'bg-[#00A896]/20 border-[#00A896]/40 text-[#00A896]'
                            }`}
                          >
                            {senderName.slice(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <h3 className="font-semibold text-slate-100 text-sm">
                              {senderName}
                            </h3>
                            <p className="text-[11px] text-slate-400">{formattedDate}</p>
                          </div>
                        </div>

                        <span
                          className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold border ${
                            isUnopened
                              ? 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                              : 'bg-[#00A896]/15 text-[#00A896] border-[#00A896]/30'
                          }`}
                        >
                          {isUnopened ? (
                            <>
                              <Lock className="w-3 h-3 mr-1" /> Sealed Wish
                            </>
                          ) : (
                            <>
                              <CheckCircle2 className="w-3 h-3 mr-1" /> Opened
                            </>
                          )}
                        </span>
                      </div>

                      {/* Content / Theme Teaser */}
                      <div className="space-y-1.5">
                        <div className="flex items-center space-x-2">
                          <h4 className="font-cinzel text-xs font-semibold text-[#D4AF37] capitalize">
                            {card.theme.replace('-', ' ')} Envelope
                          </h4>
                        </div>
                        <p className="text-xs text-slate-300 line-clamp-2 italic">
                          {isUnopened
                            ? '"An encrypted wish waiting to be unboxed..."'
                            : '"Click below to revisit your full keepsake card & personal audio..."'}
                        </p>
                      </div>

                      {/* Footer Actions */}
                      <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between">
                        <span className="text-[10px] text-slate-400 flex items-center">
                          <Sparkles className="w-3 h-3 mr-1 text-[#D4AF37]" />
                          {isUnopened ? 'Ready to Unwrap' : 'Keepsake Vault'}
                        </span>

                        <button
                          disabled={busy !== null}
                          onClick={() => void openCard(card.id)}
                          className={`px-3.5 py-1.5 rounded-lg font-bold text-xs active:scale-95 transition-all flex items-center space-x-1 ${
                            isUnopened
                              ? 'bg-gradient-to-r from-[#D4AF37] to-[#AA7C11] text-slate-950 shadow-md shadow-[#D4AF37]/20 hover:brightness-110'
                              : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
                          }`}
                        >
                          <span>
                            {busy === card.id
                              ? 'Opening...'
                              : isUnopened
                              ? 'Unwrap Wish'
                              : 'Read Again'}
                          </span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="p-8 rounded-2xl bg-slate-900/60 border border-slate-800 text-center space-y-3">
                <h3 className="font-cinzel text-lg font-semibold text-slate-200">
                  {filter === 'unopened'
                    ? 'You have opened every wish!'
                    : 'Your wish vault is ready'}
                </h3>
                <p className="text-xs text-slate-400 max-w-md mx-auto">
                  {filter === 'unopened'
                    ? 'Switch to "All Wishes" to re-read your cards and blessings.'
                    : 'Your first surprise will appear here as soon as loved ones send their wishes.'}
                </p>
                <Link
                  href="/success-wishes/request"
                  className="inline-flex items-center space-x-2 px-4 py-2 rounded-xl bg-[#00A896] text-slate-950 font-bold text-xs hover:brightness-110 transition-all mt-2"
                >
                  <PlusCircle className="w-4 h-4" />
                  <span>Request a Wish Now</span>
                </Link>
              </div>
            )}

            {/* Bottom Secondary Links */}
            <div className="pt-6 border-t border-slate-800/80 flex flex-wrap items-center justify-between text-xs text-slate-400 gap-4">
              <div className="flex items-center space-x-4">
                <Link
                  href="/success-wishes/settings"
                  className="hover:text-[#D4AF37] transition-colors"
                >
                  Privacy & Safety
                </Link>
                <Link
                  href="/success-wishes/recover"
                  className="hover:text-[#D4AF37] transition-colors"
                >
                  Recover Access
                </Link>
              </div>
              <p className="text-[10px] text-slate-500">
                VibeSchool Encrypted Vault Protocol
              </p>
            </div>
          </>
        )}
      </main>

      {/* MOBILE BOTTOM NAVIGATION BAR */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#0A0D14]/90 backdrop-blur-lg border-t border-[#D4AF37]/25 px-4 py-2 flex items-center justify-around shadow-2xl">
        <Link
          href="/success-wishes/inbox"
          className="flex flex-col items-center justify-center text-[#D4AF37]"
        >
          <InboxIcon className="w-5 h-5" />
          <span className="text-[10px] font-medium mt-1">Inbox</span>
        </Link>

        <Link
          href="/success-wishes/request"
          className="flex flex-col items-center justify-center -mt-5"
        >
          <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-[#D4AF37] via-[#00A896] to-[#800020] p-3 shadow-lg shadow-[#D4AF37]/30 flex items-center justify-center active:scale-90 transition-transform">
            <PlusCircle className="w-6 h-6 text-slate-950" />
          </div>
          <span className="text-[9px] font-bold text-[#D4AF37] mt-0.5">Request</span>
        </Link>

        <Link
          href="/success-wishes/recover"
          className="flex flex-col items-center justify-center text-slate-400 hover:text-slate-200"
        >
          <KeyRound className="w-5 h-5" />
          <span className="text-[10px] font-medium mt-1">Access</span>
        </Link>
      </nav>
    </div>
  )
}
