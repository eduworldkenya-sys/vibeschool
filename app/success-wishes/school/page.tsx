import type { Metadata } from 'next'
import Link from 'next/link'
import { Crown, School, ShieldCheck, ArrowLeft } from 'lucide-react'
import SchoolAccess from '@/components/success-wishes/SchoolAccess'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = {
  title: 'School access · Success Wishes',
  robots: { index: false, follow: false },
  referrer: 'no-referrer'
}

export default function SchoolAccessPage() {
  return (
    <div className="min-h-screen bg-[#0A0D14] text-slate-200 antialiased selection:bg-[#D4AF37] selection:text-black flex flex-col justify-between relative overflow-x-hidden">
      
      {/* BACKGROUND GLOW ACCENTS */}
      <div className="fixed top-0 right-1/4 w-96 h-96 bg-[#D4AF37]/10 rounded-full blur-3xl pointer-events-none z-0"></div>
      <div className="fixed bottom-10 left-10 w-96 h-96 bg-[#00A896]/10 rounded-full blur-3xl pointer-events-none z-0"></div>

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
        <span className="text-xs text-slate-400 font-medium tracking-wide flex items-center gap-1.5">
          <ShieldCheck className="w-3.5 h-3.5 text-[#00A896]" />
          <span>School Verification Portal</span>
        </span>
      </header>

      {/* MAIN CONTAINER WRAPPER */}
      <main className="max-w-3xl w-full mx-auto px-4 sm:px-6 py-8 sm:py-12 flex-1 flex flex-col justify-center space-y-6 relative z-10">
        
        {/* HERO TITLE BANNER */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-[#D4AF37]/15 border border-[#D4AF37]/30 text-[#D4AF37] text-[10px] font-bold uppercase tracking-wider mb-1">
            <School className="w-3.5 h-3.5 text-[#D4AF37]" />
            <span>Institutional Access</span>
          </div>
          <h1 className="font-cinzel text-3xl sm:text-4xl font-extrabold bg-gradient-to-r from-[#FFF5C0] via-[#D4AF37] to-[#AA7C11] bg-clip-text text-transparent">
            Authorised School Portal
          </h1>
          <p className="text-xs sm:text-sm text-slate-400">
            Access school administration controls, student candidate registers, and consent verification workflows.
          </p>
        </div>

        {/* SCHOOL ACCESS COMPONENT PANEL */}
        <div className="glass-panel rounded-3xl p-6 sm:p-8 border border-[#D4AF37]/30 shadow-2xl relative overflow-hidden">
          <SchoolAccess />
        </div>

        {/* BOTTOM RETURN NAVIGATION */}
        <div className="pt-2 text-center">
          <Link
            href="/success-wishes"
            className="inline-flex items-center space-x-2 text-xs font-semibold text-slate-400 hover:text-[#D4AF37] transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Return to Success Wishes Home</span>
          </Link>
        </div>

      </main>

      {/* FOOTER */}
      <footer className="max-w-6xl w-full mx-auto px-4 sm:px-8 py-6 border-t border-[#D4AF37]/15 text-center text-xs text-slate-500 relative z-10">
        VibeSchool Receiver Protocol · Institutional Portal Access
      </footer>

    </div>
  )
}
