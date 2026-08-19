"use client"

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function ParentConnectCompatibilityPage() {
  const router = useRouter()
  useEffect(() => {
    router.replace('/parent/inbox')
  }, [router])

  return (
    <div role="status" style={{ minHeight: '40vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b', fontSize: 13 }}>
      Opening family inbox…
    </div>
  )
}