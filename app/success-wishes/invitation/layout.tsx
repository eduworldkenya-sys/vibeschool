import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Private Success Wish | VibeSchool',
  robots: { index: false, follow: false, nocache: true },
}

export default function SuccessWishInvitationLayout({ children }: { children: React.ReactNode }) {
  return children
}
