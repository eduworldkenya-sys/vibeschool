"use client";
'use client'

import { useEffect, useState } from 'react'

export default function OfflineBar() {
  const [offline, setOffline] = useState(false)

  useEffect(() => {
    setOffline(!navigator.onLine)
    const on  = () => setOffline(false)
    const off = () => setOffline(true)
    window.addEventListener('online',  on)
    window.addEventListener('offline', off)
    return () => {
      window.removeEventListener('online',  on)
      window.removeEventListener('offline', off)
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
      ⚠ You are offline. Data may not be current.
    </div>
  )
}