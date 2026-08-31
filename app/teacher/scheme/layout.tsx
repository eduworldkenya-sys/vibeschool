import type { ReactNode } from 'react'
import { SchemeCanonicalGuard } from './SchemeCanonicalGuard'

export default function SchemeLayout({ children }: { children: ReactNode }) {
  return <SchemeCanonicalGuard>{children}</SchemeCanonicalGuard>
}
