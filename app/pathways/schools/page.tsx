'use client'

import type { CSSProperties, FormEvent, KeyboardEvent } from 'react'
import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'

type SchoolRow = {
  school_id:string; school_name:string; county:string|null; sub_county:string|null; school_category:string|null;
  ownership_type:string|null; gender_type:string|null; accommodation_type:string|null; cluster:string|null; knec_code:string|null;
  pathway_slug:string|null; pathway_name:string|null; combination_slug:string|null; combination_name:string|null; verified_at:string|null;
  source_authority:string|null; source_name:string|null; source_url:string|null; source_reference:string|null; source_observed_at:string|null;
}

type MissingSchoolDraft = {
  name:string; county:string; subCounty:string; schoolCode:string; alternativeName:string; notes:string;
}

async function fetchPublicSchools(searchQuery:string, county:string, pathway:string, limit:number) {
  return supabase.rpc('pathways_search_public_schools_v2', {
    p_query:searchQuery.trim() || null,
    p_county:county.trim() || null,
    p_pathway_slug:pathway || null,
    p_combination_slug:null,
    p_limit:limit,
  })
}

function formatEvidenceDate(value:string|null) {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return new Intl.DateTimeFormat('en-KE',{day:'numeric',month:'short',year:'numeric',timeZone:'Africa/Nairobi'}).format(date)
}

