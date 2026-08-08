"use client"

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function LegacyTextbookCreateRedirect() {
  const router = useRouter()
  useEffect(() => {
    router.replace('/teacher/studio?format=vibetextbook')
  }, [router])
  return null
}
