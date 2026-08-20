'use client'

import { useEffect, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import type { Json } from '@/lib/database.types'

type ReaderChapterEvent = { publicationId?: string; chapterId?: string; progressPercent?: number }
type RpcResult<T> = { data: T | null; error: { message?: string } | null }
type Rpc = <T>(name: string, args?: Record<string, unknown>) => PromiseLike<RpcResult<T>>
const rpc = supabase.rpc.bind(supabase) as unknown as Rpc

export default function LearnYourWayReaderBridge() {
  const pathname = usePathname(); const router = useRouter()
  const [chapterId, setChapterId] = useState<string | null>(null)
  const [learner, setLearner] = useState(false)
  const isReader = pathname.startsWith('/read/textbook/')

  useEffect(() => {
    if (!isReader) { setLearner(false); return }
    let cancelled = false
    async function resolveLearner() {
      const { data } = await supabase.auth.getSession()
      if (!data.session?.user) { if (!cancelled) setLearner(false); return }
      const { data: brain, error } = await rpc<Json>('student_get_twin_brain_cached')
      if (!cancelled) setLearner(!error && Boolean(brain))
    }
    void resolveLearner()
    return () => { cancelled = true }
  }, [isReader])

  useEffect(() => {
    if (!isReader) return
    function onChapter(event: Event) {
      const detail = (event as CustomEvent<ReaderChapterEvent>).detail
      if (typeof detail?.chapterId === 'string' && detail.chapterId) setChapterId(detail.chapterId)
    }
    window.addEventListener('vibe:reader-chapter', onChapter)
    return () => window.removeEventListener('vibe:reader-chapter', onChapter)
  }, [isReader])

  useEffect(() => { if (!isReader) setChapterId(null) }, [isReader])

  useEffect(() => {
    if (!isReader || !learner || !chapterId) return
    const open = () => router.push(`/student/twin/teach/chapter/${chapterId}`)
    window.addEventListener('vibe:reader-help', open)
    return () => window.removeEventListener('vibe:reader-help', open)
  }, [chapterId, isReader, learner, router])

  // Inside Read, Twin is contextual intelligence behind the reader's Help action,
  // not a permanent floating advertisement competing with the book.
  return null
}
