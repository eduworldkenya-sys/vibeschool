import { notFound } from 'next/navigation'
import type { ReactNode } from 'react'
import { POST_SECONDARY_PUBLIC_ENABLED } from '@/lib/learner/learning-levels'

export default function CollegeLayout({children}:{children:ReactNode}) {
  if (!POST_SECONDARY_PUBLIC_ENABLED) notFound()
  return <>{children}</>
}
