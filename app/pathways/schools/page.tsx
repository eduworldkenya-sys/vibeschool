'use client'

import type { CSSProperties } from 'react'
import Link from 'next/link'
import { FormEvent, useEffect, useRef, useState } from 'react'
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
  const [suggestions,setSuggestions]=useState<SchoolRow[]>([])
  const [suggestOpen,setSuggestOpen]=useState(false)
  const [suggestLoading,setSuggestLoading]=useState(false)
  const [loading,setLoading]=useState(true)
  const [error,setError]=useState('')
  const suggestRequest=useRef(0)

  async function searchSchools(searchQuery=query){
    setLoading(true);setError('');setSuggestOpen(false)
    const {data,error}=await supabase.rpc('pathways_search_public_schools',{p_query:searchQuery||null,p_county:county||null,p_pathway_slug:pathway||null,p_combination_slug:null,p_limit:30})
    if(error){setError('Verified school information could not be loaded right now.');setRows([])}
    else setRows((data??[]) as SchoolRow[])
    setLoading(false)
  }

  useEffect(()=>{void searchSchools('')},[])

  useEffect(()=>{
    const term=query.trim()
    if(term.length<2){setSuggestions([]);setSuggestOpen(false);setSuggestLoading(false);return}
    const requestId=++suggestRequest.current
    setSuggestLoading(true)
    const timer=window.setTimeout(()=>{
      void (async()=>{
        const {data,error}=await supabase.rpc('pathways_search_public_schools',{p_query:term,p_county:county||null,p_pathway_slug:pathway||null,p_combination_slug:null,p_limit:8})
        if(requestId!==suggestRequest.current)return
        setSuggestLoading(false)
        if(error){setSuggestions([]);setSuggestOpen(false);return}
        const unique=new Map<string,SchoolRow>()
        for(const row of (data??[]) as SchoolRow[]) if(!unique.has(row.school_id)) unique.set(row.school_id,row)
        const next=Array.from(unique.values()).slice(0,8)
        setSuggestions(next)
        setSuggestOpen(next.length>0)
      })()
    },250)
    return()=>window.clearTimeout(timer)
  },[query,county,pathway])

  function submit(e:FormEvent){e.preventDefault();void searchSchools()}
  function chooseSuggestion(school:SchoolRow){
    setQuery(school.school_name)
    setSuggestions([])
    setSuggestOpen(false)
    void searchSchools(school.school_name)
  }

  return <main style={S.root}><div style={S.shell}>
    <header style={S.top}><Link href="/pathways" style={S.back}>← Pathways</Link><Link href="/" style={S.brand}>VibeSchool</Link></header>
    <p style={S.kicker}>VERIFIED SENIOR SCHOOL DISCOVERY</p>
    <h1 style={S.h1}>Explore schools with clear evidence boundaries.</h1>
    <p style={S.lead}>Start typing a school name and VibeSchool will suggest matching canonical schools. When you filter by a pathway, results only include schools whose pathway offering has been verified.</p>

    <form onSubmit={submit} style={S.form} aria-label="Search verified senior schools">
      <label style={{...S.field,...S.schoolField}}><span style={S.label}>School</span><div style={S.autocomplete}>
        <input value={query} onChange={e=>setQuery(e.target.value)} onFocus={()=>suggestions.length>0&&setSuggestOpen(true)} onBlur={()=>window.setTimeout(()=>setSuggestOpen(false),120)} placeholder="Start typing a school name" autoComplete="off" role="combobox" aria-autocomplete="list" aria-expanded={suggestOpen} aria-controls="school-suggestions" style={S.input}/>
        {query.trim().length>=2&&suggestLoading&&<span style={S.suggestStatus}>Finding schools…</span>}
        {suggestOpen&&<div id="school-suggestions" role="listbox" aria-label="Matching schools" style={S.suggestions}>{suggestions.map(s=><button key={s.school_id} type="button" role="option" onMouseDown={e=>e.preventDefault()} onClick={()=>chooseSuggestion(s)} style={S.suggestion}><strong style={S.suggestionName}>{s.school_name}</strong><span style={S.suggestionMeta}>{[s.county,s.sub_county,s.knec_code?`KNEC ${s.knec_code}`:null].filter(Boolean).join(' · ')}</span></button>)}</div>}
      </div></label>
      <label style={S.field}><span style={S.label}>County</span><input value={county} onChange={e=>setCounty(e.target.value)} placeholder="e.g. Nairobi" style={S.input}/></label>
      <label style={S.field}><span style={S.label}>Pathway</span><select value={pathway} onChange={e=>setPathway(e.target.value)} style={S.input}><option value="">Any pathway</option><option value="stem">STEM</option><option value="social-sciences">Social Sciences</option><option value="arts-and-sports-science">Arts & Sports Science</option></select></label>
      <button style={S.button} disabled={loading}>{loading?'Searching…':'Search schools'}</button>
    </form>

    <div style={S.notice}><strong>Important:</strong> if a pathway-filtered school does not appear, that means VibeSchool has not verified that offering here yet. It does <em>not</em> mean the school definitely does not offer it.</div>

    {loading&&<div style={S.state}><strong>Checking verified school information…</strong><span style={S.body}>This can take a moment on a slow connection.</span></div>}
    {error&&<div role="alert" style={S.error}><strong>We could not load school information.</strong><span>Try again. No school or pathway claim has been changed.</span></div>}
    {!loading&&!error&&rows.length===0&&<div style={S.state}><strong>No verified match found.</strong><span style={S.body}>Try removing a filter or searching a broader area. Missing evidence is shown as unknown rather than guessed.</span></div>}

    {!loading&&!error&&rows.length>0&&<div style={S.resultHeader}><strong>{rows.length} verified result{rows.length===1?'':'s'}</strong><span>Showing up to 30 matches</span></div>}
    <div style={S.list}>{rows.map(r=><article key={`${r.school_id}-${r.combination_slug??'school'}`} style={S.card}><div style={S.cardTop}><div><h2 style={S.name}>{r.school_name}</h2><p style={S.meta}>{[r.county,r.sub_county].filter(Boolean).join(' · ')}</p></div>{r.pathway_slug&&<span style={S.badge}>Verified offering</span>}</div><p style={S.meta}>{[r.school_category,r.gender_type,r.accommodation_type].filter(Boolean).join(' · ')}</p>{r.pathway_slug?<div style={S.verified}><strong>{r.pathway_name}</strong>{r.combination_name&&<span>{r.combination_name}</span>}{r.verified_at&&<small>Evidence verified {new Date(r.verified_at).toLocaleDateString()}</small>}</div>:<div style={S.unverified}><strong>Offering not yet verified</strong><span>VibeSchool has a canonical school record, but no verified pathway claim is being made here.</span></div>}{r.knec_code&&<p style={S.code}>KNEC code: {r.knec_code}</p>}</article>)}</div>

    <footer style={S.footer}><Link href="/pathways/check" style={S.footerLink}>Check my direction</Link><Link href="/learn/careers" style={S.footerLink}>Explore careers</Link><Link href="/contact" style={S.footerLink}>Report incorrect information</Link></footer>
  </div></main>
}

