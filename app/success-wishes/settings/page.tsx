'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  Crown,
  ShieldCheck,
  ShieldAlert,
  EyeOff,
  Flag,
  Database,
  Trash2,
  KeyRound,
  ArrowLeft,
  HelpCircle,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  Lock,
  PhoneCall
} from 'lucide-react'
import {
  broadcastReceiverLogout,
  useReceiverSessionSafety
} from '@/lib/success-wishes/receiver-browser-session'

type Gift = { id: string; sender: string | null; opened: boolean; createdAt: string }
type Rights = { id: string; kind: string; status: string; created_at: string }

const manage = '/api/success-wishes/receiver/safety'

export default function SuccessWishSafety() {
  useReceiverSessionSafety()

  const [cards, setCards] = useState<Gift[]>([])
  const [requests, setRequests] = useState<Rights[]>([])
  const [selected, setSelected] = useState('')
  const [reason, setReason] = useState('')
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [withdrawChallenge, setWithdrawChallenge] = useState('')
  const [withdrawCode, setWithdrawCode] = useState('')
  const [consentRevoked, setConsentRevoked] = useState(false)

  useEffect(() => {
    let mounted = true
    void Promise.all([
      fetch('/api/success-wishes/receiver/inbox', { cache: 'no-store' }).then(
        async (r) => {
          const p = await r.json()
          if (!r.ok) throw new Error(p.error || 'Please verify your inbox.')
          return p
        }
      ),
      fetch(manage, { cache: 'no-store' }).then(async (r) => {
        const p = await r.json()
        if (!r.ok) throw new Error(p.error || 'Please verify your inbox.')
        return p
      })
    ])
      .then(([inbox, rights]) => {
        if (!mounted) return
        setCards(inbox.cards || [])
        setRequests(rights.requests || [])
      })
      .catch((e) => {
        if (mounted)
          setError(
            e instanceof Error ? e.message : 'Unable to load your settings.'
          )
      })

    return () => {
      mounted = false
    }
  }, [])

  async function act(
    action: 'hide' | 'report' | 'delete_data' | 'access_data'
  ) {
    setBusy(true)
    setError('')
    setStatus('')
    try {
      const r = await fetch(manage, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, cardId: selected, reason })
      })
      const p = await r.json()
      if (!r.ok) throw new Error(p.error || 'Could not save your request.')
      setStatus(p.message || 'Your choice was saved.')
      if (action === 'hide')
        setCards((list) => list.filter((c) => c.id !== selected))
      if (action === 'hide' || action === 'report') {
        setSelected('')
        setReason('')
      }
      if (action === 'delete_data' || action === 'access_data') {
        const q = await fetch(manage, { cache: 'no-store' })
        if (q.ok) setRequests((await q.json()).requests || [])
      }
    } catch (e) {
      setError(
        e instanceof Error ? e.message : 'Could not save your request.'
      )
    } finally {
      setBusy(false)
    }
  }

  async function withdraw(
    action: 'begin_withdrawal' | 'confirm_withdrawal'
  ) {
    setBusy(true)
    setError('')
    setStatus('')
    try {
      const r = await fetch(manage, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          challengeId: withdrawChallenge,
          code: withdrawCode
        })
      })
      const p = await r.json()
      if (!r.ok)
        throw new Error(
          p.error || 'We could not complete your consent request.'
        )
      if (action === 'begin_withdrawal') {
        setWithdrawChallenge(p.challengeId)
        setStatus(
          p.message ||
            'Enter the code sent to the registered consent contact.'
        )
      } else {
        broadcastReceiverLogout()
        setConsentRevoked(true)
        setWithdrawChallenge('')
        setWithdrawCode('')
        setCards([])
        setStatus(
          p.message ||
            'Consent withdrawn. Your private inbox has been closed.'
        )
      }
    } catch (e) {
      setError(
        e instanceof Error ? e.message : 'Consent could not be updated.'
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#0A0D14] text-slate-200 antialiased selection:bg-[#D4AF37] selection:text-black flex flex-col justify-between relative overflow-x-hidden">
      
      {/* BACKGROUND GLOWS */}
      <div className="absolute top-0 right-1/4 w-96 h-96 bg-[#D4AF37]/10 rounded-full blur-3xl pointer-events-none"></div>
      <div className="absolute bottom-10 left-10 w-96 h-96 bg-[#800020]/20 rounded-full blur-3xl pointer-events-none"></div>

      {/* TOP HEADER */}
      <header className="max-w-6xl w-full mx-auto px-4 sm:px-8 py-4 flex items-center justify-between border-b border-[#D4AF37]/20 relative z-10">
        <Link
          href="/success-wishes/inbox"
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
          Safety &amp; Privacy
        </span>
      </header>

      {/* MAIN CONTAINER */}
      <main className="max-w-3xl w-full mx-auto px-4 sm:px-6 py-8 sm:py-12 flex-1 flex flex-col justify-center space-y-6 relative z-10">
        
        {/* HERO TITLE */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-[#00A896]/15 border border-[#00A896]/30 text-[#00A896] text-[10px] font-bold uppercase tracking-wider mb-1">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Vault Security Controls</span>
          </div>
          <h1 className="font-cinzel text-3xl sm:text-4xl font-extrabold bg-gradient-to-r from-[#FFF5C0] via-[#D4AF37] to-[#AA7C11] bg-clip-text text-transparent">
            Your Space. Your Choice.
          </h1>
          <p className="text-xs sm:text-sm text-slate-400">
            Manage your received cards, privacy preferences, and consent controls.
          </p>
        </div>

        {/* FEEDBACK NOTICES */}
        {error && (
          <div
            className="p-4 rounded-2xl bg-red-950/50 border border-red-800/60 text-red-300 text-xs sm:text-sm space-y-1"
            role="alert"
          >
            <div className="flex items-center gap-2 font-bold text-red-200">
              <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
              <span>Attention Required</span>
            </div>
            <p className="pl-6">{error}</p>
          </div>
        )}

        {status && (
          <div
            className="p-4 rounded-2xl bg-[#00A896]/15 border border-[#00A896]/40 text-[#00A896] text-xs sm:text-sm space-y-1"
            role="status"
          >
            <div className="flex items-center gap-2 font-bold text-[#00A896]">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>Status Updated</span>
            </div>
            <p className="pl-6 text-slate-300">{status}</p>
          </div>
        )}

        {/* SECTION 1: MANAGE RECEIVED WISHES */}
        {!consentRevoked && (
          <div className="glass-panel rounded-3xl p-6 sm:p-8 border border-[#D4AF37]/30 shadow-2xl space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h2 className="font-cinzel text-base font-bold text-slate-100 flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-[#D4AF37]" />
                <span>Manage a Received Wish</span>
              </h2>
              <span className="text-[10px] text-slate-400">
                Unopened senders stay private
              </span>
            </div>

            <p className="text-xs text-slate-400">
              Select a card to remove it from your inbox or report inappropriate content to moderators.
            </p>

            <div className="space-y-4">
              {/* Select Card Dropdown */}
              <div className="space-y-1.5">
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  Choose a Received Card
                </label>
                <select
                  value={selected}
                  onChange={(e) => setSelected(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 focus:border-[#D4AF37] rounded-xl px-3.5 py-3 text-xs text-slate-200 focus:outline-none transition-colors"
                >
                  <option value="">Select a wish...</option>
                  {cards.map((c, i) => (
                    <option key={c.id} value={c.id}>
                      {c.opened ? c.sender || 'Opened wish' : 'Unopened surprise'}{' '}
                      ·{' '}
                      {new Date(c.createdAt).toLocaleDateString('en-KE', {
                        month: 'short',
                        day: 'numeric'
                      })}{' '}
                      · #{i + 1}
                    </option>
                  ))}
                </select>
              </div>

              {/* Report Reason Textarea */}
              <div className="space-y-1.5">
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  Report Reason (Required to Report)
                </label>
                <textarea
                  maxLength={500}
                  rows={3}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Describe unwanted or inappropriate content..."
                  className="w-full bg-slate-900 border border-slate-800 focus:border-[#D4AF37] rounded-xl p-3 text-xs text-slate-200 focus:outline-none transition-colors resize-none placeholder:text-slate-600"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row gap-3 pt-2">
                <button
                  type="button"
                  disabled={busy || !selected}
                  onClick={() => void act('hide')}
                  className="flex-1 py-3 px-4 rounded-xl bg-slate-900 border border-slate-800 hover:border-[#D4AF37]/40 text-slate-200 font-semibold text-xs disabled:opacity-40 disabled:pointer-events-none active:scale-95 transition-all flex items-center justify-center space-x-2"
                >
                  <EyeOff className="w-4 h-4 text-slate-400" />
                  <span>Hide From Inbox</span>
                </button>

                <button
                  type="button"
                  disabled={busy || !selected || reason.trim().length < 10}
                  onClick={() => void act('report')}
                  className="flex-1 py-3 px-4 rounded-xl bg-gradient-to-r from-[#A51C30] to-[#800020] text-slate-100 font-bold text-xs disabled:opacity-40 disabled:pointer-events-none active:scale-95 transition-all flex items-center justify-center space-x-2 shadow-md shadow-[#800020]/20"
                >
                  <Flag className="w-4 h-4 text-amber-300" />
                  <span>Report Wish</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* SECTION 2: DATA & PRIVACY RIGHTS */}
        {!consentRevoked && (
          <div className="glass-panel rounded-3xl p-6 sm:p-8 border border-[#D4AF37]/30 shadow-2xl space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h2 className="font-cinzel text-base font-bold text-slate-100 flex items-center gap-2">
                <Database className="w-4 h-4 text-[#00A896]" />
                <span>Your Data &amp; Privacy Rights</span>
              </h2>
            </div>

            <p className="text-xs text-slate-400">
              Request an encrypted copy or deletion review of your data. Note that required transaction and legal compliance records may be retained.
            </p>

            <div className="flex flex-col sm:flex-row gap-3">
              <button
                type="button"
                disabled={busy}
                onClick={() => void act('access_data')}
                className="flex-1 py-3 px-4 rounded-xl bg-slate-900 border border-slate-800 hover:border-[#00A896]/50 text-slate-200 font-semibold text-xs active:scale-95 transition-all flex items-center justify-center space-x-2"
              >
                <Database className="w-4 h-4 text-[#00A896]" />
                <span>Request My Data</span>
              </button>

              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  if (
                    window.confirm(
                      'Request deletion of your Success Wishes data?'
                    )
                  )
                    void act('delete_data')
                }}
                className="flex-1 py-3 px-4 rounded-xl bg-slate-900 border border-slate-800 hover:border-red-500/50 text-red-300 font-semibold text-xs active:scale-95 transition-all flex items-center justify-center space-x-2"
              >
                <Trash2 className="w-4 h-4 text-red-400" />
                <span>Request Data Deletion</span>
              </button>
            </div>

            {/* Recent Requests Summary */}
            {requests.length > 0 && (
              <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-2 mt-3">
                <p className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                  Recent Requests Log
                </p>
                <div className="space-y-1.5 divide-y divide-slate-800/60">
                  {requests.map((r) => (
                    <div
                      key={r.id}
                      className="pt-1.5 flex items-center justify-between text-xs"
                    >
                      <span className="text-slate-300 font-medium capitalize">
                        {r.kind === 'deletion' ? 'Data Deletion' : 'Data Access'}
                      </span>
                      <span className="text-slate-400 text-[11px]">
                        <span className="text-[#00A896] font-semibold">
                          {r.status}
                        </span>{' '}
                        ·{' '}
                        {new Date(r.created_at).toLocaleDateString('en-KE')}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* SECTION 3: WITHDRAW CONSENT */}
        {!consentRevoked && (
          <div className="glass-panel rounded-3xl p-6 sm:p-8 border border-red-500/30 shadow-2xl space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h2 className="font-cinzel text-base font-bold text-slate-100 flex items-center gap-2">
                <Lock className="w-4 h-4 text-red-400" />
                <span>Withdraw Consent</span>
              </h2>
            </div>

            <p className="text-xs text-slate-400">
              Revoke guardian consent and close access to all received wishes. Requires verification using the registered adult or guardian phone.
            </p>

            {withdrawChallenge ? (
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                    6-Digit Verification Code
                  </label>
                  <input
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={6}
                    value={withdrawCode}
                    onChange={(e) =>
                      setWithdrawCode(e.target.value.replace(/\D/g, ''))
                    }
                    placeholder="Enter 6-digit PIN..."
                    className="w-full bg-slate-900 border border-slate-800 focus:border-red-500 rounded-xl px-4 py-3 text-sm text-[#D4AF37] font-mono tracking-widest text-center focus:outline-none transition-colors"
                  />
                </div>

                <div className="flex flex-col sm:flex-row gap-3">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void withdraw('begin_withdrawal')}
                    className="flex-1 py-3 px-4 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-300 font-semibold text-xs active:scale-95 transition-all"
                  >
                    Resend Code
                  </button>

                  <button
                    type="button"
                    disabled={busy || !/^[0-9]{6}$/.test(withdrawCode)}
                    onClick={() => {
                      if (
                        window.confirm(
                          'Withdraw consent and close access to all received wishes?'
                        )
                      )
                        void withdraw('confirm_withdrawal')
                    }}
                    className="flex-1 py-3 px-4 rounded-xl bg-red-700 text-white font-bold text-xs disabled:opacity-40 disabled:pointer-events-none active:scale-95 transition-all flex items-center justify-center space-x-2 shadow-md shadow-red-900/30"
                  >
                    {busy ? (
                      <Loader2 className="w-4 h-4 animate-spin text-white" />
                    ) : (
                      <span>Confirm Withdrawal</span>
                    )}
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                disabled={busy}
                onClick={() => void withdraw('begin_withdrawal')}
                className="w-full py-3 px-4 rounded-xl bg-slate-900 border border-red-500/40 hover:border-red-500 text-red-300 font-bold text-xs active:scale-95 transition-all flex items-center justify-center space-x-2"
              >
                <span>Verify Phone to Withdraw Consent</span>
              </button>
            )}

            <details className="pt-2 border-t border-slate-800/80 group text-xs text-slate-400">
              <summary className="cursor-pointer font-semibold text-slate-300 hover:text-[#D4AF37] flex items-center space-x-2 py-1 transition-colors select-none">
                <HelpCircle className="w-3.5 h-3.5 text-[#D4AF37]" />
                <span>What happens after consent withdrawal?</span>
              </summary>
              <p className="mt-2 text-slate-400 text-[11px] leading-relaxed pl-5">
                All inbox and card viewing privileges will immediately be locked. Required financial audit records are securely retained per statutory law. Restoring access requires a new phone verification.
              </p>
            </details>
          </div>
        )}

        {/* BOTTOM NAVIGATION LINKS */}
        <div className="pt-4 flex flex-wrap items-center justify-center gap-6 text-xs text-slate-400">
          <Link
            href="/success-wishes/inbox"
            className="hover:text-[#D4AF37] transition-colors flex items-center space-x-1.5"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to My Wishes</span>
          </Link>
          <span className="text-slate-700">•</span>
          <Link
            href="/success-wishes/recover"
            className="hover:text-[#D4AF37] transition-colors flex items-center space-x-1.5"
          >
            <KeyRound className="w-3.5 h-3.5 text-amber-400" />
            <span>Recovery Options</span>
          </Link>
          <span className="text-slate-700">•</span>
          <Link
            href="/contact"
            className="hover:text-[#D4AF37] transition-colors flex items-center space-x-1.5"
          >
            <PhoneCall className="w-3.5 h-3.5 text-[#00A896]" />
            <span>Privacy Support</span>
          </Link>
        </div>

      </main>

      {/* FOOTER */}
      <footer className="max-w-6xl w-full mx-auto px-4 sm:px-8 py-6 border-t border-[#D4AF37]/15 text-center text-xs text-slate-500 relative z-10">
        VibeSchool Receiver Protocol · Privacy &amp; Security Vault
      </footer>

    </div>
  )
}
