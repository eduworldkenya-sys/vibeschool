'use client'

import type { CSSProperties } from 'react'
import Link from 'next/link'
import { FormEvent, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

type SchoolRow = {
  school_id:string; school_name:string; county:string|null; sub_county:string|null; school_category:string|null;
  ownership_type:string|null; gender_type:string|null; accommodation_type:string|null; cluster:string|null; knec_code:string|null;
  pathway_slug:string|null; pathway_name:string|null; combination_slug:string|null; combination_name:string|null; verified_at:string|null;
}

export default function PathwaysSchoolsPage(){
  const [query,setQuery]=useState('')
  const [county,setCounty]=useState('')
  const [pathway,setPathway]=useState('')
  const [rows,setRows]=useState<SchoolRow[]>([])
  const [loading,setLoading]=useState(true)
  const [error,setError]=useState('')

  async function load(){
    setLoading(true);setError('')
    const {data,error}=await supabase.rpc('pathways_search_public_schools',{p_query:query||null,p_county:county||null,p_pathway_slug:pathway||null,p_combination_slug:null,p_limit:30})
    if(error){setError('Verified school information could not be loaded.');setRows([])}
    else setRows((data??[]) as SchoolRow[])
    setLoading(false)
  }
  useEffect(()=>{void load()},[])
  function submit(e:FormEvent){e.preventDefault();void load()}

  return <main style={S.root}><div style={S.shell}>
    <Link href="/pathways" style={S.back}>← Pathways</Link><p style={S.kicker}>SENIOR SCHOOL DISCOVERY</p>
    <h1 style={S.h1}>Find schools without turning uncertainty into fact.</h1>
    <p style={S.lead}>School identity comes from VibeSchool's canonical School Engine. A pathway or subject-combination claim appears only when a source-backed offering has been verified.</p>
    <form onSubmit={submit} style={S.form}><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="School name" style={S.input}/><input value={county} onChange={e=>setCounty(e.target.value)} placeholder="County" style={S.input}/><select value={pathway} onChange={e=>setPathway(e.target.value)} style={S.input}><option value="">Any pathway</option><option value="stem">STEM</option><option value="social-sciences">Social Sciences</option><option value="arts-and-sports-science">Arts & Sports Science</option></select><button style={S.button}>Search</button></form>
    <div style={S.notice}><strong>Verification rule:</strong> filtering by a pathway returns only schools with a currently verified offering. An absent result means “not verified here”, not “the school definitely does not offer it”.</div>
    {loading&&<p style={S.muted}>Loading canonical schools…</p>}{error&&<p role="alert" style={S.error}>{error}</p>}
    {!loading&&!error&&rows.length===0&&<div style={S.card}><strong>No verified match found.</strong><p style={S.body}>Try a broader search. VibeSchool will not infer a school offering when evidence is absent.</p></div>}
    <div style={S.list}>{rows.map(r=><article key={`${r.school_id}-${r.combination_slug??'school'}`} style={S.card}><h2 style={S.name}>{r.school_name}</h2><p style={S.meta}>{[r.county,r.sub_county,r.school_category,r.gender_type,r.accommodation_type].filter(Boolean).join(' · ')}</p>{r.pathway_slug?<div style={S.verified}><strong>Verified offering</strong><span>{r.pathway_name}{r.combination_name?` · ${r.combination_name}`:''}</span>{r.verified_at&&<small>Verified {new Date(r.verified_at).toLocaleDateString()}</small>}</div>:<p style={S.unverified}>Pathway offering not yet verified in VibeSchool.</p>}{r.knec_code&&<p style={S.code}>KNEC {r.knec_code}</p>}</article>)}</div>
  </div></main>
}

const S:Record<string,CSSProperties>={root:{minHeight:'100dvh',background:'#f7f7fb',color:'#111827',padding:'24px 16px 60px'},shell:{maxWidth:900,margin:'0 auto'},back:{color:'#4f46e5',textDecoration:'none',fontWeight:800,fontSize:13},kicker:{marginTop:28,color:'#4f46e5',fontSize:10,fontWeight:900,letterSpacing:'.16em'},h1:{fontSize:'clamp(32px,6vw,48px)',lineHeight:1.05,letterSpacing:'-.035em',margin:'8px 0 12px'},lead:{maxWidth:760,color:'#5b6475',fontSize:14,lineHeight:1.65},form:{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(160px,1fr))',gap:8,margin:'22px 0 12px'},input:{padding:'12px 13px',border:'1px solid #d8dae2',borderRadius:12,background:'#fff',fontSize:14},button:{border:0,borderRadius:12,background:'#4f46e5',color:'#fff',fontWeight:800,padding:'12px 14px'},notice:{background:'#fffbeb',border:'1px solid #fde68a',borderRadius:14,padding:14,fontSize:12,lineHeight:1.55,color:'#66551a'},list:{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(260px,1fr))',gap:12,marginTop:16},card:{background:'#fff',border:'1px solid #e5e7eb',borderRadius:18,padding:17},name:{fontSize:17,margin:'0 0 6px'},meta:{fontSize:11,color:'#6b7280',lineHeight:1.5},verified:{display:'grid',gap:3,background:'#ecfdf5',borderRadius:12,padding:12,color:'#065f46',fontSize:12},unverified:{background:'#f3f4f6',borderRadius:12,padding:12,color:'#6b7280',fontSize:12},code:{fontSize:10,color:'#6b7280'},body:{color:'#626b7b',fontSize:12,lineHeight:1.55},muted:{color:'#6b7280'},error:{color:'#b91c1c'}}
