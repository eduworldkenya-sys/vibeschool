'use client'

import React, { useState } from 'react'
import { useGlobalAuth } from '@/app/global/layout'
import { VibesFeed } from '@/components/global/vibes/VibesFeed'
import { AuthPromptSheet } from '@/components/global/shared/AuthPromptSheet'

export default function VibesPage() {
  const { isLoggedIn } = useGlobalAuth()
  const [authAction, setAuthAction] = useState<'vibe' | null>(null)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div>
        <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0, color: '#ffffff' }}>📄 Vibes</h1>
        <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13, margin: '4px 0 0 0' }}>
          Epages and ebooks from Kenyan educators.
        </p>
      </div>
      <VibesFeed isLoggedIn={isLoggedIn} onAuthPrompt={() => setAuthAction('vibe')} />
      <AuthPromptSheet
        isOpen={authAction !== null}
        onClose={() => setAuthAction(null)}
        action={authAction || 'vibe'}
      />
    </div>
  )
}
