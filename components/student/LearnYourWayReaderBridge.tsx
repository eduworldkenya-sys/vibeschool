'use client'

import { useEffect, useState, type CSSProperties } from 'react'
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

  if (!learner || !chapterId || !isReader || pathname.startsWith('/student/twin/transform') || pathname.startsWith('/student/twin/teach')) return null

  const open = () => { router.push(`/student/twin/teach/chapter/${chapterId}`) }

  return <button type="button" onClick={open} style={button} aria-label="Learn this unit with VibeTwin's guided multimodal teaching path">
    <span style={icon}>✦</span><span><strong style={{ display:'block' }}>Learn with Twin</strong><small style={{ opacity:.78 }}>Best format → another way → recall</small></span>
  </button>
}

const button: CSSProperties = { position:'fixed', right:16, bottom:'calc(20px + env(safe-area-inset-bottom))', zIndex:9990, display:'flex', alignItems:'center', gap:9, border:'1px solid rgba(255,255,255,.18)', borderRadius:16, padding:'10px 13px', background:'#5b4ee8', color:'#fff', boxShadow:'0 14px 36px rgba(31,25,104,.36)', fontFamily:'inherit', textAlign:'left', cursor:'pointer' }
const icon: CSSProperties = { width:34,height:34,borderRadius:11,display:'grid',placeItems:'center',background:'rgba(255,255,255,.15)',fontSize:18,fontWeight:900 }
