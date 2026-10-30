'use client'
import { usePathname } from 'next/navigation'
import { useEffect } from 'react'
export default function VisitorTracker() {
  const pathname = usePathname()
  useEffect(() => {
    if (!pathname || pathname.startsWith('/hq') || pathname.startsWith('/api')) return
    try {
      let visitor = localStorage.getItem('vibeschool-anonymous-visitor')
      if (!visitor || !/^[0-9a-f-]{36}$/i.test(visitor)) {
        visitor = crypto.randomUUID()
        localStorage.setItem('vibeschool-anonymous-visitor', visitor)
      }
      void fetch('/api/hq/visitors', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ visitor, path: pathname }), keepalive: true, credentials: 'same-origin' }).catch(() => {})
    } catch { /* Tracking must never interrupt navigation. */ }
  }, [pathname])
  return null
}
