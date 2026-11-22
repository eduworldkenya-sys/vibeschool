import type { ReactNode } from 'react'
import './theme.css'

export default function ContentStudioLayout({ children }: { children: ReactNode }) {
  return <div className="teacher-content-studio">{children}</div>
}
