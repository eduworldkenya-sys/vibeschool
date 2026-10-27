'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import {
  Crown,
  Heart,
  Sparkles,
  ShieldCheck,
  AlertTriangle,
  ArrowRight,
  Loader2,
  School,
  Lock
} from 'lucide-react'

type Invite = { candidate: string; school: string; requestId: string }

export default function WishInvitePage() {
  const [invite, setInvite] = useState<Invite | null>(null)
  const [token, setToken] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    const raw =
      new URLSearchParams(window.location.hash.slice(1)).get('token') || ''
    window.history.replaceState(null, '', window.location.pathname)

    if (!/^[0-9a-f]{64}$/.test(raw)) {
      setError('This request link is missing or invalid.')
      return
    }

    setToken(raw)
    fetch('/api/success-wishes/receiver/request', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: raw }),
      cache: 'no-store'
    })
      .then(async (response) => {
        const payload = await response.json()
        if (!response.ok) {
          throw new Error(payload.error || 'This request is unavailable.')
        }
        return payload
      })
      .then((payload) => {
        if (active) setInvite(payload)
      })
      .catch((e) => {
        if (active) setError(e.message)
      })

    return () => {
      active = false
    }
  }, [])

  return (
    <div className="min-h-0 bg-[#0A0D14] text-slate-200 antialiased selection:bg-[#D4AF37] selection:text-black flex flex-col justify-between relative overflow-x-hidden">

      {/* BACKGROUND GLOW ACCENTS */}
      <div className="absolute top-0 right-1/4 w-96 h-96 bg-[#D4AF37]/10 rounded-full blur-3xl pointer-events-none"></div>
      <div className="absolute bottom-10 left-10 w-96 h-96 bg-[#800020]/20 rounded-full blur-3xl pointer-events-none"></div>

      {/* TOP HEADER */}


      {/* MAIN CONTAINER */}
      <main className="max-w-2xl w-full mx-auto px-4 sm:px-6 py-8 sm:py-12 flex-1 flex flex-col justify-center space-y-6 relative z-10">

        {/* HERO TITLE BANNER */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-[#D4AF37]/15 border border-[#D4AF37]/30 text-[#D4AF37] text-[10px] font-bold uppercase tracking-wider mb-1">
            <Heart className="w-3.5 h-3.5 fill-current text-[#A51C30]" />
            <span>Someone Is Thinking Of You</span>
          </div>
          <h1 className="font-cinzel text-3xl sm:text-4xl font-extrabold bg-gradient-to-r from-[#FFF5C0] via-[#D4AF37] to-[#AA7C11] bg-clip-text text-transparent">
            A little encouragement can mean a lot.
          </h1>
          <p className="text-xs sm:text-sm text-slate-400">
            You have been invited to send a meaningful, private Success Wish.
          </p>
        </div>

        {/* ERROR STATE */}
        {error && (
          <div
            className="glass-panel rounded-3xl p-6 sm:p-8 border border-red-500/40 text-center space-y-4"
            role="alert"
          >
            <div className="w-12 h-12 rounded-2xl bg-red-950/60 border border-red-800/60 text-red-400 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <h2 className="font-cinzel text-lg font-bold text-slate-100">
              Invitation Unavailable
            </h2>
            <p className="text-xs sm:text-sm text-red-300 max-w-md mx-auto leading-relaxed">
              {error}
            </p>
            <div className="pt-2">
              <Link
                href="/success-wishes"
                className="inline-flex items-center space-x-2 px-5 py-2.5 rounded-xl bg-slate-900 border border-slate-800 hover:border-[#D4AF37]/40 text-slate-200 font-semibold text-xs active:scale-95 transition-all"
              >
                <span>Explore Success Wishes</span>
              </Link>
            </div>
          </div>
        )}

        {/* LOADING STATE */}
        {!error && !invite && (
          <div
            className="glass-panel rounded-3xl p-8 sm:p-12 text-center text-slate-400 text-xs sm:text-sm flex items-center justify-center space-x-2 border border-[#D4AF37]/30 animate-pulse"
            role="status"
          >
            <Loader2 className="w-4 h-4 animate-spin text-[#D4AF37]" />
            <span>Checking your private request…</span>
          </div>
        )}

        {/* INVITE LOADED STATE */}
        {invite && (
          <div className="glass-panel rounded-3xl p-6 sm:p-8 border-2 border-[#D4AF37]/40 shadow-2xl space-y-6">

            {/* Candidate Header */}
            <div className="flex items-start space-x-4 pb-4 border-b border-slate-800">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-[#D4AF37] via-[#00A896] to-[#800020] p-0.5 shadow-lg shrink-0">
                <div className="w-full h-full bg-[#0A0D14] rounded-2xl flex items-center justify-center font-bold text-sm text-[#D4AF37]">
                  {invite.candidate.slice(0, 2).toUpperCase()}
                </div>
              </div>
              <div className="space-y-1">
                <p className="text-[10px] font-extrabold uppercase tracking-widest text-[#D4AF37]">
                  A Request From
                </p>
                <h2 className="font-cinzel text-xl sm:text-2xl font-bold text-slate-100">
                  {invite.candidate}
                </h2>
                {invite.school && (
                  <p className="text-xs text-slate-400 flex items-center gap-1.5">
                    <School className="w-3.5 h-3.5 text-[#00A896]" />
                    <span>{invite.school}</span>
                  </p>
                )}
              </div>
            </div>

            {/* Instruction Body */}
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              Choose one of VibeSchool’s four card designs, add your personal words and review them before paying KSh 50 when checkout is available.
            </p>

            {/* CTA Action */}
            <div className="pt-2">
              <Link
                href={`/success-wishes#request=${token}`}
                className="w-full py-3.5 px-6 rounded-xl bg-gradient-to-r from-[#D4AF37] to-[#AA7C11] text-slate-950 font-bold text-xs sm:text-sm shadow-lg shadow-[#D4AF37]/20 hover:brightness-110 active:scale-95 transition-all flex items-center justify-center space-x-2"
              >
                <Sparkles className="w-4 h-4" />
                <span>Create a Success Wish</span>
                <ArrowRight className="w-4 h-4 ml-1" />
              </Link>
            </div>

            {/* Privacy Disclaimer Footer */}
            <p className="text-[11px] text-slate-500 leading-relaxed pt-3 border-t border-slate-800/80 flex items-start gap-1.5">
              <Lock className="w-3.5 h-3.5 text-slate-500 shrink-0 mt-0.5" />
              <span>
                This request does not give you access to the student’s inbox or other private messages.
              </span>
            </p>

          </div>
        )}

      </main>

      {/* FOOTER */}


    </div>
  )
}
