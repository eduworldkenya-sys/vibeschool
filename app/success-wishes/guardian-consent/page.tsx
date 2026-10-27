'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  Crown,
  ShieldAlert,
  ShieldCheck,
  UserCheck,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Lock,
  ArrowLeft,
  HelpCircle,
  PhoneCall,
  LogIn
} from 'lucide-react'

type Recipient = { id: string; name: string }
const api = '/api/success-wishes/receiver/guardian-consent'

/**
 * Existing school-linked guardian account is required, but the student
 * does not need an inbox login or recovery code to stop access.
 */
export default function GuardianConsent() {
  const [recipients, setRecipients] = useState<Recipient[]>([])
  const [receiverId, setReceiverId] = useState('')
  const [challengeId, setChallengeId] = useState('')
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [notice, setNotice] = useState('')
  const [revoked, setRevoked] = useState(false)

  useEffect(() => {
    let active = true
    void fetch(api, { cache: 'no-store' })
      .then(async (r) => {
        const body = await r.json()
        if (!r.ok)
          throw new Error(body.error || 'Could not load linked students.')
        return body
      })
      .then((body) => {
        if (active) setRecipients(body.recipients || [])
      })
      .catch((e) => {
        if (active)
          setLoadError(
            e instanceof Error ? e.message : 'Could not load guardian consent.'
          )
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [])

  async function submit(action: 'begin' | 'confirm') {
    setBusy(true)
    setError('')
    setNotice('')
    try {
      const result = await fetch(api, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, receiverId, challengeId, code })
      })
      const body = await result.json()
      if (!result.ok)
        throw new Error(
          body.error || 'The consent request could not be completed.'
        )

      if (action === 'begin') {
        setChallengeId(body.challengeId)
        setCode('')
        setNotice(
          body.message || 'Enter the code sent to your verified guardian phone.'
        )
      } else {
        setRevoked(true)
        setChallengeId('')
        setCode('')
        setRecipients((all) => all.filter((item) => item.id !== receiverId))
        setNotice(body.message || 'Consent withdrawn.')
      }
    } catch (e) {
      setError(
        e instanceof Error ? e.message : 'Could not update guardian consent.'
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#0A0D14] text-slate-200 antialiased selection:bg-[#D4AF37] selection:text-black flex flex-col justify-between relative overflow-x-hidden">
      
      {/* BACKGROUND GLOW ACCENTS */}
      <div className="absolute top-0 right-1/4 w-96 h-96 bg-[#D4AF37]/10 rounded-full blur-3xl pointer-events-none"></div>
      <div className="absolute bottom-10 left-10 w-96 h-96 bg-[#800020]/20 rounded-full blur-3xl pointer-events-none"></div>

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
          Guardian Consent
        </span>
      </header>

      {/* MAIN CONTAINER */}
      <main className="max-w-2xl w-full mx-auto px-4 sm:px-6 py-8 sm:py-12 flex-1 flex flex-col justify-center space-y-6 relative z-10">
        
        {/* HERO TITLE BANNER */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-[#A51C30]/20 border border-[#A51C30]/40 text-red-300 text-[10px] font-bold uppercase tracking-wider mb-1">
            <UserCheck className="w-3.5 h-3.5" />
            <span>For Parents and Guardians</span>
          </div>
          <h1 className="font-cinzel text-3xl sm:text-4xl font-extrabold bg-gradient-to-r from-[#FFF5C0] via-[#D4AF37] to-[#AA7C11] bg-clip-text text-transparent">
            Their Wishes. Your Consent.
          </h1>
          <p className="text-xs sm:text-sm text-slate-400">
            Sign in with your linked guardian account to withdraw access. We’ll verify your registered phone.
          </p>
        </div>

        {/* FEEDBACK NOTICES */}
        {(error || loadError) && (
          <div
            className="p-4 rounded-2xl bg-red-950/50 border border-red-800/60 text-red-300 text-xs sm:text-sm space-y-1"
            role="alert"
          >
            <div className="flex items-center gap-2 font-bold text-red-200">
              <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
              <span>Consent Error</span>
            </div>
            <p className="pl-6">{error || loadError}</p>
          </div>
        )}

        {notice && (
          <div
            className="p-4 rounded-2xl bg-[#00A896]/15 border border-[#00A896]/40 text-[#00A896] text-xs sm:text-sm space-y-1"
            role="status"
          >
            <div className="flex items-center gap-2 font-bold text-[#00A896]">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>Status Updated</span>
            </div>
            <p className="pl-6 text-slate-300">{notice}</p>
          </div>
        )}

        {/* GUARDIAN CONSENT PANEL */}
        {!revoked && (
          <div className="glass-panel rounded-3xl p-6 sm:p-8 border border-red-500/30 shadow-2xl space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h2 className="font-cinzel text-base font-bold text-slate-100 flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-red-400" />
                <span>Withdraw Guardian Consent</span>
              </h2>
              <Lock className="w-4 h-4 text-slate-500" />
            </div>

            <p className="text-xs text-slate-400 leading-relaxed">
              This closes every card in the student’s inbox. Required records remain; restoring access needs a separate review.
            </p>

            {loading ? (
              <div
                role="status"
                className="p-6 text-center text-xs text-slate-400 flex items-center justify-center space-x-2 animate-pulse"
              >
                <Loader2 className="w-4 h-4 animate-spin text-[#D4AF37]" />
                <span>Checking your linked students…</span>
              </div>
            ) : loadError ? (
              <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-400 space-y-2">
                <p>We could not check your guardian account. Sign in or contact support.</p>
                <Link
                  href="/login"
                  className="inline-flex items-center space-x-1.5 text-[#D4AF37] hover:underline font-semibold"
                >
                  <LogIn className="w-3.5 h-3.5" />
                  <span>Sign in as guardian</span>
                </Link>
              </div>
            ) : recipients.length === 0 ? (
              <p className="text-xs text-slate-400 leading-relaxed bg-slate-900/60 p-4 rounded-xl border border-slate-800">
                No active, school-verified students were found for this guardian account. If you need help withdrawing consent, contact VibeSchool support through your school.
              </p>
            ) : (
              <div className="space-y-4">
                {/* Student Selector */}
                <div className="space-y-1.5">
                  <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                    Choose Student
                  </label>
                  <select
                    value={receiverId}
                    onChange={(e) => {
                      setReceiverId(e.target.value)
                      setChallengeId('')
                      setCode('')
                      setNotice('')
                    }}
                    className="w-full bg-slate-900 border border-slate-800 focus:border-red-500 rounded-xl px-3.5 py-3 text-xs text-slate-200 focus:outline-none transition-colors"
                  >
                    <option value="">Select a student...</option>
                    {recipients.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Challenge Verification Form */}
                {challengeId ? (
                  <div className="space-y-4 pt-2 border-t border-slate-800">
                    <div className="space-y-1.5">
                      <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                        Code Sent To Your Verified Guardian Phone
                      </label>
                      <input
                        inputMode="numeric"
                        autoComplete="one-time-code"
                        maxLength={6}
                        value={code}
                        onChange={(e) =>
                          setCode(e.target.value.replace(/\D/g, ''))
                        }
                        placeholder="Enter 6-digit PIN..."
                        className="w-full bg-slate-900 border border-slate-800 focus:border-red-500 rounded-xl px-4 py-3 text-sm text-[#D4AF37] font-mono tracking-widest text-center focus:outline-none transition-colors"
                      />
                    </div>

                    <div className="flex flex-col sm:flex-row gap-3">
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void submit('begin')}
                        className="flex-1 py-3 px-4 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-300 font-semibold text-xs active:scale-95 transition-all"
                      >
                        Send Another Code
                      </button>

                      <button
                        type="button"
                        disabled={busy || !/^[0-9]{6}$/.test(code)}
                        onClick={() => {
                          if (
                            window.confirm(
                              'Withdraw guardian consent and stop access to all these wishes?'
                            )
                          )
                            void submit('confirm')
                        }}
                        className="flex-1 py-3 px-4 rounded-xl bg-gradient-to-r from-[#A51C30] to-[#800020] text-white font-bold text-xs disabled:opacity-40 disabled:pointer-events-none active:scale-95 transition-all flex items-center justify-center space-x-2 shadow-md shadow-[#800020]/30"
                      >
                        {busy ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin text-white" />
                            <span>Confirming...</span>
                          </>
                        ) : (
                          <>
                            <ShieldAlert className="w-4 h-4" />
                            <span>Confirm Withdrawal</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    disabled={busy || !receiverId}
                    onClick={() => void submit('begin')}
                    className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-[#A51C30] to-[#800020] text-white font-bold text-xs sm:text-sm disabled:opacity-40 disabled:pointer-events-none active:scale-95 transition-all flex items-center justify-center space-x-2 shadow-lg shadow-[#800020]/20"
                  >
                    {busy ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin text-white" />
                        <span>Sending Code...</span>
                      </>
                    ) : (
                      <>
                        <ShieldAlert className="w-4 h-4" />
                        <span>Send Withdrawal Code</span>
                      </>
                    )}
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* BOTTOM NAVIGATION LINKS */}
        <div className="pt-4 flex flex-wrap items-center justify-center gap-6 text-xs text-slate-400">
          <Link
            href="/success-wishes"
            className="hover:text-[#D4AF37] transition-colors flex items-center space-x-1.5"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back To Success Wishes</span>
          </Link>
          <span className="text-slate-700">•</span>
          <Link
            href="/login"
            className="hover:text-[#D4AF37] transition-colors flex items-center space-x-1.5"
          >
            <LogIn className="w-3.5 h-3.5 text-[#00A896]" />
            <span>Sign In As Guardian</span>
          </Link>
          <span className="text-slate-700">•</span>
          <Link
            href="/contact"
            className="hover:text-[#D4AF37] transition-colors flex items-center space-x-1.5"
          >
            <PhoneCall className="w-3.5 h-3.5 text-amber-400" />
            <span>Get Help</span>
          </Link>
          <span className="text-slate-700">•</span>
          <Link
            href="/success-wishes/settings"
            className="hover:text-[#D4AF37] transition-colors flex items-center space-x-1.5"
          >
            <ShieldCheck className="w-3.5 h-3.5 text-[#D4AF37]" />
            <span>Student Privacy Settings</span>
          </Link>
        </div>

      </main>

      {/* FOOTER */}
      <footer className="max-w-6xl w-full mx-auto px-4 sm:px-8 py-6 border-t border-[#D4AF37]/15 text-center text-xs text-slate-500 relative z-10">
        VibeSchool Receiver Protocol · Guardian Consent Control Portal
      </footer>

    </div>
  )
}
