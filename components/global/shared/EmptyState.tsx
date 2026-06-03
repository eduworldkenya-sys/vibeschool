"use client";
'use client'

import React from 'react'
import { useRouter } from 'next/navigation'

interface EmptyStateProps {
  icon?: string
  title: string
  subtitle?: string
  action?: { label: string; href: string }
}

export function EmptyState({ icon = '📭', title, subtitle, action }: EmptyStateProps) {
  const router = useRouter()
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '40px 20px', backgroundColor: '#111827', borderRadius: 16, border: '1px solid rgba(255,255,255,0.06)' }}>
      <span style={{ fontSize: 36, marginBottom: 12 }}>{icon}</span>
      <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: '#ffffff' }}>{title}</h3>
      {subtitle && <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', marginTop: 6, marginBottom: 0, maxWidth: 260, lineHeight: 1.4 }}>{subtitle}</p>}
      {action && (
        <button onClick={() => router.push(action.href)} style={{ marginTop: 16, backgroundColor: '#CCFF00', color: '#090D16', padding: '8px 16px', borderRadius: 12, fontSize: 13, fontWeight: 700, border: 'none', cursor: 'pointer' }}>
          {action.label}
        </button>
      )}
    </div>
  )
}
