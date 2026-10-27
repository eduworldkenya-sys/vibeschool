'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  Crown,
  ShieldCheck,
  Lock,
  KeyRound,
  CheckCircle2,
  Copy,
  Check,
  AlertTriangle,
  Loader2,
  ArrowRight,
  ArrowLeft,
  Sparkles,
  RefreshCw
} from 'lucide-react'

const API = '/api/success-wishes/receiver/verify'

export default function VerifyWishReceiver() {
  const [challengeId, setChallengeId] = useState('')
  const [cardId, setCardId] = useState('')
  const [setupToken, setSetupToken] = useState('')
  const [consentRole, setConsentRole] = useState<
    'adult' | 'guardian' | 'verified' | ''
  >('')
  const [acknowledged, setAcknowledged] = useState(false)
  const [replaceLostRecoveryCode, setReplaceLostRecoveryCode] = useState(false)

  useEffect(() => {
    setCardId(new URLSearchParams(window.location.search).get('card') || '')
    const token =
      new URLSearchParams(window.location.hash.slice(1)).get('setup') || ''
    if (/^[a-f0-9]{64}$/.test(token)) setSetupToken(token)
  }, [])

  const [otp, setOtp] = useState('')
  const [secret, setSecret] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)

  async function request(method: 'POST' | 'PATCH', body: object) {
    setBusy(true)
    setError('')
    try {
      const response = await fetch(API, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(setupToken ? { ...body, setupToken } : body)
      })
      const data = await response.json()
      if (!response.ok)
        throw new Error(data.error || 'Unable to verify your phone.')
      if (method === 'POST') {
        setChallengeId(data.challengeId)
        setConsentRole(data.consentRole)
      } else {
        setSecret(data.recoveryCode || null)
        setDone(true)
      }
    } catch (e) {
      setError(
        e instanceof Error ? e.message : 'Unable to verify your phone.'
      )
    } finally {
      setBusy(false)
    }
  }

  function copySecretToClipboard() {
    if (secret && navigator.clipboard) {
      navigator.clipboard.writeText(secret)
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    }
  }

  return (
    <div className="min-h-screen bg-[#0A0D14] text-slate-200 antialiased selection:bg-[#D4AF37] selection:text-black flex flex-col justify-between relative overflow-x-hidden">
      
      {/* BACKGROUND GLOW ACCENTS */}
      <div className="absolute top-0 right-1/4 w-96 h-96 bg-[#D4AF37]/10 rounded-full blur-3xl pointer-events-none"></div>
      <div className="absolute bottom-10 left-10 w-96 h-96 bg-[#00A896]/10 rounded-full blur-3xl pointer-events-none"></div>

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
          Secure Inbox Setup
        </span>
      </header>

      {/* MAIN CONTAINER */}
      <main className="max-w-2xl w-full mx-auto px-4 sm:px-6 py-8 sm:py-12 flex-1 flex flex-col justify-center space-y-6 relative z-10">
        
        {/* HERO TITLE BANNER */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-[#D4AF37]/15 border border-[#D4AF37]/30 text-[#D4AF37] text-[10px] font-bold uppercase tracking-wider mb-1">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Keep Every Wish</span>
          </div>
          <h1 className="font-cinzel text-3xl sm:text-4xl font-extrabold bg-gradient-to-r from-[#FFF5C0] via-[#D4AF37] to-[#AA7C11] bg-clip-text text-transparent">
            Your Gift. Safely Yours.
          </h1>
          <p className="text-xs sm:text-sm text-slate-400">
            {setupToken
              ? 'Verify your registered phone, then share a private wish request from your inbox.'
              : 'Verify your registered phone to open your wish.'}
          </p>
        </div>

        {/* VERIFICATION PANEL */}
        <div className="glass-panel rounded-3xl p-6 sm:p-8 border border-[#D4AF37]/30 shadow-2xl space-y-5">
          {done ? (
            /* STATE A: VERIFICATION COMPLETE */
            <div className="space-y-6 animate-in fade-in zoom-in duration-500">
              <div className="flex items-center space-x-3 pb-3 border-b border-slate-800">
                <div className="w-10 h-10 rounded-2xl bg-[#00A896]/20 border border-[#00A896]/40 text-[#00A896] flex items-center justify-center">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="font-cinzel text-base font-bold text-slate-100">
                    Your Private Inbox Is Ready
                  </h2>
                  <p className="text-xs text-slate-400">
                    Phone authenticated and vault keys generated.
                  </p>
                </div>
              </div>

              {secret ? (
                <div className="p-4 sm:p-5 rounded-2xl bg-slate-900/90 border border-[#D4AF37]/40 space-y-3">
                  <div className="flex items-center space-x-2 text-xs font-bold text-[#D4AF37]">
                    <Lock className="w-4 h-4" />
                    <span>Save Your Private Recovery Code Now</span>
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    Keep this code in a safe place. Recovering your inbox on new devices requires this code and an SMS check.
                  </p>
                  <code className="block p-3.5 bg-[#0A0D14] border border-slate-800 rounded-xl text-center font-mono text-sm text-[#D4AF37] tracking-wider break-all select-all">
                    {secret}
                  </code>
                  <button
                    type="button"
                    onClick={copySecretToClipboard}
                    className="w-full py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs transition-all flex items-center justify-center space-x-2"
                  >
                    {copied ? (
                      <>
                        <Check className="w-4 h-4 text-[#00A896]" />
                        <span className="text-[#00A896]">Copied Recovery Code</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4 text-[#00A896]" />
                        <span>Copy Recovery Code</span>
                      </>
                    )}
                  </button>
                </div>
              ) : (
                <p className="text-xs text-slate-300 leading-relaxed bg-slate-900/60 p-4 rounded-2xl border border-slate-800">
                  Your existing student recovery code remains active. If you lost it, verify this card again and select &ldquo;I lost my recovery code&rdquo;.
                </p>
              )}

              <div className="flex flex-col sm:flex-row gap-3 pt-2">
                <Link
                  href="/success-wishes/inbox"
                  className="flex-1 py-3 px-4 rounded-xl bg-gradient-to-r from-[#D4AF37] to-[#AA7C11] text-slate-950 font-bold text-xs sm:text-sm shadow-lg shadow-[#D4AF37]/20 hover:brightness-110 active:scale-95 transition-all text-center"
                >
                  Open My Inbox
                </Link>
                {cardId && (
                  <Link
                    href={
                      '/success-wishes/invitation?card=' +
                      encodeURIComponent(cardId)
                    }
                    className="flex-1 py-3 px-4 rounded-xl bg-slate-900 border border-slate-800 hover:border-[#D4AF37]/40 text-slate-200 font-bold text-xs sm:text-sm active:scale-95 transition-all text-center"
                  >
                    Open My Card
                  </Link>
                )}
              </div>
            </div>
          ) : (
            /* STATE B: OTP & CONSENT FLOW */
            <div className="space-y-5">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <h2 className="font-cinzel text-base font-bold text-slate-100 flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-[#D4AF37]" />
                  <span>
                    {challengeId ? 'Enter Your SMS Code' : 'One Quick Check'}
                  </span>
                </h2>
                <KeyRound className="w-4 h-4 text-slate-500" />
              </div>

              <p className="text-xs text-slate-300 leading-relaxed">
                {challengeId
                  ? consentRole === 'guardian'
                    ? 'Your guardian must enter the six-digit SMS code sent to their registered phone. Code valid for 5 minutes.'
                    : 'Enter the six-digit SMS code sent to your registered phone. Code valid for 5 minutes.'
                  : 'We’ll send a verification PIN to the registered adult or guardian phone number.'}
              </p>

              {!challengeId ? (
                <button
                  type="button"
                  disabled={busy || (!cardId && !setupToken)}
                  onClick={() => void request('POST', { cardId })}
                  className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-[#D4AF37] to-[#AA7C11] text-slate-950 font-bold text-xs sm:text-sm shadow-lg shadow-[#D4AF37]/20 hover:brightness-110 active:scale-95 disabled:opacity-50 disabled:pointer-events-none transition-all flex items-center justify-center space-x-2"
                >
                  {busy ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin text-slate-950" />
                      <span>Sending Code...</span>
                    </>
                  ) : (
                    <>
                      <span>Send My Code</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              ) : (
                <form
                  onSubmit={(e) => {
                    e.preventDefault()
                    void request('PATCH', {
                      cardId,
                      challengeId,
                      code: otp,
                      consentRole,
                      consentAcknowledged:
                        consentRole === 'verified' || acknowledged,
                      replaceLostRecoveryCode
                    })
                  }}
                  className="space-y-4"
                >
                  {/* OTP Code Input */}
                  <div className="space-y-1.5">
                    <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                      SMS Verification Code
                    </label>
                    <input
                      autoComplete="one-time-code"
                      inputMode="numeric"
                      maxLength={6}
                      required
                      pattern="[0-9]{6}"
                      value={otp}
                      onChange={(e) =>
                        setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))
                      }
                      placeholder="000000"
                      className="w-full bg-slate-900 border border-slate-800 focus:border-[#00A896] rounded-xl px-4 py-3 text-sm text-[#D4AF37] font-mono tracking-widest text-center focus:outline-none transition-colors"
                    />
                  </div>

                  {/* Consent Checkboxes */}
                  {consentRole === 'adult' && (
                    <label className="flex items-start space-x-3 p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 cursor-pointer text-xs text-slate-300 leading-relaxed hover:border-[#D4AF37]/30 transition-colors">
                      <input
                        type="checkbox"
                        checked={acknowledged}
                        onChange={(e) => setAcknowledged(e.target.checked)}
                        className="mt-0.5 rounded border-slate-700 bg-slate-900 text-[#D4AF37] focus:ring-[#D4AF37] accent-[#D4AF37] w-4 h-4 shrink-0"
                      />
                      <span>
                        I confirm I am at least 18, control the verified phone and agree to receive and privately store these wishes.
                      </span>
                    </label>
                  )}

                  {consentRole === 'guardian' && (
                    <label className="flex items-start space-x-3 p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 cursor-pointer text-xs text-slate-300 leading-relaxed hover:border-[#D4AF37]/30 transition-colors">
                      <input
                        type="checkbox"
                        checked={acknowledged}
                        onChange={(e) => setAcknowledged(e.target.checked)}
                        className="mt-0.5 rounded border-slate-700 bg-slate-900 text-[#D4AF37] focus:ring-[#D4AF37] accent-[#D4AF37] w-4 h-4 shrink-0"
                      />
                      <span>
                        I confirm I am the authorised parent or guardian for this student and consent to their receiving and storing these private wishes.
                      </span>
                    </label>
                  )}

                  <label className="flex items-start space-x-3 p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 cursor-pointer text-xs text-slate-300 leading-relaxed hover:border-amber-500/30 transition-colors">
                    <input
                      type="checkbox"
                      checked={replaceLostRecoveryCode}
                      onChange={(e) =>
                        setReplaceLostRecoveryCode(e.target.checked)
                      }
                      className="mt-0.5 rounded border-slate-700 bg-slate-900 text-amber-400 focus:ring-amber-400 accent-amber-400 w-4 h-4 shrink-0"
                    />
                    <span>
                      I lost my recovery code. Replace it after verification; my old recovery code will stop working.
                    </span>
                  </label>

                  {/* Submit Verification */}
                  <button
                    type="submit"
                    disabled={
                      busy ||
                      otp.length !== 6 ||
                      (consentRole !== 'verified' && !acknowledged)
                    }
                    className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-[#00A896] to-[#0F5257] text-white font-bold text-xs sm:text-sm shadow-lg shadow-[#00A896]/20 hover:brightness-110 active:scale-95 disabled:opacity-40 disabled:pointer-events-none transition-all flex items-center justify-center space-x-2"
                  >
                    {busy ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin text-white" />
                        <span>Verifying Code...</span>
                      </>
                    ) : (
                      <>
                        <ShieldCheck className="w-4 h-4" />
                        <span>Verify &amp; Open Inbox</span>
                      </>
                    )}
                  </button>
                </form>
              )}

              {/* Missing Token Warning */}
              {!cardId && !setupToken && (
                <div className="p-3.5 rounded-xl bg-red-950/50 border border-red-800/60 text-red-300 text-xs leading-relaxed flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                  <span>
                    Open your private card link or enter its access code before starting verification.
                  </span>
                </div>
              )}

              {/* Resend Code Option */}
              {challengeId && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    setChallengeId('')
                    setOtp('')
                    setAcknowledged(false)
                  }}
                  className="w-full py-2.5 px-4 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-400 hover:text-slate-200 font-medium text-xs transition-all flex items-center justify-center space-x-1.5"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Request A New Code</span>
                </button>
              )}

              {/* Error Message */}
              {error && (
                <div
                  className="p-3.5 rounded-xl bg-red-950/50 border border-red-800/60 text-red-300 text-xs leading-relaxed flex items-start gap-2"
                  role="alert"
                >
                  <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* BOTTOM NAVIGATION LINKS */}
        <div className="pt-2 flex flex-wrap items-center justify-center gap-6 text-xs text-slate-400">
          <Link
            href={
              cardId
                ? '/success-wishes/invitation?card=' +
                  encodeURIComponent(cardId)
                : '/success-wishes/open'
            }
            className="hover:text-[#D4AF37] transition-colors flex items-center space-x-1.5"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back To Your Card</span>
          </Link>
          <span className="text-slate-700">•</span>
          <Link
            href="/success-wishes/recover"
            className="hover:text-[#D4AF37] transition-colors flex items-center space-x-1.5"
          >
            <KeyRound className="w-3.5 h-3.5 text-amber-400" />
            <span>Already Have A Recovery Code?</span>
          </Link>
        </div>

      </main>

      {/* FOOTER */}
      <footer className="max-w-6xl w-full mx-auto px-4 sm:px-8 py-6 border-t border-[#D4AF37]/15 text-center text-xs text-slate-500 relative z-10">
        VibeSchool Receiver Protocol · Receiver Verification Portal
      </footer>

    </div>
  )
}