export default function PathwaysSchoolsPage(){
  const [query,setQuery]=useState('')
  const [county,setCounty]=useState('')
  const [pathway,setPathway]=useState('')
  const [rows,setRows]=useState<SchoolRow[]>([])
  const [suggestions,setSuggestions]=useState<SchoolRow[]>([])
  const [suggestOpen,setSuggestOpen]=useState(false)
  const [suggestLoading,setSuggestLoading]=useState(false)
  const [activeSuggestion,setActiveSuggestion]=useState(-1)
  const [loading,setLoading]=useState(true)
  const [error,setError]=useState('')
  const [hasSearched,setHasSearched]=useState(false)
  const [recoveryOpen,setRecoveryOpen]=useState(false)
  const [recoverySaving,setRecoverySaving]=useState(false)
  const [recoveryError,setRecoveryError]=useState('')
  const [recoverySuccess,setRecoverySuccess]=useState('')
  const [missing,setMissing]=useState<MissingSchoolDraft>({name:'',county:'',subCounty:'',schoolCode:'',alternativeName:'',notes:''})
  const suggestRequest=useRef(0)

  useEffect(()=>{
    let cancelled=false
    void (async()=>{
      const {data,error}=await fetchPublicSchools('','','',30)
      if(cancelled)return
      if(error){setError('Verified school information could not be loaded right now.');setRows([])}
      else setRows((data??[]) as SchoolRow[])
      setLoading(false)
    })()
    return()=>{cancelled=true}
  },[])

  useEffect(()=>{
    const requestId=++suggestRequest.current
    const term=query.trim()
    setActiveSuggestion(-1)
    if(term.length<2){setSuggestions([]);setSuggestOpen(false);setSuggestLoading(false);return}
    setSuggestLoading(true)
    const timer=window.setTimeout(()=>{
      void (async()=>{
        const {data,error}=await fetchPublicSchools(term,county,pathway,8)
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

  async function searchSchools(searchQuery=query){
    setLoading(true);setError('');setSuggestOpen(false);setRecoverySuccess('');++suggestRequest.current
    const {data,error}=await fetchPublicSchools(searchQuery,county,pathway,30)
    if(error){setError('Verified school information could not be loaded right now.');setRows([])}
    else setRows((data??[]) as SchoolRow[])
    setHasSearched(true)
    setLoading(false)
  }

  function submit(e:FormEvent){e.preventDefault();void searchSchools()}
  function chooseSuggestion(school:SchoolRow){
    ++suggestRequest.current
    setQuery(school.school_name)
    setSuggestions([])
    setSuggestOpen(false)
    setActiveSuggestion(-1)
    setRecoveryOpen(false)
    void searchSchools(school.school_name)
  }

  function openRecovery(){
    setRecoveryError('');setRecoverySuccess('')
    setMissing(current=>({...current,name:query.trim()||current.name,county:county.trim()||current.county}))
    setRecoveryOpen(true)
  }

  async function submitMissingSchool(e:FormEvent){
    e.preventDefault();setRecoveryError('');setRecoverySuccess('')
    const name=missing.name.trim()
    if(name.length<3){setRecoveryError('Enter the school name as you know it.');return}
    setRecoverySaving(true)
    const {data:{user}}=await supabase.auth.getUser()
    if(!user){
      setRecoverySaving(false)
      setRecoveryError('Sign in first so VibeSchool can retain this request and prevent duplicate submissions.')
      return
    }
    const {data,error}=await supabase.rpc('submit_school_discovery_request',{
      p_name:name,
      p_county:missing.county.trim()||null,
      p_sub_county:missing.subCounty.trim()||null,
      p_ward:null,
      p_level:'SENIOR_SECONDARY',
      p_school_code:missing.schoolCode.trim()||null,
      p_lat:null,
      p_lng:null,
      p_alternative_name:missing.alternativeName.trim()||null,
      p_notes:missing.notes.trim()||null,
      p_contact_name:null,
      p_contact_phone:null,
    })
    setRecoverySaving(false)
    if(error){setRecoveryError('We could not save this school request right now. Please try again.');return}
    setRecoverySuccess(`Request ${String(data).slice(0,8)} received. We will reconcile it against existing schools and stronger evidence before any canonical school is created.`)
  }

  function handleSchoolKeyDown(e:KeyboardEvent<HTMLInputElement>){
    if(!suggestOpen||suggestions.length===0)return
    if(e.key==='ArrowDown'){
      e.preventDefault();setActiveSuggestion(current=>Math.min(current+1,suggestions.length-1))
    }else if(e.key==='ArrowUp'){
      e.preventDefault();setActiveSuggestion(current=>Math.max(current-1,0))
    }else if(e.key==='Enter'&&activeSuggestion>=0){
      e.preventDefault();chooseSuggestion(suggestions[activeSuggestion])
    }else if(e.key==='Escape'){
      setSuggestOpen(false);setActiveSuggestion(-1)
    }
  }

  const showRecovery=hasSearched&&!loading&&!error&&rows.length===0&&query.trim().length>=3

  return <main style={S.root}><div style={S.shell}>
    <header style={S.top}><Link href="/pathways" style={S.back}>← Pathways</Link><Link href="/" style={S.brand}>VibeSchool</Link></header>
    <p style={S.kicker}>SENIOR SCHOOL DISCOVERY</p>
    <h1 style={S.h1}>Explore schools with clear evidence boundaries.</h1>
    <p style={S.lead}>Start typing a school name and VibeSchool will suggest matching canonical schools. A pathway badge appears only when VibeSchool has a current, source-backed verified offering.</p>

    <form onSubmit={submit} style={S.form} aria-label="Search senior schools">
      <label style={{...S.field,...S.schoolField}}><span style={S.label}>School</span><div style={S.autocomplete}>
        <input value={query} onChange={e=>{setQuery(e.target.value);setRecoveryOpen(false);setHasSearched(false)}} onFocus={()=>suggestions.length>0&&setSuggestOpen(true)} onBlur={()=>window.setTimeout(()=>setSuggestOpen(false),120)} onKeyDown={handleSchoolKeyDown} placeholder="Start typing a school name" autoComplete="off" role="combobox" aria-autocomplete="list" aria-expanded={suggestOpen} aria-controls="school-suggestions" aria-activedescendant={activeSuggestion>=0?`school-suggestion-${activeSuggestion}`:undefined} style={S.input}/>
        {query.trim().length>=2&&suggestLoading&&<span style={S.suggestStatus}>Finding schools…</span>}
        {suggestOpen&&<div id="school-suggestions" role="listbox" aria-label="Matching schools" style={S.suggestions}>{suggestions.map((s,index)=><button id={`school-suggestion-${index}`} key={s.school_id} type="button" role="option" aria-selected={index===activeSuggestion} onMouseDown={e=>e.preventDefault()} onMouseEnter={()=>setActiveSuggestion(index)} onClick={()=>chooseSuggestion(s)} style={{...S.suggestion,...(index===activeSuggestion?S.suggestionActive:{})}}><strong style={S.suggestionName}>{s.school_name}</strong><span style={S.suggestionMeta}>{[s.county,s.sub_county,s.knec_code?`KNEC ${s.knec_code}`:null].filter(Boolean).join(' · ')}</span></button>)}</div>}
      </div></label>
      <label style={S.field}><span style={S.label}>County</span><input value={county} onChange={e=>{setCounty(e.target.value);setHasSearched(false)}} placeholder="e.g. Narok" style={S.input}/></label>
      <label style={S.field}><span style={S.label}>Pathway</span><select value={pathway} onChange={e=>{setPathway(e.target.value);setHasSearched(false)}} style={S.input}><option value="">Any pathway</option><option value="stem">STEM</option><option value="social-sciences">Social Sciences</option><option value="arts-and-sports-science">Arts & Sports Science</option></select></label>
      <button style={S.button} disabled={loading}>{loading?'Searching…':'Search schools'}</button>
    </form>

    <div style={S.notice}><strong>Evidence rule:</strong> a missing pathway claim means <em>not yet verified here</em>, not “No”. A missing school can be reported without creating an unverified canonical identity.</div>

    {loading&&<div style={S.state}><strong>Checking school information…</strong><span style={S.body}>This can take a moment on a slow connection.</span></div>}
    {error&&<div role="alert" style={S.error}><strong>We could not load school information.</strong><span>Try again. No school or pathway claim has been changed.</span></div>}
    {showRecovery&&<div style={S.state}><strong>No trusted match for “{query.trim()}”.</strong><span style={S.body}>Try removing a filter first. If the school is genuinely missing, send it for identity reconciliation instead of creating a duplicate or guessed school.</span><button type="button" onClick={openRecovery} style={S.secondaryButton}>Can’t find your school?</button></div>}

    {recoveryOpen&&<form onSubmit={submitMissingSchool} style={S.recovery} aria-label="Report a missing school">
      <div><strong style={S.recoveryTitle}>Report a missing school</strong><p style={S.body}>This creates a discovery request only. VibeSchool will check canonical schools, aliases, identifiers and stronger evidence before any promotion.</p></div>
      <div style={S.recoveryGrid}>
        <label style={S.field}><span style={S.label}>School name *</span><input value={missing.name} onChange={e=>setMissing({...missing,name:e.target.value})} style={S.input}/></label>
        <label style={S.field}><span style={S.label}>County</span><input value={missing.county} onChange={e=>setMissing({...missing,county:e.target.value})} placeholder="e.g. Narok" style={S.input}/></label>
        <label style={S.field}><span style={S.label}>Sub-county</span><input value={missing.subCounty} onChange={e=>setMissing({...missing,subCounty:e.target.value})} placeholder="e.g. Trans Mara East" style={S.input}/></label>
        <label style={S.field}><span style={S.label}>KNEC / NEMIS / MoE code</span><input value={missing.schoolCode} onChange={e=>setMissing({...missing,schoolCode:e.target.value})} placeholder="Optional — do not guess" style={S.input}/></label>
        <label style={S.field}><span style={S.label}>Alternative name</span><input value={missing.alternativeName} onChange={e=>setMissing({...missing,alternativeName:e.target.value})} placeholder="Optional spelling or former name" style={S.input}/></label>
        <label style={S.field}><span style={S.label}>Supporting detail</span><input value={missing.notes} onChange={e=>setMissing({...missing,notes:e.target.value})} placeholder="Zone, nearby town, official source, etc." style={S.input}/></label>
      </div>
      {recoveryError&&<div role="alert" style={S.error}>{recoveryError}{recoveryError.startsWith('Sign in')&&<span> <Link href="/login" style={S.inlineLink}>Sign in</Link> and return to submit.</span>}</div>}
      {recoverySuccess&&<div role="status" style={S.success}>{recoverySuccess}</div>}
      <div style={S.recoveryActions}><button type="button" onClick={()=>setRecoveryOpen(false)} style={S.ghostButton}>Cancel</button><button disabled={recoverySaving} style={S.button}>{recoverySaving?'Sending…':'Send for verification'}</button></div>
    </form>}

    {!loading&&!error&&rows.length>0&&<div style={S.resultHeader}><strong>{rows.length} school match{rows.length===1?'':'es'}</strong><span>Showing up to 30 matches</span></div>}
    <div style={S.list}>{rows.map(r=>{
      const verifiedDate=formatEvidenceDate(r.verified_at)
      const observedDate=formatEvidenceDate(r.source_observed_at)
      return <article key={`${r.school_id}-${r.combination_slug??r.pathway_slug??'school'}`} style={S.card}>
        <div style={S.cardTop}><div><h2 style={S.name}>{r.school_name}</h2><p style={S.meta}>{[r.county,r.sub_county].filter(Boolean).join(' · ')}</p></div><span style={S.canonicalBadge}>✓ Canonical school</span></div>
        <p style={S.meta}>{[r.school_category,r.gender_type,r.accommodation_type].filter(Boolean).join(' · ')}</p>
        {r.pathway_slug?<div style={S.verified}><div style={S.verifiedHead}><strong>✓ Verified offering</strong><span>{r.pathway_name}</span></div>{r.combination_name&&<span>{r.combination_name}</span>}{verifiedDate&&<small>Last verified: {verifiedDate}</small>}{r.source_authority&&<small>Evidence: {r.source_authority}</small>}
          <details style={S.details}><summary style={S.summary}>How do we verify this?</summary><div style={S.evidenceBody}><span>VibeSchool links this offering to a current verified claim and its public provenance record.</span>{r.source_name&&<span><strong>Source:</strong> {r.source_name}</span>}{r.source_reference&&<span><strong>Reference:</strong> {r.source_reference}</span>}{observedDate&&<span><strong>Observed:</strong> {observedDate}</span>}{r.source_url&&<a href={r.source_url} target="_blank" rel="noreferrer noopener" style={S.sourceLink}>View authoritative source ↗</a>}</div></details>
        </div>:<div style={S.unverified}><strong>? Not yet verified</strong><span>VibeSchool has a canonical school record, but it is not making a pathway-offering claim for this result.</span></div>}
        {r.knec_code&&<p style={S.code}>KNEC code: {r.knec_code}</p>}
      </article>
    })}</div>

    <footer style={S.footer}><Link href="/pathways/check" style={S.footerLink}>Check my direction</Link><Link href="/learn/careers" style={S.footerLink}>Explore careers</Link><Link href="/contact" style={S.footerLink}>Report incorrect information</Link></footer>
  </div></main>
}

const S:Record<string,CSSProperties>={
  root:{minHeight:'100dvh',background:'#f7f7fb',color:'#111827',padding:'18px 16px 60px'},shell:{maxWidth:940,margin:'0 auto'},top:{minHeight:48,display:'flex',alignItems:'center',justifyContent:'space-between',gap:16},back:{color:'#4f46e5',textDecoration:'none',fontWeight:850,fontSize:13},brand:{color:'#111827',textDecoration:'none',fontWeight:900,fontSize:14},kicker:{marginTop:28,color:'#4f46e5',fontSize:10,fontWeight:900,letterSpacing:'.16em'},h1:{fontSize:'clamp(34px,6vw,52px)',lineHeight:1.03,letterSpacing:'-.04em',margin:'8px 0 14px',maxWidth:800},lead:{maxWidth:760,color:'#5b6475',fontSize:15,lineHeight:1.65},form:{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(180px,1fr))',alignItems:'end',gap:10,margin:'26px 0 14px'},field:{display:'grid',gap:6,minWidth:0},schoolField:{position:'relative'},label:{fontSize:11,fontWeight:850,color:'#4b5563'},autocomplete:{position:'relative'},input:{width:'100%',boxSizing:'border-box',minHeight:46,padding:'12px 13px',border:'1px solid #d8dae2',borderRadius:12,background:'#fff',fontSize:14,color:'#111827'},button:{minHeight:46,border:0,borderRadius:12,background:'#4f46e5',color:'#fff',fontWeight:850,padding:'12px 16px',cursor:'pointer'},secondaryButton:{justifySelf:'start',minHeight:42,border:'1px solid #c7d2fe',borderRadius:12,background:'#eef2ff',color:'#3730a3',fontWeight:850,padding:'10px 14px',cursor:'pointer'},ghostButton:{minHeight:44,border:'1px solid #d1d5db',borderRadius:12,background:'#fff',color:'#374151',fontWeight:800,padding:'10px 14px',cursor:'pointer'},suggestStatus:{position:'absolute',right:12,top:15,fontSize:10,color:'#6b7280',pointerEvents:'none'},suggestions:{position:'absolute',zIndex:20,top:'calc(100% + 6px)',left:0,right:0,background:'#fff',border:'1px solid #dfe2ea',borderRadius:14,boxShadow:'0 18px 40px rgba(17,24,39,.14)',overflow:'hidden',maxHeight:320,overflowY:'auto'},suggestion:{width:'100%',display:'grid',gap:4,textAlign:'left',padding:'12px 13px',border:0,borderBottom:'1px solid #f0f1f4',background:'#fff',cursor:'pointer'},suggestionActive:{background:'#eef2ff'},suggestionName:{fontSize:13,color:'#111827'},suggestionMeta:{fontSize:10,color:'#6b7280',lineHeight:1.4},notice:{background:'#fffbeb',border:'1px solid #fde68a',borderRadius:14,padding:14,fontSize:12,lineHeight:1.6,color:'#66551a'},list:{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(280px,1fr))',gap:12,marginTop:16},card:{background:'#fff',border:'1px solid #e5e7eb',borderRadius:18,padding:18,minWidth:0},cardTop:{display:'flex',alignItems:'flex-start',justifyContent:'space-between',gap:12,flexWrap:'wrap'},name:{fontSize:19,margin:'0 0 6px',lineHeight:1.25},meta:{fontSize:12,color:'#6b7280',lineHeight:1.5,margin:'4px 0'},canonicalBadge:{whiteSpace:'nowrap',borderRadius:999,background:'#eef2ff',color:'#3730a3',padding:'6px 8px',fontSize:10,fontWeight:850},verified:{display:'grid',gap:6,background:'#ecfdf5',borderRadius:12,padding:12,color:'#065f46',fontSize:12,marginTop:12},verifiedHead:{display:'flex',justifyContent:'space-between',gap:10,flexWrap:'wrap'},unverified:{display:'grid',gap:4,background:'#f3f4f6',borderRadius:12,padding:12,color:'#6b7280',fontSize:12,marginTop:12},details:{marginTop:4,borderTop:'1px solid #bbf7d0',paddingTop:8},summary:{cursor:'pointer',fontWeight:800},evidenceBody:{display:'grid',gap:5,paddingTop:8,lineHeight:1.5},sourceLink:{color:'#065f46',fontWeight:850},code:{fontSize:10,color:'#6b7280',marginBottom:0},body:{color:'#626b7b',fontSize:12,lineHeight:1.55},state:{display:'grid',gap:10,background:'#fff',border:'1px solid #e5e7eb',borderRadius:16,padding:18,marginTop:16},error:{display:'grid',gap:6,background:'#fef2f2',border:'1px solid #fecaca',borderRadius:14,padding:14,color:'#991b1b',fontSize:12},success:{background:'#ecfdf5',border:'1px solid #a7f3d0',borderRadius:14,padding:14,color:'#065f46',fontSize:12,lineHeight:1.5},resultHeader:{display:'flex',justifyContent:'space-between',gap:12,alignItems:'center',marginTop:20,color:'#374151',fontSize:12,flexWrap:'wrap'},recovery:{display:'grid',gap:14,background:'#fff',border:'1px solid #c7d2fe',borderRadius:18,padding:18,marginTop:14},recoveryTitle:{fontSize:16},recoveryGrid:{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(220px,1fr))',gap:10},recoveryActions:{display:'flex',justifyContent:'flex-end',gap:10,flexWrap:'wrap'},inlineLink:{color:'#4f46e5',fontWeight:850},footer:{display:'flex',gap:14,flexWrap:'wrap',borderTop:'1px solid #e2e2ea',marginTop:42,paddingTop:20},footerLink:{color:'#4f46e5',fontSize:12,fontWeight:800,textDecoration:'none'}
}
