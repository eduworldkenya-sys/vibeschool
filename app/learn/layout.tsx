import type { ReactNode } from 'react'
import { LearnRouteShell } from '@/components/learn/LearnNavigation'

/** Reuse VibeSchool navigation across discovery without wrapping focused readers. */
export default function LearnLayout({ children }: { children: ReactNode }) {
  return <LearnRouteShell>{children}</LearnRouteShell>
}