const S:Record<string,CSSProperties>={root:{minHeight:'100dvh',background:'#f7f7fb',color:'#111827',padding:'18px 16px 60px'},shell:{maxWidth:940,margin:'0 auto'},top:{minHeight:48,display:'flex',alignItems:'center',justifyContent:'space-between',gap:16},back:{color:'#4f46e5',textDecoration:'none',fontWeight:850,fontSize:13},brand:{color:'#111827',textDecoration:'none',fontWeight:900,fontSize:14},kicker:{marginTop:28,color:'#4f46e5',fontSize:10,fontWeight:900,letterSpacing:'.16em'},h1:{fontSize:'clamp(34px,6vw,52px)',lineHeight:1.03,letterSpacing:'-.04em',margin:'8px 0 14px',maxWidth:800},lead:{maxWidth:760,color:'#5b6475',fontSize:15,lineHeight:1.65},form:{display:'grid',gridTemplateColumns:'minmax(240px,1.3fr) minmax(160px,.8fr) minmax(180px,.9fr) auto',alignItems:'end',gap:10,margin:'26px 0 14px'},field:{display:'grid',gap:6},schoolField:{position:'relative'},label:{fontSize:11,fontWeight:850,color:'#4b5563'},autocomplete:{position:'relative'},input:{width:'100%',boxSizing:'border-box',minHeight:46,padding:'12px 13px',border:'1px solid #d8dae2',borderRadius:12,background:'#fff',fontSize:14,color:'#111827'},button:{minHeight:46,border:0,borderRadius:12,background:'#4f46e5',color:'#fff',fontWeight:850,padding:'12px 16px',cursor:'pointer'},suggestStatus:{position:'absolute',right:12,top:15,fontSize:10,color:'#6b7280',pointerEvents:'none'},suggestions:{position:'absolute',zIndex:20,top:'calc(100% + 6px)',left:0,right:0,background:'#fff',border:'1px solid #dfe2ea',borderRadius:14,boxShadow:'0 18px 40px rgba(17,24,39,.14)',overflow:'hidden',maxHeight:320,overflowY:'auto'},suggestion:{width:'100%',display:'grid',gap:4,textAlign:'left',padding:'12px 13px',border:0,borderBottom:'1px solid #f0f1f4',background:'#fff',cursor:'pointer'},suggestionName:{fontSize:13,color:'#111827'},suggestionMeta:{fontSize:10,color:'#6b7280',lineHeight:1.4},notice:{background:'#fffbeb',border:'1px solid #fde68a',borderRadius:14,padding:14,fontSize:12,lineHeight:1.6,color:'#66551a'},list:{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(280px,1fr))',gap:12,marginTop:16},card:{background:'#fff',border:'1px solid #e5e7eb',borderRadius:18,padding:18},cardTop:{display:'flex',alignItems:'flex-start',justifyContent:'space-between',gap:12},name:{fontSize:19,margin:'0 0 6px',lineHeight:1.25},meta:{fontSize:12,color:'#6b7280',lineHeight:1.5,margin:'4px 0'},badge:{whiteSpace:'nowrap',borderRadius:999,background:'#ecfdf5',color:'#065f46',padding:'6px 8px',fontSize:10,fontWeight:850},verified:{display:'grid',gap:4,background:'#ecfdf5',borderRadius:12,padding:12,color:'#065f46',fontSize:12,marginTop:12},unverified:{display:'grid',gap:4,background:'#f3f4f6',borderRadius:12,padding:12,color:'#6b7280',fontSize:12,marginTop:12},code:{fontSize:10,color:'#6b7280',marginBottom:0},body:{color:'#626b7b',fontSize:12,lineHeight:1.55},state:{display:'grid',gap:6,background:'#fff',border:'1px solid #e5e7eb',borderRadius:16,padding:18,marginTop:16},error:{display:'grid',gap:6,background:'#fef2f2',border:'1px solid #fecaca',borderRadius:16,padding:18,marginTop:16,color:'#991b1b'},resultHeader:{display:'flex',justifyContent:'space-between',gap:12,alignItems:'center',marginTop:20,color:'#374151',fontSize:12},footer:{display:'flex',gap:14,flexWrap:'wrap',borderTop:'1px solid #e2e2ea',marginTop:42,paddingTop:20},footerLink:{color:'#4f46e5',fontSize:12,fontWeight:800,textDecoration:'none'}}
