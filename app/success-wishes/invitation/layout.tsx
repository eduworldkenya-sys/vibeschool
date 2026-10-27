import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Private Success Wish | VibeSchool',
  robots: { index: false, follow: false, nocache: true },
}

export default function SuccessWishInvitationLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-[#0A0D14] text-slate-200 antialiased selection:bg-[#D4AF37] selection:text-black relative overflow-x-hidden">
      
      {/* AMBIENT BACKGROUND GLOW ACCENTS */}
      <div className="fixed top-0 right-1/4 w-96 h-96 bg-[#D4AF37]/10 rounded-full blur-3xl pointer-events-none z-0"></div>
      <div className="fixed bottom-1/4 left-10 w-96 h-96 bg-[#00A896]/10 rounded-full blur-3xl pointer-events-none z-0"></div>
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-[#800020]/10 rounded-full blur-3xl pointer-events-none z-0"></div>

      {/* RENDER CHILD PAGES (UNBOXING, CODE CLAIM, INVITATIONS) */}
      <div className="relative z-10 flex flex-col min-h-screen">
        {children}
      </div>

    </div>
  )
}
