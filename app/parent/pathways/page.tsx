'use client'

import type { CSSProperties } from 'react'
import Link from 'next/link'
import { useEffect,useState } from 'react'
import { supabase } from '@/lib/supabase'

type LearnerPathway={student_id:string;student_name:string;pathway_slug:string|null;pathway_name:string|null;evidence_type:string|null;adopted_at:string|null;reviewed_at:string|null}
type FamilyDraft={id:string;pathway_id:string;status:string;created_at:string;updated_at:string;pathways:{slug:string;name:string}|null}

export default function ParentPathwaysPage(){
  const [learners,setLearners]=useState<LearnerPathway[]>([])
  const [drafts,setDrafts]=useState<FamilyDraft[]>([])
  const [loading,setLoading]=useState(true)
  const [error,setError]=useState('')

  useEffect(()=>{
    let active=true
    void (async()=>{
      const [learnerRes,draftRes]=await Promise.all([
        supabase.rpc('parent_get_linked_pathway_passports'),
        supabase.from('parent_pathway_drafts').select('id,pathway_id,status,created_at,updated_at,pathways(slug,name)').order('updated_at',{ascending:false}),
      ])
      if(!active)return
      if(learnerRes.error||draftRes.error){setError('Family Pathways support could not be loaded safely.');setLoading(false);return}
      setLearners((learnerRes.data??[]) as LearnerPathway[])
      setDrafts((draftRes.data??[]) as unknown as FamilyDraft[])
      setLoading(false)
    })()
    return()=>{active=false}
  },[])

  return <main style={S.root}><div style={S.shell}>
    <Link href="/parent" style={S.back}>← Parent home</Link><p style={S.kicker}>FAMILY PATHWAYS SUPPORT</p><h1 style={S.h1}>Support the learner’s decision without taking ownership of it.</h1><p style={S.lead}>Your family drafts belong to your adult account. A linked learner’s Pathway Passport belongs to that learner. This page lets you understand both without silently changing either.</p>
    {loading&&<section style={S.card}>Loading family Pathways…</section>}{error&&<section role="alert" style={S.error}>{error}</section>}
    {!loading&&!error&&<>
      <section style={S.card}><h2 style={S.cardTitle}>Linked learners</h2>{learners.length===0?<p style={S.body}>No linked learners are available yet.</p>:learners.map(row=><div key={row.student_id} style={S.row}><div><strong style={S.name}>{row.student_name}</strong><p style={S.body}>{row.pathway_name?`${row.pathway_name} · ${row.evidence_type?.replaceAll('_',' ')??'saved direction'}`:'No learner-owned Pathway Passport yet.'}</p></div>{row.pathway_slug&&<Link href={`/pathways/${encodeURIComponent(row.pathway_slug)}`} style={S.smallLink}>Understand →</Link>}</div>)}</section>
      <section style={S.card}><h2 style={S.cardTitle}>My family planning drafts</h2>{drafts.length===0?<p style={S.body}>No parent-owned Pathways drafts saved yet.</p>:drafts.map(draft=><div key={draft.id} style={S.row}><div><strong style={S.name}>{draft.pathways?.name??'Saved pathway direction'}</strong><p style={S.body}>Adult-owned draft · {draft.status.replaceAll('_',' ')} · updated {new Date(draft.updated_at).toLocaleDateString('en-KE')}</p></div>{draft.pathways?.slug&&<Link href={`/pathways/${encodeURIComponent(draft.pathways.slug)}`} style={S.smallLink}>Explore →</Link>}</div>)}</section>
      <section style={S.notice}><strong>Support boundary</strong><p style={S.body}>A parent can discuss, compare schools and help gather evidence. This surface does not provide a control to overwrite a learner’s Passport.</p></section>
    </>}
  </div></main>
}

const S:Record<string,CSSProperties>={root:{minHeight:'100dvh',background:'#f7f7fb',color:'#111827',padding:'20px 14px 56px'},shell:{maxWidth:760,margin:'0 auto'},back:{display:'inline-block',marginBottom:25,color:'#4f46e5',fontWeight:800,fontSize:12,textDecoration:'none'},kicker:{fontSize:10,fontWeight:900,letterSpacing:'.15em',color:'#4f46e5'},h1:{fontSize:'clamp(30px,6vw,46px)',lineHeight:1.07,letterSpacing:'-.038em',margin:'7px 0 12px'},lead:{color:'#657080',fontSize:13,lineHeight:1.65},card:{background:'#fff',border:'1px solid #e4e6eb',borderRadius:18,padding:18,marginTop:12},cardTitle:{fontSize:17,margin:'0 0 8px'},row:{display:'flex',alignItems:'center',justifyContent:'space-between',gap:12,padding:'12px 0',borderBottom:'1px solid #f0f1f4'},name:{fontSize:13},body:{color:'#687181',fontSize:11,lineHeight:1.55,margin:'4px 0 0'},smallLink:{color:'#4f46e5',fontSize:11,fontWeight:850,textDecoration:'none',whiteSpace:'nowrap'},notice:{background:'#eef2ff',border:'1px solid #c7d2fe',borderRadius:16,padding:16,marginTop:12,color:'#3730a3'},error:{background:'#fef2f2',border:'1px solid #fecaca',color:'#991b1b',borderRadius:14,padding:14}}
