import { Suspense, type ReactNode } from 'react'

export default function StudentSignupLayout({ children }: { children: ReactNode }) {
  return <Suspense fallback={null}>{children}</Suspense>
}
