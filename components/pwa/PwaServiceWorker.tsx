'use client'

import { useEffect, useState } from 'react'

export default function PwaServiceWorker() {
  const [waiting, setWaiting] = useState<ServiceWorker | null>(null)

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return

    let reloading = false
    // A first install can claim an already-open public page. Reloading on that
    // initial controllerchange races accessibility/browser inspection and is not
    // needed: the page already contains the current application. Only reload when
    // this tab was controlled before an explicitly accepted worker update.
    const hadControllerAtMount = Boolean(navigator.serviceWorker.controller)

    const register = async () => {
      try {
        const registration = await navigator.serviceWorker.register('/sw.js', { scope: '/' })

        if (registration.waiting) setWaiting(registration.waiting)

        const watchInstalling = () => {
          const worker = registration.installing
          if (!worker) return
          worker.addEventListener('statechange', () => {
            if (worker.state === 'installed' && navigator.serviceWorker.controller) {
              setWaiting(registration.waiting ?? worker)
            }
          })
        }

        registration.addEventListener('updatefound', watchInstalling)
      } catch (error) {
        console.error('VibeSchool service worker registration failed', error)
      }
    }

    const handleControllerChange = () => {
      if (!hadControllerAtMount || reloading) return
      reloading = true
      window.location.reload()
    }

    navigator.serviceWorker.addEventListener('controllerchange', handleControllerChange)
    window.addEventListener('load', register, { once: true })

    if (document.readyState === 'complete') void register()

    return () => {
      navigator.serviceWorker.removeEventListener('controllerchange', handleControllerChange)
      window.removeEventListener('load', register)
    }
  }, [])

  if (!waiting) return null

  const update = () => {
    waiting.postMessage({ type: 'SKIP_WAITING' })
  }

  return (
    <aside
      role="status"
      aria-live="polite"
      style={{
        position: 'fixed',
        left: 'max(14px, env(safe-area-inset-left))',
        right: 'max(14px, env(safe-area-inset-right))',
        top: 'max(14px, env(safe-area-inset-top))',
        zIndex: 10000,
        maxWidth: '440px',
        margin: '0 auto',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        padding: '12px 14px',
        borderRadius: '18px',
        border: '1px solid rgba(255,255,255,0.12)',
        background: 'rgba(7,11,31,0.96)',
        color: '#fff',
        boxShadow: '0 16px 48px rgba(0,0,0,0.4)',
        backdropFilter: 'blur(16px)',
      }}
    >
      <img src="/icons/icon-192.svg" alt="" width={38} height={38} style={{ borderRadius: '11px' }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 800, fontSize: '13px' }}>VibeSchool update ready</div>
        <div style={{ marginTop: '2px', fontSize: '11px', color: 'rgba(255,255,255,0.65)' }}>
          Refresh when you are ready to use the latest version.
        </div>
      </div>
      <button
        type="button"
        onClick={update}
        style={{
          border: 0,
          borderRadius: '12px',
          padding: '9px 11px',
          background: 'linear-gradient(90deg, #7C3CFF, #F2168C)',
          color: '#fff',
          fontWeight: 800,
          fontSize: '11px',
          cursor: 'pointer',
        }}
      >
        Update
      </button>
    </aside>
  )
}