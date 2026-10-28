'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  Crown,
  KeyRound,
  ShieldCheck,
  ArrowRight,
  Sparkles,
  HelpCircle,
  Gift,
  Lock,
  Loader2
} from 'lucide-react'

export default function OpenSuccessWishCode() {
  const router = useRouter()
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function claim(event: React.FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      const r = await fetch('/api/success-wishes/receiver/card', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        cache: 'no-store',
        body: JSON.stringify({ code: code.trim().toUpperCase() })
      })
      const data = await r.json()
      if (!r.ok) throw new Error(data.error || 'The card access code is invalid.')
      router.push('/success-wishes/invitation?card=' + data.card.id)
    } catch (e) {
      setError(
        e instanceof Error ? e.message : 'Unable to open this private card.'
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="min-h-0 bg-[#0A0D14] text-slate-200 antialiased selection:bg-[#D4AF37] selection:text-black flex flex-col justify-between relative overflow-x-hidden">

      {/* BACKGROUND AMBIENT GLOWS */}
      <div className="absolute top-0 right-1/3 w-96 h-96 bg-[#D4AF37]/10 rounded-full blur-3xl pointer-events-none"></div>
      <div className="absolute bottom-10 left-10 w-96 h-96 bg-[#00A896]/10 rounded-full blur-3xl pointer-events-none"></div>

      {/* TOP HEADER */}


      {/* MAIN CONTENT WRAPPER */}
      <main className="max-w-4xl w-full mx-auto px-4 sm:px-6 py-8 sm:py-12 flex-1 flex flex-col justify-center space-y-8 relative z-10">

        {/* HERO TITLE BANNER */}
        <div className="text-center max-w-xl mx-auto space-y-2">
          <div className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-[#D4AF37]/15 border border-[#D4AF37]/30 text-[#D4AF37] text-[10px] font-bold uppercase tracking-wider mb-1">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Private Envelope Access</span>
          </div>
          <h1 className="font-cinzel text-3xl sm:text-4xl font-extrabold bg-gradient-to-r from-[#FFF5C0] via-[#D4AF37] to-[#AA7C11] bg-clip-text text-transparent">
            A Wish Is Waiting.
          </h1>
          <p className="text-xs sm:text-sm text-slate-400">
            Enter the private card access code you received to open your wish.
          </p>
        </div>

        {/* TWO-COLUMN DISPLAY GRID */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">

          {/* LEFT: DECORATIVE KEEPSAKE PREVIEW CARD */}
          <div className="glass-panel rounded-3xl p-8 border-2 border-[#D4AF37]/40 shadow-2xl relative overflow-hidden flex flex-col items-center justify-center text-center min-h-[300px] group">
            <div className="absolute top-0 right-0 w-32 h-32 bg-[#D4AF37]/10 rounded-full blur-2xl pointer-events-none"></div>
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-[#D4AF37] via-[#00A896] to-[#800020] p-0.5 shadow-xl mb-4 group-hover:scale-110 transition-transform duration-300">
              <div className="w-full h-full bg-[#0A0D14] rounded-2xl flex items-center justify-center">
                <Gift className="w-8 h-8 text-[#D4AF37]" />
              </div>
            </div>
            <h3 className="font-cinzel text-lg font-bold text-slate-100">
              Your Private Gift
            </h3>
            <p className="text-xs text-slate-400 mt-1 max-w-xs">
              A little encouragement, wrapped in a digital wax seal, waiting to be revealed.
            </p>
            <div className="mt-6 inline-flex items-center space-x-1.5 text-[10px] text-[#00A896] font-semibold bg-[#00A896]/10 px-3 py-1.5 rounded-full border border-[#00A896]/30">
              <ShieldCheck className="w-3 h-3" />
              <span>Private access</span>
            </div>
          </div>

          {/* RIGHT: CODE INPUT FORM PANEL */}
          <div className="glass-panel rounded-3xl p-6 sm:p-8 border border-[#D4AF37]/30 shadow-2xl space-y-6">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h2 className="font-cinzel text-base font-bold text-slate-100 flex items-center gap-2">
                <KeyRound className="w-4 h-4 text-[#D4AF37]" />
                <span>Open a wish</span>
              </h2>
              <Lock className="w-4 h-4 text-slate-500" />
            </div>

            <form onSubmit={claim} className="space-y-4">
              <div className="space-y-2">
                <label htmlFor="open-field-1" className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  Card Access Code
                </label>
                <input id="open-field-1"
                  type="text"
                  autoComplete="off"
                  maxLength={40}
                  required
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="Paste your card access code..."
                  className="w-full bg-slate-900/90 border border-slate-800 focus:border-[#D4AF37] rounded-xl px-4 py-3 text-sm text-[#D4AF37] font-mono tracking-wider focus:outline-none transition-colors placeholder:text-slate-600 placeholder:font-sans"
                />
              </div>

              {error && (
                <div
                  className="p-3.5 rounded-xl bg-red-950/50 border border-red-800/60 text-red-300 text-xs leading-relaxed"
                  role="alert"
                >
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={busy || !code.trim()}
                className="w-full py-3.5 rounded-xl bg-gradient-to-r from-[#D4AF37] to-[#AA7C11] text-slate-950 font-bold text-sm shadow-lg shadow-[#D4AF37]/20 hover:brightness-110 active:scale-95 disabled:opacity-50 disabled:pointer-events-none transition-all flex items-center justify-center space-x-2"
              >
                {busy ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-slate-950" />
                    <span>Checking Code...</span>
                  </>
                ) : (
                  <>
                    <span>Open my wish</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>

            {/* EXPANDABLE HELP SECTION */}
            <details className="pt-2 border-t border-slate-800/80 group text-xs text-slate-400">
              <summary className="cursor-pointer font-semibold text-slate-300 hover:text-[#D4AF37] flex items-center space-x-2 py-1 transition-colors select-none">
                <HelpCircle className="w-3.5 h-3.5 text-[#D4AF37]" />
                <span>Where is my code?</span>
              </summary>
              <p className="mt-2 text-slate-400 text-[11px] leading-relaxed pl-5">
                Use the card access code provided in your SMS or shared directly by the sender. It grants single-card access; to view your all your wishes, verify your phone number separately.
              </p>
            </details>
          </div>

        </div>

        {/* BOTTOM RECOVERY LINKS */}
        <div className="pt-6 border-t border-slate-800/80 flex flex-wrap items-center justify-center gap-6 text-xs text-slate-400">
          <Link
            href="/success-wishes/recover"
            className="hover:text-[#D4AF37] transition-colors flex items-center space-x-1.5"
          >
            <KeyRound className="w-3.5 h-3.5 text-amber-400" />
            <span>Recover access</span>
          </Link>
          <span className="text-slate-700">•</span>
          <Link
            href="/success-wishes/demo"
            className="hover:text-[#D4AF37] transition-colors"
          >
            View sample inbox
          </Link>
        </div>

      </main>

      {/* FOOTER */}


    </div>
  )
}
