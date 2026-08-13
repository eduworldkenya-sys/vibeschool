'use client'

import { useEffect, useState } from 'react'

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>
}

const DISMISS_KEY = 'vibeschool:pwa-install-dismissed-at'
const DISMISS_MS = 14 * 24 * 60 * 60 * 1000

export default function PwaInstallPrompt() {
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      Boolean((navigator as Navigator & { standalone?: boolean }).standalone)

    if (isStandalone) return

    const dismissedAt = Number(window.localStorage.getItem(DISMISS_KEY) || '0')
    const recentlyDismissed = dismissedAt > 0 && Date.now() - dismissedAt < DISMISS_MS

    const handleBeforeInstall = (event: Event) => {
      event.preventDefault()
      setInstallEvent(event as BeforeInstallPromptEvent)
      if (!recentlyDismissed) setVisible(true)
    }

    const handleInstalled = () => {
      window.localStorage.removeItem(DISMISS_KEY)
      setInstallEvent(null)
      setVisible(false)
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstall)
    window.addEventListener('appinstalled', handleInstalled)

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall)
      window.removeEventListener('appinstalled', handleInstalled)
    }
  }, [])

  if (!visible || !installEvent) return null

  const dismiss = () => {
    window.localStorage.setItem(DISMISS_KEY, String(Date.now()))
    setVisible(false)
  }

  const install = async () => {
    await installEvent.prompt()
    const choice = await installEvent.userChoice
    if (choice.outcome === 'dismissed') {
      window.localStorage.setItem(DISMISS_KEY, String(Date.now()))
    }
    setInstallEvent(null)
    setVisible(false)
  }

  return (
    <aside
      role="dialog"
      aria-label="Install VibeSchool"
      style={{
        position: 'fixed',
        left: 'max(14px, env(safe-area-inset-left))',
        right: 'max(14px, env(safe-area-inset-right))',
        bottom: 'max(14px, env(safe-area-inset-bottom))',
        zIndex: 9999,
        maxWidth: '440px',
        margin: '0 auto',
        border: '1px solid rgba(255,255,255,0.11)',
        borderRadius: '24px',
        background: 'linear-gradient(145deg, rgba(12,17,49,0.98), rgba(7,11,31,0.98))',
        color: '#fff',
        padding: '14px',
        boxShadow: '0 22px 70px rgba(0,0,0,0.48)',
        backdropFilter: 'blur(18px)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <img
          src="/icons/icon-192.svg"
          alt=""
          width={52}
          height={52}
          style={{ borderRadius: '14px', flex: '0 0 auto' }}
        />
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontSize: '15px', fontWeight: 800, letterSpacing: '-0.01em' }}>
            Put VibeSchool on your home screen
          </div>
          <div style={{ marginTop: '3px', color: 'rgba(255,255,255,0.68)', fontSize: '12px', lineHeight: 1.45 }}>
            Faster access, app-style launch, and a cleaner learning experience.
          </div>
        </div>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Dismiss install suggestion"
          style={{
            width: '34px',
            height: '34px',
            border: 0,
            borderRadius: '50%',
            background: 'rgba(255,255,255,0.07)',
            color: 'rgba(255,255,255,0.72)',
            fontSize: '20px',
            cursor: 'pointer',
          }}
        >
          ×
        </button>
      </div>
      <button
        type="button"
        onClick={install}
        style={{
          width: '100%',
          marginTop: '12px',
          border: 0,
          borderRadius: '15px',
          background: 'linear-gradient(90deg, #7C3CFF, #F2168C 52%, #FF9B2F)',
          color: '#fff',
          padding: '12px 15px',
          fontSize: '13px',
          fontWeight: 800,
          cursor: 'pointer',
          boxShadow: '0 8px 26px rgba(166,43,229,0.28)',
        }}
      >
        Install VibeSchool
      </button>
    </aside>
  )
}
