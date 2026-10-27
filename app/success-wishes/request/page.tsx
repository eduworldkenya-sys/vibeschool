'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  Crown,
  Send,
  Sparkles,
  MessageSquare,
  Share2,
  Copy,
  Check,
  ArrowLeft,
  Loader2,
  ShieldCheck,
  Heart,
  Phone
} from 'lucide-react'

const API = '/api/success-wishes/receiver/request'

type Invite = {
  id: string
  phone: string
  url: string
  expiresInDays: number
}

export default function AskForWish() {
  const [phone, setPhone] = useState('')
  const [relation, setRelation] = useState('Parent / Guardian')
  const [note, setNote] = useState(
    "Hello! I'm preparing for my exams. Your encouragement would mean so much to me. Would you send me a VibeSchool Success Wish?"
  )
  const [invite, setInvite] = useState<Invite | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [copied, setCopied] = useState(false)

  async function makeRequest(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      const r = await fetch(API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone })
      })
      const p = await r.json()
      if (!r.ok) throw new Error(p.error || 'Could not create an invitation.')
      setInvite(p as Invite)
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Could not create this request.'
      )
    } finally {
      setBusy(false)
    }
  }

  const message = invite ? `${note}\n\nSend your wish here: ${invite.url}` : ''
  const whatsapp = invite
    ? `https://wa.me/${invite.phone.replace(/\D/g, '')}?text=${encodeURIComponent(
        message
      )}`
    : ''
  const sms = invite
    ? `sms:${invite.phone}?body=${encodeURIComponent(message)}`
    : ''

  function copyToClipboard() {
    if (invite && navigator.clipboard) {
      navigator.clipboard.writeText(invite.url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    }
  }

  return (
    <div className="min-h-screen bg-[#0A0D14] text-slate-200 antialiased selection:bg-[#D4AF37] selection:text-black flex flex-col justify-between relative overflow-x-hidden">
      
      {/* BACKGROUND GLOWS */}
      <div className="absolute top-0 right-1/4 w-96 h-96 bg-[#D4AF37]/10 rounded-full blur-3xl pointer-events-none"></div>
      <div className="absolute bottom-10 left-10 w-96 h-96 bg-[#00A896]/10 rounded-full blur-3xl pointer-events-none"></div>

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
          Ask For A Wish
        </span>
      </header>

      {/* MAIN CONTAINER */}
      <main className="max-w-2xl w-full mx-auto px-4 sm:px-6 py-8 sm:py-12 flex-1 flex flex-col justify-center space-y-6 relative z-10">
        
        {/* HERO TITLE */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-[#D4AF37]/15 border border-[#D4AF37]/30 text-[#D4AF37] text-[10px] font-bold uppercase tracking-wider mb-1">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Encouragement Link Generator</span>
          </div>
          <h1 className="font-cinzel text-3xl sm:text-4xl font-extrabold bg-gradient-to-r from-[#FFF5C0] via-[#D4AF37] to-[#AA7C11] bg-clip-text text-transparent">
            Ask Someone Special.
          </h1>
          <p className="text-xs sm:text-sm text-slate-400">
            Free to create and send request. KSh 50 for them to send a text wish.
          </p>
        </div>

        {/* INPUT FORM PANEL */}
        <div className="glass-panel rounded-3xl p-6 sm:p-8 border border-[#D4AF37]/30 shadow-2xl space-y-6">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <h2 className="font-cinzel text-base font-bold text-slate-100 flex items-center gap-2">
              <Heart className="w-4 h-4 text-[#A51C30]" />
              <span>Who would you like to invite?</span>
            </h2>
            <ShieldCheck className="w-4 h-4 text-[#00A896]" />
          </div>

          <form onSubmit={makeRequest} className="space-y-4">
            
            {/* Relationship Field */}
            <div className="space-y-1.5">
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                Their Relationship To You
              </label>
              <select
                value={relation}
                onChange={(e) => setRelation(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 focus:border-[#D4AF37] rounded-xl px-3.5 py-3 text-xs text-slate-200 focus:outline-none transition-colors"
              >
                <option value="Parent / Guardian">Parent / Guardian</option>
                <option value="Relative">Relative</option>
                <option value="Teacher / Mentor">Teacher / Mentor</option>
                <option value="Friend">Friend</option>
              </select>
            </div>

            {/* Phone Number Field */}
            <div className="space-y-1.5">
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                Their Kenyan Phone Number
              </label>
              <div className="relative">
                <Phone className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  type="tel"
                  inputMode="tel"
                  autoComplete="off"
                  placeholder="0712 345 678"
                  required
                  value={phone}
                  onChange={(e) => {
                    setPhone(e.target.value)
                    setInvite(null)
                  }}
                  className="w-full bg-slate-900 border border-slate-800 focus:border-[#D4AF37] rounded-xl pl-10 pr-3.5 py-3 text-xs text-slate-200 focus:outline-none transition-colors placeholder:text-slate-600"
                />
              </div>
            </div>

            {/* Note Textarea */}
            <div className="space-y-1.5">
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                Your Invitation Message
              </label>
              <textarea
                maxLength={600}
                rows={4}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 focus:border-[#D4AF37] rounded-xl p-3.5 text-xs text-slate-200 focus:outline-none transition-colors resize-none leading-relaxed"
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
              disabled={busy || !phone.trim()}
              className="w-full py-3.5 rounded-xl bg-gradient-to-r from-[#D4AF37] to-[#AA7C11] text-slate-950 font-bold text-xs sm:text-sm shadow-lg shadow-[#D4AF37]/20 hover:brightness-110 active:scale-95 disabled:opacity-50 disabled:pointer-events-none transition-all flex items-center justify-center space-x-2"
            >
              {busy ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-slate-950" />
                  <span>Creating Invitation...</span>
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  <span>Create My Invitation</span>
                </>
              )}
            </button>
          </form>
        </div>

        {/* INVITATION GENERATED RESULT PANEL */}
        {invite && (
          <div
            className="glass-panel rounded-3xl p-6 sm:p-8 border-2 border-[#00A896]/50 shadow-2xl space-y-5 animate-in fade-in slide-in-from-bottom-4 duration-500"
            aria-live="polite"
          >
            <div className="flex items-center space-x-3 pb-3 border-b border-slate-800">
              <div className="w-10 h-10 rounded-2xl bg-[#00A896]/20 border border-[#00A896]/40 text-[#00A896] flex items-center justify-center">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <h2 className="font-cinzel text-base font-bold text-slate-100">
                  Your Invitation Is Ready
                </h2>
                <p className="text-xs text-slate-400">
                  Share with your {relation.toLowerCase()}. Link valid for{' '}
                  <span className="text-[#00A896] font-semibold">
                    {invite.expiresInDays} days
                  </span>
                  .
                </p>
              </div>
            </div>

            {/* Action Deep-Links */}
            <div className="flex flex-col sm:flex-row gap-3 pt-1">
              <a
                href={whatsapp}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 py-3 px-4 rounded-xl bg-[#25D366] text-slate-950 font-bold text-xs hover:brightness-110 active:scale-95 transition-all flex items-center justify-center space-x-2 shadow-md shadow-[#25D366]/20"
              >
                <MessageSquare className="w-4 h-4 fill-current" />
                <span>Share on WhatsApp</span>
              </a>

              <a
                href={sms}
                className="flex-1 py-3 px-4 rounded-xl bg-slate-900 border border-slate-800 hover:border-[#D4AF37]/40 text-slate-200 font-bold text-xs active:scale-95 transition-all flex items-center justify-center space-x-2"
              >
                <Share2 className="w-4 h-4 text-[#D4AF37]" />
                <span>Share by SMS</span>
              </a>

              <button
                type="button"
                onClick={copyToClipboard}
                className="py-3 px-4 rounded-xl bg-slate-900 border border-slate-800 hover:border-[#00A896]/40 text-slate-200 font-bold text-xs active:scale-95 transition-all flex items-center justify-center space-x-2"
              >
                {copied ? (
                  <>
                    <Check className="w-4 h-4 text-[#00A896]" />
                    <span className="text-[#00A896]">Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4 text-[#00A896]" />
                    <span>Copy Link</span>
                  </>
                )}
              </button>
            </div>

            <p className="text-[10px] text-slate-500 leading-relaxed pt-2 border-t border-slate-800/80">
              Note: Your carrier may charge standard SMS rates. VibeSchool does not transmit this invite automatically—use the buttons above to share.
            </p>
          </div>
        )}

        {/* BOTTOM RETURN NAVIGATION */}
        <div className="pt-4 text-center">
          <Link
            href="/success-wishes/inbox"
            className="inline-flex items-center space-x-2 text-xs font-semibold text-slate-400 hover:text-[#D4AF37] transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to My Wishes Vault</span>
          </Link>
        </div>

      </main>

      {/* FOOTER */}
      <footer className="max-w-6xl w-full mx-auto px-4 sm:px-8 py-6 border-t border-[#D4AF37]/15 text-center text-xs text-slate-500 relative z-10">
        VibeSchool Receiver Protocol · Request Wish Gateway
      </footer>

    </div>
  )
}
