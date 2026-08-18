"use client"

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function ParentConnectCompatibilityPage() {
  const router = useRouter()
  useEffect(() => {
    router.replace('/parent/messages')
  }, [router])

  return (
    <div style={{ minHeight: '40vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b', fontSize: 13 }}>
      Opening family communications…
    </div>
  )
}
