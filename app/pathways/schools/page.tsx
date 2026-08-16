'use client'

import type { CSSProperties } from 'react'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

type SchoolResult = { school_id:string; school_name:string; county:string|null; sub_county:string|null; school_category:string|null; ownership_type:string|null; gender_type:string|null; accommodation_type:string|null; cluster:string|null; knec_code:string|null; pathway_slug:string|null; pathway_name:string|null; combination_slug:string|null; combination_name:string|null; offering_verified_at:string|null }

export default function PathwaysSchoolsPage() {
  const [query,setQuery] = useState('')
  const [county,setCounty] = useState('')
  const [pathway,setPathway] = useState('')
  const [rows,setRows] = useState<SchoolResult[]>([])
  const [loading,setLoading] = useState(true)
  const [error,setError] = useState('')

  async function runSearch(pathwayOverride?:string) {
    setLoading(true); setError('')
    const requestedPathway = pathwayOverride ?? pathway
    const {data,error:rpcError} = await supabase.rpc('pathways_search_public_schools',{
      p_query:query.trim()||null,p_county:county.trim()||null,p_pathway_slug:requestedPathway||null,p_combination_slug:null,p_limit:40,
    })
    if (rpcError) { setRows([]); setError('School discovery is not available yet on this release.'); setLoading(false); return }
    setRows((data??[]) as SchoolResult[]); setLoading(false)
  }

  useEffect(()=>{
    const initialPathway = new URLSearchParams(window.location.search).get('pathway') ?? ''
    setPathway(initialPathway)
    void runSearch(initialPathway)
    // Initial search intentionally uses only the URL-provided pathway.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[])

  return <main style={S.root}><div style={S.shell}>
    <Link href="/pathways" style={S.back}>← Pathways</Link>
    <p style={S.kicker}>SOURCE-AWARE SCHOOL DISCOVERY</p><h1 style={S.h1}>Find Senior Schools without turning guesses into facts.</h1>
    <p style={S.lead}>A school can appear here as an active canonical VibeSchool school. A pathway badge appears only when a separate school-offering record has been source-verified. No badge means “not verified here yet”, not “the school does not offer it”.</p>
    <form onSubmit={e=>{e.preventDefault();void runSearch()}} style={S.filters}>
      <label style={S.label}>School name<input value={query} onChange={e=>setQuery(e.target.value)} placeholder="e.g. Alliance" style={S.input}/></label>
      <label style={S.label}>County<input value={county} onChange={e=>setCounty(e.target.value)} placeholder="e.g. Kiambu" style={S.input}/></label>
      <label style={S.label}>Pathway<select value={pathway} onChange={e=>setPathway(e.target.value)} style={S.input}><option value="">Any pathway</option><option value="stem">STEM</option><option value="social-sciences">Social Sciences</option><option value="arts-and-sports-science">Arts & Sports Science</option></select></label>
      <button type="submit" style={S.button} disabled={loading}>{loading?'Checking…':'Search'}</button>
    </form>
    {error&&<div role="alert" style={S.error}>{error}</div>}
    {!loading&&!error&&rows.length===0&&<div style={S.empty}><strong>No matching verified result yet.</strong><p style={S.body}>Try removing the pathway or county filter. VibeSchool does not infer missing school offerings from names, marketing pages or incomplete directory records.</p></div>}
    <div style={S.list}>{rows.map(row=><article key={`${row.school_id}:${row.pathway_slug??'school'}:${row.combination_slug??''}`} style={S.card}>
      <div style={S.cardTop}><div><h2 style={S.school}>{row.school_name}</h2><p style={S.meta}>{[row.sub_county,row.county].filter(Boolean).join(', ')||'Location not published'}{row.knec_code?` · KNEC ${row.knec_code}`:''}</p></div>{row.pathway_name?<span style={S.verified}>✓ {row.pathway_name} verified</span>:<span style={S.unverified}>Offering not yet verified</span>}</div>
      <div style={S.chips}>{[row.school_category,row.gender_type,row.accommodation_type,row.cluster].filter((value):value is string=>Boolean(value)).map(value=><span key={value} style={S.chip}>{value}</span>)}</div>
      {row.combination_name&&<p style={S.body}><strong>Verified combination:</strong> {row.combination_name}</p>}
      {row.offering_verified_at&&<p style={S.audit}>Offering evidence verified {new Date(row.offering_verified_at).toLocaleDateString('en-KE')}</p>}
    </article>)}</div>
  </div></main>
}

const S:Record<string,CSSProperties>={root:{minHeight:'100dvh',background:'#f7f7fb',color:'#111827',padding:'24px 16px 60px'},shell:{maxWidth:860,margin:'0 auto'},back:{display:'inline-block',marginBottom:28,color:'#4f46e5',fontWeight:800,fontSize:13,textDecoration:'none'},kicker:{fontSize:10,fontWeight:900,letterSpacing:'.16em',color:'#4f46e5'},h1:{fontSize:'clamp(32px,6vw,50px)',lineHeight:1.06,letterSpacing:'-.04em',margin:'8px 0 12px'},lead:{maxWidth:760,color:'#5f6878',fontSize:14,lineHeight:1.65},filters:{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(170px,1fr))',gap:10,alignItems:'end',background:'#fff',border:'1px solid #e2e4ea',borderRadius:18,padding:14,margin:'24px 0'},label:{display:'grid',gap:6,fontSize:10,fontWeight:850,color:'#5f6878'},input:{width:'100%',boxSizing:'border-box',border:'1px solid #d9dce5',borderRadius:10,padding:'11px 12px',background:'#fff',color:'#111827',fontSize:13},button:{border:0,borderRadius:10,padding:'12px 14px',background:'#4f46e5',color:'#fff',fontWeight:850,cursor:'pointer'},error:{background:'#fff1f2',border:'1px solid #fecdd3',color:'#9f1239',borderRadius:14,padding:14},empty:{background:'#fff',border:'1px solid #e5e7eb',borderRadius:17,padding:18},list:{display:'grid',gap:10},card:{background:'#fff',border:'1px solid #e2e4ea',borderRadius:18,padding:17},cardTop:{display:'flex',gap:12,justifyContent:'space-between',alignItems:'flex-start',flexWrap:'wrap'},school:{margin:0,fontSize:18},meta:{margin:'5px 0 0',color:'#737b89',fontSize:11},verified:{background:'#ecfdf5',color:'#047857',border:'1px solid #a7f3d0',borderRadius:999,padding:'7px 10px',fontSize:10,fontWeight:850},unverified:{background:'#f8fafc',color:'#64748b',border:'1px solid #e2e8f0',borderRadius:999,padding:'7px 10px',fontSize:10,fontWeight:800},chips:{display:'flex',flexWrap:'wrap',gap:6,marginTop:12},chip:{background:'#f3f4f6',borderRadius:999,padding:'5px 8px',fontSize:9,color:'#596171'},body:{color:'#626b7b',fontSize:12,lineHeight:1.55},audit:{color:'#7c8494',fontSize:9,marginBottom:0}}
