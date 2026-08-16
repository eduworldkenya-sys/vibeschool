'use client'

import type { CSSProperties } from 'react'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

type Passport = {
  student_id:string
  pathway_id:string
  pathway_slug:string
  pathway_name:string
  summary:string
  evidence_type:string
  evidence_snapshot:Record<string,unknown>
  rule_version:string
  adopted_at:string
  reviewed_at:string|null
  updated_at:string
}

export default function StudentPathwayPassportPage(){
  const [passport,setPassport]=useState<Passport|null>(null)
  const [loading,setLoading]=useState(true)
  const [error,setError]=useState('')

  useEffect(()=>{
    let active=true
    void (async()=>{
      const {data,error:rpcError}=await supabase.rpc('student_get_pathway_passport')
      if(!active)return
      if(rpcError){setError('Your Pathway Passport could not be loaded safely.');setLoading(false);return}
      setPassport((data&&typeof data==='object'&&!Array.isArray(data)?data:null) as Passport|null)
      setLoading(false)
    })()
    return()=>{active=false}
  },[])

  return <main style={S.root}><div style={S.shell}>
    <Link href="/student/profile" style={S.back}>← Learner profile</Link>
    <p style={S.kicker}>MY PATHWAY PASSPORT</p><h1 style={S.h1}>A direction you own, not a label that owns you.</h1>
    <p style={S.lead}>Your Passport records the pathway direction you have explicitly saved. It keeps the evidence class and rule version that produced the decision so future guidance can be reviewed instead of silently overwritten.</p>
    {loading&&<section style={S.card}>Loading your Passport…</section>}
    {error&&<section role="alert" style={S.error}>{error}</section>}
    {!loading&&!error&&!passport&&<section style={S.card}><h2 style={S.cardTitle}>No pathway adopted yet</h2><p style={S.body}>Explore Pathways first. Your learner profile does not need a pathway decision until you choose to save one.</p><Link href="/pathways/check" style={S.primary}>Check my direction</Link></section>}
    {passport&&<>
      <section style={S.passport}><span style={S.passLabel}>CURRENT DIRECTION</span><h2 style={S.passTitle}>{passport.pathway_name}</h2><p style={S.passBody}>{passport.summary}</p><div style={S.metaGrid}><div><span style={S.metaLabel}>Evidence</span><strong style={S.metaValue}>{passport.evidence_type.replaceAll('_',' ')}</strong></div><div><span style={S.metaLabel}>Rule version</span><strong style={S.metaValue}>{passport.rule_version}</strong></div><div><span style={S.metaLabel}>Adopted</span><strong style={S.metaValue}>{new Date(passport.adopted_at).toLocaleDateString('en-KE')}</strong></div><div><span style={S.metaLabel}>Reviewed</span><strong style={S.metaValue}>{passport.reviewed_at?new Date(passport.reviewed_at).toLocaleDateString('en-KE'):'Not yet'}</strong></div></div></section>
      <section style={S.card}><h2 style={S.cardTitle}>What this means</h2><p style={S.body}>This is VibeSchool guidance, not an official Ministry placement. Your pathway can be reviewed as your interests, subject evidence and goals develop. A parent or assigned teacher may see the direction to support you, but they cannot silently replace your learner-owned Passport.</p><div style={S.actions}><Link href={`/pathways/${encodeURIComponent(passport.pathway_slug)}`} style={S.primary}>Understand this pathway</Link><Link href={`/pathways/schools?pathway=${encodeURIComponent(passport.pathway_slug)}`} style={S.secondary}>Find verified schools</Link><Link href="/pathways/check" style={S.secondary}>Review my direction</Link></div></section>
    </>}
  </div></main>
}

const S:Record<string,CSSProperties>={root:{minHeight:'100dvh',background:'#f0f2f5',color:'#111827',padding:'20px 14px 56px'},shell:{maxWidth:720,margin:'0 auto'},back:{display:'inline-block',marginBottom:26,color:'#6366f1',fontWeight:800,fontSize:12,textDecoration:'none'},kicker:{fontSize:10,fontWeight:900,letterSpacing:'.15em',color:'#6366f1'},h1:{fontSize:'clamp(31px,6vw,48px)',lineHeight:1.06,letterSpacing:'-.04em',margin:'7px 0 12px'},lead:{color:'#657080',fontSize:13,lineHeight:1.65,maxWidth:650},card:{background:'#fff',border:'1px solid #e5e7eb',borderRadius:18,padding:18,marginTop:12},cardTitle:{fontSize:18,margin:'0 0 7px'},body:{fontSize:12,lineHeight:1.65,color:'#626b7b'},error:{background:'#fef2f2',border:'1px solid #fecaca',color:'#991b1b',borderRadius:14,padding:14},passport:{background:'#1e1b4b',color:'#fff',borderRadius:22,padding:'clamp(20px,5vw,34px)',marginTop:22},passLabel:{fontSize:9,fontWeight:900,letterSpacing:'.16em',color:'#c7d2fe'},passTitle:{fontSize:'clamp(30px,6vw,46px)',letterSpacing:'-.035em',margin:'7px 0'},passBody:{color:'#d8d8e7',fontSize:13,lineHeight:1.6,maxWidth:560},metaGrid:{display:'grid',gridTemplateColumns:'repeat(2,minmax(0,1fr))',gap:9,marginTop:20},metaLabel:{display:'block',fontSize:8,textTransform:'uppercase',letterSpacing:'.12em',opacity:.6},metaValue:{display:'block',fontSize:11,marginTop:3,textTransform:'capitalize'},actions:{display:'grid',gap:8,marginTop:14},primary:{display:'block',textAlign:'center',padding:'12px 14px',borderRadius:12,background:'#6366f1',color:'#fff',textDecoration:'none',fontWeight:850,fontSize:12},secondary:{display:'block',textAlign:'center',padding:'11px 14px',borderRadius:12,border:'1px solid #dfe1e7',color:'#4f46e5',textDecoration:'none',fontWeight:850,fontSize:12}}
