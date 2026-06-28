"use client";
'use client'

import { useEffect, useState } from 'react'

export default function OfflineBar() {
  const [offline, setOffline] = useState(false)

  useEffect(() => {
    let probeTimer: ReturnType<typeof setTimeout> | null = null

    async function probe() {
      if (!navigator.onLine) { setOffline(true); return; }
      try {
        await fetch('/api/ping', { method: 'HEAD', signal: AbortSignal.timeout(4000), cache: 'no-store' })
        setOffline(false)
      } catch {
        setOffline(true)
      }
    }

    probe()
    probeTimer = setInterval(probe, 30000)

    const on  = () => probe()
    const off = () => setOffline(true)
    window.addEventListener('online',  on)
    window.addEventListener('offline', off)
    return () => {
      window.removeEventListener('online',  on)
      window.removeEventListener('offline', off)
      if (probeTimer) clearInterval(probeTimer)
    }
  }, [])

  if (!offline) return null

  return (
    <div style={{
      background: '#ef4444', color: '#fff',
      textAlign: 'center', padding: '8px 16px',
      fontSize: 12, fontWeight: 700,
      fontFamily: 'Plus Jakarta Sans, sans-serif',
      position: 'sticky', top: 56, zIndex: 599,
    }}>
      ⚠ You are offline or connection is too slow. Data may not be current.
    </div>
  )
}
