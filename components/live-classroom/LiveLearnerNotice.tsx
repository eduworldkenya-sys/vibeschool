'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import compact from '@/components/student/LearnerCompact.module.css'
import { eligibleRoom, type LiveSummary } from './LiveNoticePolicy'

/**
 * An in-app signal based solely on the existing learner-authorized Live list.
 * No new admission path, public room listing, push permission or PII exposure.
 */
export default function LiveLearnerNotice({ studentId }: { studentId: string }) {
  const [rooms, setRooms] = useState<LiveSummary[]>([])
  useEffect(() => {
    // Never carry a previous learner's lesson titles across an identity switch.
    setRooms([])
    if (!studentId || process.env.NEXT_PUBLIC_VIBE_LIVE_ENABLED !== 'true') return
    let cancelled = false
    let running = false
    let timer: number | undefined
    const schedule = () => {
      if (timer !== undefined) window.clearTimeout(timer)
      if (!cancelled) timer = window.setTimeout(() => void refresh(), 20000)
    }
    const refresh = async () => {
      if (cancelled) return
      if (document.visibilityState === 'hidden' || !navigator.onLine) {
        schedule()
        return
      }
      if (running) return
      running = true
      try {
        const { data, error } = await supabase.rpc('vibe_live_command', {
          p_action: 'list',
          p_class_id: null,
          p_session_id: null,
          p_version: null,
          p_payload: { host: false },
        })
        if (cancelled) return
        if (error || !Array.isArray(data)) {
          setRooms([])
          return
        }
        setRooms(data.filter(eligibleRoom).slice(0, 3))
      } catch {
        if (!cancelled) setRooms([])
      } finally {
        running = false
        schedule()
      }
    }
    const wake = () => {
      if (timer !== undefined) window.clearTimeout(timer)
      void refresh()
    }
    void refresh()
    document.addEventListener('visibilitychange', wake)
    window.addEventListener('online', wake)
    window.addEventListener('offline', wake)
    return () => {
      cancelled = true
      if (timer !== undefined) window.clearTimeout(timer)
      document.removeEventListener('visibilitychange', wake)
      window.removeEventListener('online', wake)
      window.removeEventListener('offline', wake)
    }
  }, [studentId])

  if (!rooms.length) return null
  return <section className={compact.panel} role="status" aria-live="polite" aria-label="Live class notifications">
    <strong>{rooms.length === 1 ? 'Your teacher is live' : `${rooms.length} lessons are live`}</strong>
    {rooms.map(room => <Link key={room.id} className={compact.action}
      href={`/student/live?room=${encodeURIComponent(room.id)}`}>
      <span>{room.title}</span>
      <span>Join class</span>
    </Link>)}
  </section>
}
