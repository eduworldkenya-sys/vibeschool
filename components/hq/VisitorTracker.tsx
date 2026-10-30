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
      const referrer = (() => { try { const url = new URL(document.referrer); return url.hostname === location.hostname ? 'Internal' : url.hostname } catch { return 'Direct' } })()
      void fetch('/api/hq/visitors', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ visitor, path: pathname, referrer }), keepalive: true, credentials: 'same-origin' }).then(response => { if (!response.ok) console.warn('Anonymous visitor tracking unavailable:', response.status) }).catch(() => {})
    } catch { /* Tracking must never interrupt navigation. */ }
  }, [pathname])
  return null
}
