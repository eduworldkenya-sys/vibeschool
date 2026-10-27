import type { Metadata } from 'next'
import Link from 'next/link'
import SuccessCardStudio from '@/components/success-wishes/SuccessCardStudio'
import { Crown, Sparkles, ShieldCheck, ArrowLeft, MailOpen } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Success Wishes | VibeSchool',
  description: 'Choose a Success Wishes design and version, personalise a wish, and preview it before checkout.',
}

export default function SuccessWishesPage() {
  const isTestMode =
    process.env.NODE_ENV === 'development' &&
    process.env.VIBESCHOOL_SUCCESS_WISHES_TEST_MODE === '1'

  return (
    <div className="min-h-screen bg-[#0A0D14] text-slate-200 antialiased selection:bg-[#D4AF37] selection:text-black flex flex-col relative overflow-x-hidden">
      
      {/* BACKGROUND GLOW ACCENTS */}
      <div className="absolute top-0 right-1/4 w-96 h-96 bg-[#D4AF37]/10 rounded-full blur-3xl pointer-events-none"></div>
      <div className="absolute bottom-1/4 left-10 w-96 h-96 bg-[#00A896]/10 rounded-full blur-3xl pointer-events-none"></div>

      {/* TOP HEADER NAVIGATION */}
      <header className="sticky top-0 z-40 bg-[#0A0D14]/88 backdrop-blur-md border-b border-[#D4AF37]/20 px-4 sm:px-8 py-3.5 flex items-center justify-between shadow-lg">
        <div className="flex items-center space-x-3">
          <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-[#D4AF37] via-[#00A896] to-[#800020] p-0.5 shadow-md shadow-[#D4AF37]/20">
            <div className="w-full h-full bg-[#0A0D14] rounded-full flex items-center justify-center">
              <Crown className="w-4 h-4 text-[#D4AF37]" />
            </div>
          </div>
          <div>
            <h1 className="font-cinzel text-xs sm:text-sm font-bold bg-gradient-to-r from-[#FFF5C0] via-[#D4AF37] to-[#AA7C11] bg-clip-text text-transparent tracking-wider">
              VIBESCHOOL
            </h1>
            <p className="text-[9px] text-slate-400 font-medium tracking-widest uppercase">
              Success Wishes Studio
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <Link
            href="/success-wishes/inbox"
            className="inline-flex items-center space-x-1.5 text-xs font-semibold text-slate-300 hover:text-[#D4AF37] px-3.5 py-2 rounded-xl bg-slate-900/80 border border-slate-800 hover:border-[#D4AF37]/40 active:scale-95 transition-all shadow-sm"
          >
            <MailOpen className="w-4 h-4 text-[#00A896]" />
            <span className="hidden sm:inline">My Vault Inbox</span>
          </Link>
        </div>
      </header>

      {/* MAIN STUDIO CONTAINER */}
      <main className="flex-1 max-w-6xl w-full mx-auto p-4 sm:p-6 md:p-8 space-y-6 relative z-10">
        
        {/* Studio Hero Banner */}
        <div className="text-center max-w-2xl mx-auto space-y-2 py-4">
          <div className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-[#D4AF37]/15 border border-[#D4AF37]/30 text-[#D4AF37] text-[10px] font-bold uppercase tracking-wider mb-1">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Grand Envelope Creator</span>
          </div>
          <h2 className="font-cinzel text-2xl sm:text-3xl font-extrabold bg-gradient-to-r from-[#FFF5C0] via-[#D4AF37] to-[#AA7C11] bg-clip-text text-transparent">
            Craft an Unforgettable Blessing
          </h2>
          <p className="text-xs sm:text-sm text-slate-400">
            Choose your theme and wax seal, personalise your keepsake message or voice note, and preview your encrypted card before sending.
          </p>
        </div>

        {/* Development Test Mode Badge (If active) */}
        {isTestMode && (
          <div className="flex items-center justify-center">
            <span className="px-3 py-1 rounded-lg bg-amber-500/20 border border-amber-500/40 text-amber-300 text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5" /> Test Mode Enabled
            </span>
          </div>
        )}

        {/* The Card Studio Component */}
        <div className="glass-panel rounded-3xl p-4 sm:p-6 md:p-8 border border-[#D4AF37]/30 shadow-2xl relative overflow-hidden">
          <SuccessCardStudio testMode={isTestMode} />
        </div>

        {/* Footer Navigation Back Links */}
        <div className="pt-6 border-t border-slate-800/80 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-400 gap-4">
          <Link
            href="/success-wishes"
            className="inline-flex items-center space-x-2 text-slate-300 hover:text-[#D4AF37] transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Return to Success Wishes Home</span>
          </Link>
          <div className="flex items-center space-x-4">
            <span className="text-[10px] text-slate-500">VibeSchool Security Protocol · v3.2</span>
          </div>
        </div>

      </main>
    </div>
  )
}
