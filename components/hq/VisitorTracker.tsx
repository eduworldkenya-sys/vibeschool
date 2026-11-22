'use client'

import { usePathname } from 'next/navigation'
import { useEffect, useRef } from 'react'
import { normalizeTrafficPagePath } from '@/lib/hq/traffic-policy'

/** Count client-side navigations on public, learner, teacher, parent and HQ pages. */
export default function VisitorTracker() {
  const pathname = usePathname()
  const previousPath = useRef<string | null>(null)

  useEffect(() => {
    const path = normalizeTrafficPagePath(pathname)
    if (!path || previousPath.current === path) return

    const isInternalNavigation = previousPath.current !== null
    previousPath.current = path

    try {
      let visitor = localStorage.getItem('vibeschool-anonymous-visitor')
      if (!visitor || !/^[0-9a-f-]{36}$/i.test(visitor)) {
        visitor = crypto.randomUUID()
        localStorage.setItem('vibeschool-anonymous-visitor', visitor)
      }
      const referrer = isInternalNavigation ? 'Internal' : (() => {
        try {
          const url = new URL(document.referrer)
          if (url.hostname === location.hostname || (url.hostname.endsWith('.vibeschool.co.ke') && location.hostname.endsWith('.vibeschool.co.ke'))) return 'Internal'
          return url.hostname
        } catch { return 'Direct' }
      })()

      void fetch('/api/hq/visitors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ visitor, path, referrer }),
        keepalive: true,
        credentials: 'same-origin',
      }).then(response => {
        if (!response.ok) console.warn('Anonymous visitor tracking unavailable:', response.status)
      }).catch(() => { /* Visits must never interrupt navigation. */ })
    } catch { /* Browser storage and tracking must never interrupt navigation. */ }
  }, [pathname])

  return null
}
