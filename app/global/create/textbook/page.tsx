"use client"

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function LegacyTextbookCreateRedirect() {
  const router = useRouter()
  useEffect(() => {
    router.replace('/teacher/studio/editor?format=vibetextbook')
  }, [router])
  return null
}
