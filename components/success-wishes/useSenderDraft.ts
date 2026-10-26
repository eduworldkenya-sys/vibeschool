'use client'

import { useEffect, useState } from 'react'
import { decodeSenderDraft, encodeSenderDraft, hasSenderDraft, SENDER_DRAFT_KEY, type SenderDraft } from '@/lib/success-wishes/sender-draft'

export function useSenderDraft(draft: SenderDraft, hasInitialDraft: boolean, restore: (draft: SenderDraft) => void) {
  const [hydrated, setHydrated] = useState(false)
  const [saved, setSaved] = useState(false)
  const [restored, setRestored] = useState(false)
  const [unavailable, setUnavailable] = useState(false)
  const serialized = JSON.stringify(draft)

  useEffect(() => {
    try {
      const raw = window.sessionStorage.getItem(SENDER_DRAFT_KEY)
      const previous = decodeSenderDraft(raw)
      if (!hasInitialDraft && previous) { restore(previous); setRestored(true) }
      if (raw && !previous) window.sessionStorage.removeItem(SENDER_DRAFT_KEY)
    } catch { setUnavailable(true) }
    setHydrated(true)
  }, [hasInitialDraft, restore])

  useEffect(() => {
    if (!hydrated) return
    try {
      const current: SenderDraft = JSON.parse(serialized)
      if (hasSenderDraft(current)) {
        window.sessionStorage.setItem(SENDER_DRAFT_KEY, encodeSenderDraft(current))
        setSaved(true)
      } else {
        window.sessionStorage.removeItem(SENDER_DRAFT_KEY)
        setSaved(false)
        setRestored(false)
      }
      setUnavailable(false)
    } catch { setUnavailable(true); setSaved(false) }
  }, [hydrated, serialized])

  return { hydrated, saved, restored, unavailable }
}
