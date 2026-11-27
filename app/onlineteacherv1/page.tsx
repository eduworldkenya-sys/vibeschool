'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Video, ArrowRight, ArrowLeft } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import LiveClassroom from '@/components/live-classroom/LiveClassroom'

export default function OnlineTeacherV1() {
  const router = useRouter()
  const [ready, setReady] = useState(false)
  const [failed, setFailed] = useState(false)
  const [classroom, setClassroom] = useState(false)
  useEffect(() => {
    let mounted = true
    async function check() {
      try {
        const { data, error } = await supabase.auth.getUser()
        if (!mounted) return
        if (error && !data.user) { setFailed(true); return }
        if (!data.user) { router.replace('/login?next=%2Fonlineteacherv1'); return }
        // The existing classroom API remains authoritative for teacher permissions.
        setClassroom(new URLSearchParams(window.location.search).has('resumeRoom'))
        setReady(true)
      } catch { if (mounted) setFailed(true) }
    }
    void check()
    return () => { mounted = false }
  }, [router])
  const enabled = process.env.NEXT_PUBLIC_VIBE_LIVE_ENABLED === 'true'
  if (ready && enabled && classroom) {
    return <LiveClassroom classId={null} teacher={true} back="/onlineteacherv1" />
  }
  return (
    <main style={{minHeight:'100dvh',background:'#f5f7f6',color:'#172b22',fontFamily:'var(--font-jakarta),system-ui,sans-serif'}}>
      <header style={{background:'#fff',borderBottom:'1px solid #dfe5e1',padding:'16px clamp(16px,4vw,40px)',display:'flex',alignItems:'center',justifyContent:'space-between',gap:12}}>
        <div><strong style={{fontSize:22,letterSpacing:'-1px',color:'#164b37'}}>VibeSchool.</strong><div style={{fontSize:11,letterSpacing:'1.2px',color:'#53665b'}}>ONLINE TEACHER</div></div>
        <Link href="/teacher/pulse" style={{display:'inline-flex',alignItems:'center',gap:6,color:'#164b37',fontSize:13}}><ArrowLeft size={16} aria-hidden="true"/> Teacher workspace</Link>
      </header>
      <section style={{maxWidth:960,margin:'0 auto',padding:'clamp(20px,5vw,48px) 16px'}}>
        <h1 style={{fontSize:'clamp(24px,4vw,32px)',letterSpacing:'-.8px',margin:'0 0 20px'}}>Online teaching</h1>
        <section aria-labelledby="live-heading" style={{background:'#153c2e',color:'#fff',borderRadius:12,padding:'clamp(20px,4vw,36px)',display:'flex',alignItems:'center',justifyContent:'space-between',flexWrap:'wrap',gap:20}}>
          <div><Video size={30} aria-hidden="true"/><h2 id="live-heading" style={{margin:'12px 0 6px',fontSize:24}}>Ready to teach?</h2><p style={{margin:0,color:'#d3e6dc'}}>Start an online class and invite your learners.</p></div>
          <button type="button" disabled={!ready||!enabled} onClick={()=>setClassroom(true)} style={{display:'inline-flex',alignItems:'center',gap:10,minHeight:48,border:0,borderRadius:7,padding:'12px 20px',background:'#fff',color:'#153c2e',fontWeight:700,cursor:ready&&enabled?'pointer':'not-allowed',opacity:ready&&enabled?1:.65}}>Go Live <ArrowRight size={18} aria-hidden="true"/></button>
        </section>
        {failed?<p role="alert">Unable to verify your session. <Link href="/login?next=%2Fonlineteacherv1">Sign in again</Link>.</p>:!ready?<p role="status">Checking your session…</p>:!enabled?<p role="status">Live classroom is not enabled.</p>:null}
      </section>
    </main>
  )
}
