'use client'

import type { CSSProperties } from 'react'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { getSupportedPathwayPassport, type SupportedPathwayPassport } from '@/lib/pathways/support'

type Learner = { id:string; name:string; class_id:string|null; admission_number:string|null }
type LearnerPathway = { learner:Learner; passport:SupportedPathwayPassport|null; error?:string }

export default function TeacherPathwaysPage(){
 const [rows,setRows]=useState<LearnerPathway[]>([]); const [loading,setLoading]=useState(true); const [error,setError]=useState('')
 useEffect(()=>{let cancelled=false; async function load(){try{
  const {data:{user}}=await supabase.auth.getUser(); if(!user) throw new Error('Sign in as a teacher to support learners.')
  const {data:assignments,error:aErr}=await supabase.from('teacher_classes').select('class_id').eq('teacher_id',user.id)
  if(aErr) throw new Error('Your classes could not be loaded.')
  const classIds=Array.from(new Set((assignments??[]).map(a=>a.class_id).filter(Boolean)))
  if(!classIds.length){if(!cancelled)setRows([]);return}
  const {data:learners,error:lErr}=await supabase.from('students').select('id,name,class_id,admission_number').in('class_id',classIds).is('deleted_at',null).order('name')
  if(lErr) throw new Error('Learners could not be loaded.')
  const resolved=await Promise.all((learners??[]).map(async learner=>{try{return{learner:learner as Learner,passport:await getSupportedPathwayPassport(learner.id)}}catch(cause){return{learner:learner as Learner,passport:null,error:cause instanceof Error?cause.message:'Pathway unavailable.'}}}))
  if(!cancelled)setRows(resolved)
 }catch(cause){if(!cancelled)setError(cause instanceof Error?cause.message:'Pathway support could not be loaded.')}finally{if(!cancelled)setLoading(false)}} void load(); return()=>{cancelled=true}},[])
 return <main style={S.root}><div style={S.shell}>
  <Link href="/teacher/pulse" style={S.back}>← Teacher home</Link><div style={S.kicker}>PATHWAY GUIDANCE</div><h1 style={S.h1}>Support a learner without taking over their decision.</h1><p style={S.lead}>This view is read-only and limited to learners in your assigned classes. It deliberately excludes raw Quick Check answers and does not give teachers authority to adopt or change a learner's Pathway Passport.</p>
  {loading&&<div style={S.card}>Loading learners…</div>}{error&&<div style={S.error}>{error}</div>}
  {!loading&&!error&&rows.length===0&&<div style={S.card}><strong>No assigned class learners found.</strong><p style={S.body}>Pathways support follows your existing class authority and does not create a separate teacher-to-learner relationship.</p></div>}
  <div style={S.list}>{rows.map(row=><article key={row.learner.id} style={S.card}><div style={S.top}><div><h2 style={S.name}>{row.learner.name}</h2>{row.learner.admission_number&&<span style={S.meta}>{row.learner.admission_number}</span>}</div>{row.passport&&<span style={S.badge}>Saved</span>}</div>{row.error?<p style={S.errorText}>{row.error}</p>:row.passport?<><div style={S.passport}><span style={S.smallLabel}>LEARNER'S SAVED DIRECTION</span><strong style={S.pathway}>{row.passport.pathwayName}</strong><p style={S.body}>{row.passport.summary}</p></div><p style={S.note}>{row.passport.supportNotice}</p><div style={S.actions}><Link href="/pathways" style={S.secondary}>Explain pathway</Link><Link href="/pathways/schools" style={S.secondary}>Explore verified schools</Link></div></>:<><p style={S.body}>No Pathway Passport saved yet.</p><p style={S.note}>Use the free public Pathway Check as a discussion aid; do not choose on the learner's behalf.</p><Link href="/pathways/check" style={S.secondary}>Open Pathway Check</Link></>}</article>)}</div>
 </div></main>
}
const S:Record<string,CSSProperties>={root:{minHeight:'100dvh',background:'#f5f7fb',color:'#111827',padding:'24px 16px 60px'},shell:{maxWidth:780,margin:'0 auto'},back:{display:'inline-block',marginBottom:28,color:'#4f46e5',fontWeight:800,fontSize:13,textDecoration:'none'},kicker:{fontSize:10,fontWeight:900,letterSpacing:'.16em',color:'#4f46e5'},h1:{fontSize:'clamp(30px,6vw,46px)',lineHeight:1.08,letterSpacing:'-.03em',margin:'8px 0 12px'},lead:{color:'#626b7b',fontSize:14,lineHeight:1.65,margin:'0 0 22px'},list:{display:'grid',gap:10},card:{background:'#fff',border:'1px solid #e5e7eb',borderRadius:18,padding:16},top:{display:'flex',justifyContent:'space-between',gap:12},name:{fontSize:16,margin:0},meta:{fontSize:10,color:'#8a91a0'},badge:{background:'#eef2ff',color:'#4338ca',borderRadius:999,padding:'5px 8px',fontSize:9,fontWeight:850},passport:{background:'#eef2ff',borderRadius:13,padding:13,marginTop:11},smallLabel:{fontSize:9,fontWeight:900,letterSpacing:'.13em',color:'#4f46e5'},pathway:{display:'block',fontSize:19,marginTop:3},body:{color:'#626b7b',fontSize:11,lineHeight:1.55,margin:'5px 0 0'},note:{color:'#6b7280',fontSize:10,lineHeight:1.5,margin:'9px 0'},actions:{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(160px,1fr))',gap:8},secondary:{display:'block',textAlign:'center',border:'1px solid #d7dae2',borderRadius:10,padding:'9px 11px',color:'#4338ca',fontWeight:800,fontSize:10,textDecoration:'none'},error:{background:'#fef2f2',border:'1px solid #fecaca',color:'#991b1b',padding:12,borderRadius:12},errorText:{color:'#991b1b',fontSize:10}}
