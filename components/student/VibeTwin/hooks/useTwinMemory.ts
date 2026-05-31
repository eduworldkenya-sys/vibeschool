// components/student/VibeTwin/hooks/useTwinMemory.ts
import { useEffect, useRef, useCallback } from 'react'
import { supabase } from '@/lib/supabase'

interface QueuedWrite {
  type:    string
  content: string
  subject: string
}

export function useTwinMemory() {
  const profileIdRef  = useRef<string | null>(null)
  const resolvedRef   = useRef<boolean>(false)
  // Queue writes that arrive before auth resolves
  const writeQueueRef = useRef<QueuedWrite[]>([])

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      const uid = data.user?.id ?? null
      profileIdRef.current = uid
      resolvedRef.current  = true

      // Flush any queued writes now that auth is resolved
      if (uid && writeQueueRef.current.length > 0) {
        const queued = [...writeQueueRef.current]
        writeQueueRef.current = []
        queued.forEach(w => void persistMemory(uid, w.type, w.content, w.subject))
      }
    })
  }, [])

  async function persistMemory(
    uid:     string,
    type:    string,
    content: string,
    subject: string,
  ) {
    const { error } = await supabase
      .from('twin_memory')
      .insert({ profile_id: uid, type, content, subject })

    if (error && process.env.NODE_ENV === 'development') {
      console.warn('[TwinMemory] insert failed:', error.message)
    }
  }

  async function persistProfile(uid: string, subject: string) {
    const { data, error: fetchError } = await supabase
      .from('twin_profile')
      .select('top_subjects')
      .eq('profile_id', uid)
      .maybeSingle()

    if (fetchError && process.env.NODE_ENV === 'development') {
      console.warn('[TwinMemory] profile fetch failed:', fetchError.message)
      return
    }

    const existing: string[] = data?.top_subjects ?? []
    const updated = existing.includes(subject)
      ? existing
      : [subject, ...existing].slice(0, 5)

    const { error: upsertError } = await supabase
      .from('twin_profile')
      .upsert({
        profile_id:   uid,
        top_subjects: updated,
        last_topic:   subject,
        updated_at:   new Date().toISOString(),
      })

    if (upsertError && process.env.NODE_ENV === 'development') {
      console.warn('[TwinMemory] profile upsert failed:', upsertError.message)
    }
  }

  const saveToMemory = useCallback((
    type:    string,
    content: string,
    subject: string,
  ) => {
    const uid = profileIdRef.current

    // Auth not resolved yet — queue the write
    if (!resolvedRef.current) {
      writeQueueRef.current.push({ type, content, subject })
      return
    }

    // Auth resolved but no user — drop silently
    if (!uid) return

    void persistMemory(uid, type, content, subject)
    void persistProfile(uid, subject)
  }, [])

  return { saveToMemory }
}
