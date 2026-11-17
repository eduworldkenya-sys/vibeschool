import { notFound } from 'next/navigation'
import type { ReactNode } from 'react'
import { POST_SECONDARY_PUBLIC_ENABLED } from '@/lib/learner/learning-levels'

/** All legacy academy course and topic pages inherit the same fail-closed gate. */
export default function AcademyCourseLayout({children}:{children:ReactNode}) {
  if (!POST_SECONDARY_PUBLIC_ENABLED) notFound()
  return <>{children}</>
}
