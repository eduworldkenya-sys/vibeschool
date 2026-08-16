'use client'

import type { CSSProperties } from 'react'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { getSupportedPathwayPassport, type SupportedPathwayPassport } from '@/lib/pathways/support'

type Learner = { id: string; name: string; class_id: string | null }
type LearnerPathway = { learner: Learner; passport: SupportedPathwayPassport | null; error?: string }

export default function ParentPathwaysPage() {
  const [rows, setRows] = useState<LearnerPathway[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) throw new Error('Sign in as a parent to support a learner.')
        const { data: links, error: linkError } = await supabase.from('parent_student_links').select('student_id').eq('parent_id', user.id)
        if (linkError) throw new Error('Your linked learners could not be loaded.')
        const ids = Array.from(new Set((links ?? []).map(item => item.student_id).filter(Boolean)))
        if (ids.length === 0) { if (!cancelled) setRows([]); return }
        const { data: learners, error: learnerError } = await supabase.from('students').select('id,name,class_id').in('id', ids).is('deleted_at', null)
        if (learnerError) throw new Error('Learner profiles could not be loaded.')
        const resolved = await Promise.all((learners ?? []).map(async learner => {
          try { return { learner: learner as Learner, passport: await getSupportedPathwayPassport(learner.id) } }
          catch (cause) { return { learner: learner as Learner, passport: null, error: cause instanceof Error ? cause.message : 'Pathway unavailable.' } }
        }))
        if (!cancelled) setRows(resolved)
      } catch (cause) {
        if (!cancelled) setError(cause instanceof Error ? cause.message : 'Pathways support could not be loaded.')
      } finally { if (!cancelled) setLoading(false) }
    }
    void load()
    return () => { cancelled = true }
  }, [])

  return <main style={S.root}><div style={S.shell}>
    <Link href="/parent" style={S.back}>← Parent home</Link>
    <div style={S.kicker}>PATHWAY SUPPORT</div>
    <h1 style={S.h1}>Help your learner understand their direction.</h1>
    <p style={S.lead}>This is a read-only support view. The learner owns the saved Pathway Passport; a parent can discuss and support it but cannot silently change it.</p>
    {loading && <div style={S.card}>Loading linked learners…</div>}
    {error && <div style={S.error}>{error}</div>}
    {!loading && !error && rows.length === 0 && <div style={S.card}><strong>No linked learner yet.</strong><p style={S.body}>Connect your child through the existing VibeSchool parent flow first. Pathways does not bypass learner-family relationship verification.</p></div>}
    <div style={S.list}>{rows.map(row => <article key={row.learner.id} style={S.card}>
      <h2 style={S.name}>{row.learner.name}</h2>
      {row.error ? <p style={S.errorText}>{row.error}</p> : row.passport ? <>
        <div style={S.passport}><span style={S.smallLabel}>SAVED DIRECTION</span><strong style={S.pathway}>{row.passport.pathwayName}</strong><p style={S.body}>{row.passport.summary}</p></div>
        <p style={S.note}>{row.passport.supportNotice}</p>
        <div style={S.actions}><Link href="/pathways" style={S.secondary}>Understand the pathway</Link><Link href="/pathways/schools" style={S.secondary}>Explore verified schools</Link></div>
      </> : <><p style={S.body}>This learner has not saved a Pathway Passport yet.</p><p style={S.note}>You can discuss Pathways together, but the learner should make or explicitly adopt their own saved direction.</p><Link href="/pathways/check" style={S.secondary}>Open the free Pathway Check</Link></>}
    </article>)}</div>
  </div></main>
}

const S: Record<string, CSSProperties> = {
  root:{minHeight:'100dvh',background:'#f0f2f5',color:'#111827',padding:'24px 16px 60px'},shell:{maxWidth:720,margin:'0 auto'},back:{display:'inline-block',marginBottom:28,color:'#047857',fontWeight:800,fontSize:13,textDecoration:'none'},kicker:{fontSize:10,fontWeight:900,letterSpacing:'.16em',color:'#047857'},h1:{fontSize:'clamp(30px,6vw,46px)',lineHeight:1.08,letterSpacing:'-.03em',margin:'8px 0 12px'},lead:{color:'#626b7b',fontSize:14,lineHeight:1.65,margin:'0 0 22px'},list:{display:'grid',gap:12},card:{background:'#fff',border:'1px solid #e5e7eb',borderRadius:18,padding:17},name:{fontSize:17,margin:'0 0 10px'},passport:{background:'#ecfdf5',borderRadius:14,padding:14},smallLabel:{display:'block',fontSize:9,fontWeight:900,letterSpacing:'.13em',color:'#047857'},pathway:{display:'block',fontSize:21,marginTop:4},body:{color:'#626b7b',fontSize:12,lineHeight:1.55,margin:'6px 0 0'},note:{color:'#6b7280',fontSize:10,lineHeight:1.5,margin:'10px 0'},actions:{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(180px,1fr))',gap:8,marginTop:12},secondary:{display:'block',textAlign:'center',border:'1px solid #d7dae2',borderRadius:11,padding:'10px 12px',color:'#047857',fontWeight:800,fontSize:11,textDecoration:'none'},error:{background:'#fef2f2',border:'1px solid #fecaca',color:'#991b1b',padding:12,borderRadius:12},errorText:{color:'#991b1b',fontSize:11}
}
