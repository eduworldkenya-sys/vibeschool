'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { normalizeRecoveryCode } from '@/lib/success-wishes/recovery-code'
import {
  Crown,
  KeyRound,
  ShieldCheck,
  Phone,
  Lock,
  ArrowRight,
  Sparkles,
  Loader2,
  AlertTriangle,
  HelpCircle
} from 'lucide-react'

const API = '/api/success-wishes/receiver/recover'

export default function RecoverWishes() {
  const router = useRouter()
  const [clientReady, setClientReady] = useState(false)
  useEffect(() => setClientReady(true), [])
  const [phone, setPhone] = useState('')
  const [recoveryCode, setRecoveryCode] = useState('')
  const [useBackup, setUseBackup] = useState(false)
  const [challengeId, setChallengeId] = useState('')
  const [otp, setOtp] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const validPhone = /^(?:0[17]\d{8}|254[17]\d{8}|\+254[17]\d{8})$/.test(phone.trim().replace(/[ ()-]/g, ''))
  const validRecoveryCode = normalizeRecoveryCode(recoveryCode) !== null

  async function submit(method: 'POST' | 'PATCH') {
    setBusy(true)
    setError('')
    try {
      const r = await fetch(API, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone,
          ...(useBackup ? { recoveryCode: recoveryCode.trim().toUpperCase() } : {}),
          challengeId,
          code: otp
        })
      })
      const p = await r.json()
      if (!r.ok) throw new Error(p.error || 'Unable to recover this inbox.')
      if (method === 'POST') setChallengeId(p.challengeId)
      else router.replace('/success-wishes/inbox')
    } catch (e) {
      setError(
        e instanceof Error ? e.message : 'Unable to recover this inbox.'
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="min-h-0 bg-[#0A0D14] text-slate-200 antialiased selection:bg-[#D4AF37] selection:text-black flex flex-col justify-between relative overflow-x-hidden">

      {/* BACKGROUND GLOW ACCENTS */}
      <div className="absolute top-0 right-1/4 w-96 h-96 bg-[#D4AF37]/10 rounded-full blur-3xl pointer-events-none"></div>
      <div className="absolute bottom-10 left-10 w-96 h-96 bg-[#00A896]/10 rounded-full blur-3xl pointer-events-none"></div>

      {/* TOP HEADER */}


      {/* MAIN CONTAINER */}
      <main className="max-w-xl w-full mx-auto px-4 sm:px-6 py-8 sm:py-12 flex-1 flex flex-col justify-center space-y-6 relative z-10">

        {/* HERO TITLE BANNER */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-[#D4AF37]/15 border border-[#D4AF37]/30 text-[#D4AF37] text-[10px] font-bold uppercase tracking-wider mb-1">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Welcome Back</span>
          </div>
          <h1 className="font-cinzel text-3xl sm:text-4xl font-extrabold bg-gradient-to-r from-[#FFF5C0] via-[#D4AF37] to-[#AA7C11] bg-clip-text text-transparent">
            Your wishes are still here.
          </h1>
          <p className="text-xs sm:text-sm text-slate-400">
            Enter your registered phone to receive a six-digit SMS code.
          </p>
        </div>

        {/* RECOVERY FORM PANEL */}
        <div className="glass-panel rounded-3xl p-6 sm:p-8 border border-[#D4AF37]/30 shadow-2xl space-y-5">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <h2 className="font-cinzel text-base font-bold text-slate-100 flex items-center gap-2">
              <KeyRound className="w-4 h-4 text-[#D4AF37]" />
              <span>{challengeId ? 'Verify Your Phone' : 'Recover access'}</span>
            </h2>
            <ShieldCheck className="w-4 h-4 text-[#00A896]" />
          </div>

          {!clientReady && <p role="status">Preparing secure recovery…</p>}
          <form
            onSubmit={(e) => {
              e.preventDefault()
              if (!clientReady || busy || (!challengeId && (!validPhone || (useBackup && !validRecoveryCode))) || (!!challengeId && otp.length !== 6)) return
              void submit(challengeId ? 'PATCH' : 'POST')
            }}
            className="space-y-4"
          >
            {!challengeId ? (
              <>
                {/* Phone Input */}
                <div className="space-y-1.5">
                  <label htmlFor="recover-field-1" className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                    Registered Kenyan Phone Number
                  </label>
                  <div className="relative">
                    <Phone className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                    <input disabled={!clientReady} id="recover-field-1"
                      type="tel"
                      autoComplete="tel"
                      inputMode="tel"
                      required
                      placeholder="0712 345 678"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-800 focus:border-[#D4AF37] rounded-xl pl-10 pr-3.5 py-3 text-xs text-slate-200 focus:outline-none transition-colors placeholder:text-slate-600"
                    />
                  </div>
                </div>

                {/* Optional backup when a family shares the same phone */}
                {useBackup && <div className="space-y-1.5">
                  <label htmlFor="recover-field-2" className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                    Student Recovery Code
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                    <input disabled={!clientReady} id="recover-field-2"
                      type="text"
                      autoComplete="off"
                      required
                      maxLength={64}
                      autoCapitalize="characters"
                      spellCheck={false}
                      placeholder="XXXX-XXXX-XXXX-XXXX"
                      value={recoveryCode}
                      onChange={(e) => setRecoveryCode(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-800 focus:border-[#D4AF37] rounded-xl pl-10 pr-3.5 py-3 text-xs text-[#D4AF37] font-mono tracking-wider focus:outline-none transition-colors placeholder:text-slate-600 placeholder:font-sans"
                    />
                  </div>
                </div>
                {useBackup && <p className="text-xs text-slate-400">Use the recovery code saved when your wish was verified. Older codes still work.</p>}
              </>
            ) : (
              <div className="space-y-3">
                <p className="text-xs text-slate-300 bg-slate-900/60 p-3 rounded-xl border border-slate-800 leading-relaxed">
                  Enter the six-digit code sent to the registered phone. It expires after 5 minutes.
                </p>
                <div className="space-y-1.5">
                  <label htmlFor="recover-field-3" className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                    SMS Verification Code
                  </label>
                  <input disabled={!clientReady} id="recover-field-3"
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={6}
                    pattern="[0-9]{6}"
                    value={otp}
                    onChange={(e) =>
                      setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))
                    }
                    required
                    placeholder="Enter 6-digit PIN..."
                    className="w-full bg-slate-900 border border-slate-800 focus:border-[#00A896] rounded-xl px-4 py-3 text-sm text-[#D4AF37] font-mono tracking-widest text-center focus:outline-none transition-colors placeholder:text-slate-600"
                  />
                </div>
              </div>
            )}

            {error && (
              <div
                className="p-3.5 rounded-xl bg-red-950/50 border border-red-800/60 text-red-300 text-xs leading-relaxed flex items-start gap-2"
                role="alert"
              >
                <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={!clientReady || busy || (!challengeId && (!validPhone || (useBackup && !validRecoveryCode))) || (!!challengeId && otp.length !== 6)}
              className="w-full py-3.5 rounded-xl bg-gradient-to-r from-[#D4AF37] to-[#AA7C11] text-slate-950 font-bold text-xs sm:text-sm shadow-lg shadow-[#D4AF37]/20 hover:brightness-110 active:scale-95 disabled:opacity-50 disabled:pointer-events-none transition-all flex items-center justify-center space-x-2"
            >
              {busy ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-slate-950" />
                  <span>Please wait...</span>
                </>
              ) : challengeId ? (
                <>
                  <ShieldCheck className="w-4 h-4" />
                  <span>Open my inbox</span>
                </>
              ) : (
                <>
                  <span>Send my code</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          {challengeId && <button type="button" className="receiver-close-card" disabled={busy} onClick={() => { setChallengeId(''); setOtp(''); setError('') }}>Change number or request another code</button>}
          </form>
          <button type="button" className="receiver-close-card" disabled={busy} onClick={() => { setUseBackup(!useBackup); setChallengeId(''); setOtp(''); setError('') }}>{useBackup ? 'Use SMS only' : 'Use a recovery code instead'}</button>
          <p className="text-[10px] text-slate-500 text-center pt-2 border-t border-slate-800/80">Keep SMS and backup codes private. Shared family numbers may require a recovery code or original card link.</p>
        </div>

        {/* BOTTOM NAVIGATION FALLBACK LINKS */}
        <div className="pt-2 flex flex-wrap items-center justify-center gap-6 text-xs text-slate-400">
          <Link
            href="/success-wishes/open"
            className="hover:text-[#D4AF37] transition-colors flex items-center space-x-1.5"
          >
            <KeyRound className="w-3.5 h-3.5 text-[#00A896]" />
            <span>I Have A Card Access Code</span>
          </Link>
          <span className="text-slate-700">•</span>
          <Link
            href="/contact"
            className="hover:text-[#D4AF37] transition-colors flex items-center space-x-1.5"
          >
            <HelpCircle className="w-3.5 h-3.5 text-amber-400" />
            <span>Get Recovery Help</span>
          </Link>
        </div>

      </main>

      {/* FOOTER */}


    </div>
  )
}
