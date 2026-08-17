'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { PublicHeader } from '@/components/public/PublicHeader'
import { PublicFooter } from '@/components/public/PublicFooter'

type Career = { id:string; slug:string; name:string; summary:string|null }
type CareerLink = { career_id:string; pathway_id:string; relationship_type:string|null; explanation:string|null }
type Pathway = { id:string; slug:string; name:string }
type CareerView = Career & { pathways:Array<{slug:string;name:string;relationship:string|null;explanation:string|null}> }

function CompassIcon(){return <svg aria-hidden="true" viewBox="0 0 24 24" width="24" height="24"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="1.7"/><path d="m15.5 8.5-2.2 5-4.8 2 2.1-5 4.9-2Z" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round"/></svg>}

export default function CareersPage() {
  const [careers,setCareers]=useState<CareerView[]>([])
  const [query,setQuery]=useState('')
  const [pathway,setPathway]=useState('')
  const [loading,setLoading]=useState(true)
  const [error,setError]=useState('')

  useEffect(()=>{
    let cancelled=false
    void (async()=>{
      setLoading(true);setError('')
      const [careerResult,linkResult,pathwayResult]=await Promise.all([
        supabase.from('pathway_careers').select('id,slug,name,summary').eq('status','published').eq('verification_state','verified').order('name'),
        supabase.from('pathway_career_links').select('career_id,pathway_id,relationship_type,explanation').eq('verification_state','verified'),
        supabase.from('pathways').select('id,slug,name').eq('status','published').eq('verification_state','verified'),
      ])
      if(cancelled)return
      if(careerResult.error||linkResult.error||pathwayResult.error){setError('Career information could not be loaded right now. Please try again.');setCareers([]);setLoading(false);return}
      const paths=new Map((pathwayResult.data as Pathway[]|null)?.map(p=>[p.id,p])??[])
      const linksByCareer=new Map<string,CareerLink[]>()
      for(const link of (linkResult.data??[]) as CareerLink[]){const current=linksByCareer.get(link.career_id)??[];current.push(link);linksByCareer.set(link.career_id,current)}
      const rows=((careerResult.data??[]) as Career[]).map(c=>({...c,pathways:(linksByCareer.get(c.id)??[]).map(link=>{const p=paths.get(link.pathway_id);return p?{slug:p.slug,name:p.name,relationship:link.relationship_type,explanation:link.explanation}:null}).filter((x):x is NonNullable<typeof x>=>Boolean(x))}))
      setCareers(rows);setLoading(false)
    })()
    return()=>{cancelled=true}
  },[])

  const availablePathways=useMemo(()=>Array.from(new Map(careers.flatMap(c=>c.pathways).map(p=>[p.slug,p.name])).entries()).sort((a,b)=>a[1].localeCompare(b[1])),[careers])
  const filtered=useMemo(()=>{
    const q=query.trim().toLowerCase()
    return careers.filter(c=>(!q||c.name.toLowerCase().includes(q)||(c.summary??'').toLowerCase().includes(q))&&(!pathway||c.pathways.some(p=>p.slug===pathway)))
  },[careers,query,pathway])

  return <div className="page"><PublicHeader product="Careers"/><main id="main-content"><section className="hero"><div className="wrap"><p className="eyebrow">CAREER EXPLORATION · PATHWAYS</p><h1>Explore careers without pretending one choice decides your future.</h1><p className="lead">Start with a career that interests you, see which Senior School pathway has a verified relationship to it, and keep comparing. VibeSchool treats career exploration as guidance—not placement or a promise of employment.</p><div className="actions"><Link href="/pathways/check" className="primary">Check my direction</Link><Link href="/pathways/subjects" className="secondary">Explore subjects</Link></div></div></section>

  <section className="section wrap" aria-labelledby="career-list"><div className="heading"><div><p className="eyebrow dark">VERIFIED CAREER CATALOGUE</p><h2 id="career-list">Find a direction to investigate.</h2></div><p>Only published career records and verified Pathways relationships are shown here. Missing information means VibeSchool has not verified it here—not that the career or relationship does not exist.</p></div>
    <div className="filters"><label><span>Search careers</span><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="e.g. engineer, teacher, designer"/></label><label><span>Pathway</span><select value={pathway} onChange={e=>setPathway(e.target.value)}><option value="">All verified pathways</option>{availablePathways.map(([slug,name])=><option value={slug} key={slug}>{name}</option>)}</select></label></div>
    {loading&&<div className="state" role="status"><strong>Loading verified careers…</strong><span>This may take a moment on a slow connection.</span></div>}
    {error&&<div className="state error" role="alert"><strong>We could not load careers.</strong><span>{error}</span><button type="button" onClick={()=>location.reload()}>Try again</button></div>}
    {!loading&&!error&&filtered.length===0&&<div className="state"><strong>No verified match for this search.</strong><span>Try a broader word or remove the pathway filter. VibeSchool will not invent a career link to fill an empty result.</span></div>}
    {!loading&&!error&&filtered.length>0&&<div className="grid">{filtered.map(c=><article key={c.id} className="card"><div className="icon"><CompassIcon/></div><h3>{c.name}</h3><p>{c.summary||'A published career in VibeSchool’s verified Pathways catalogue.'}</p>{c.pathways.length>0?<div className="pathways"><span>VERIFIED PATHWAY RELATIONSHIP</span>{c.pathways.map(p=><div key={p.slug}><strong>{p.name}</strong>{p.explanation&&<small>{p.explanation}</small>}</div>)}</div>:<div className="unlinked">No verified pathway relationship is published here yet.</div>}<Link href="/pathways/check">Compare with my direction →</Link></article>)}</div>}
  </section>

  <section className="trust"><div className="wrap"><div><p className="eyebrow">WHAT THIS DOES NOT MEAN</p><h2>A career card is a starting point, not a verdict.</h2></div><div><p>Interests change. Careers can be reached through more than one educational route. School offerings and official requirements can also change. Use VibeSchool to understand options, then verify consequential decisions with the relevant school or education authority.</p><Link href="/trust">How VibeSchool handles guidance →</Link></div></div></section>
  </main><PublicFooter/><style jsx>{styles}</style></div>
}

const styles=`.page{background:#f8f8f5;color:#111827;font-family:var(--font-jakarta),Arial,sans-serif;line-height:1.65}.page *{box-sizing:border-box}.wrap{width:min(1080px,100%);margin:auto}.hero{padding:78px 20px 82px;background:#07111f;color:#fff}.eyebrow{margin:0;font:850 11px var(--font-mono),monospace;letter-spacing:.15em;color:#d0b154}.eyebrow.dark{color:#755b17}h1,h2{font-family:var(--font-display),Arial,sans-serif;letter-spacing:-.04em;line-height:1.05}h1{max-width:850px;font-size:clamp(40px,6vw,68px);margin:14px 0 22px}.lead{max-width:760px;color:#c6cfda;font-size:18px}.actions{display:flex;gap:10px;flex-wrap:wrap;margin-top:24px}.actions a{min-height:46px;display:inline-flex;align-items:center;padding:0 16px;border-radius:10px;text-decoration:none;font-weight:850}.primary{background:#d0b154;color:#07111f}.secondary{border:1px solid #596879;color:#fff}.section{padding:72px 20px}.heading{display:grid;grid-template-columns:1fr 1fr;gap:50px;align-items:end}.heading h2,.trust h2{font-size:clamp(30px,4vw,46px);margin:8px 0}.heading>p{color:#626b76}.filters{display:grid;grid-template-columns:2fr 1fr;gap:12px;margin:32px 0}.filters label{display:grid;gap:7px;font-size:12px;font-weight:850;color:#4b5563}.filters input,.filters select{width:100%;min-height:48px;border:1px solid #d8dce1;border-radius:11px;background:#fff;padding:0 13px;font:inherit;color:#111827}.filters input:focus-visible,.filters select:focus-visible,button:focus-visible,a:focus-visible{outline:3px solid #a98628;outline-offset:2px}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:14px}.card{display:flex;flex-direction:column;min-height:310px;border:1px solid #dfe2e5;border-radius:16px;background:#fff;padding:23px}.icon{width:42px;height:42px;display:grid;place-items:center;border-radius:12px;background:#eeeaf7;color:#594a7d}.card h3{font-size:22px;margin:16px 0 7px}.card>p{margin:0;color:#606a76;font-size:14px}.pathways{display:grid;gap:7px;margin-top:18px}.pathways>span{font-size:9px;letter-spacing:.13em;font-weight:900;color:#755b17}.pathways div{display:grid;gap:2px;padding:9px 11px;border-radius:9px;background:#f4f3ee}.pathways small{color:#626b76;line-height:1.45}.unlinked{margin-top:18px;padding:10px;border-radius:9px;background:#f3f4f6;color:#656d78;font-size:12px}.card>a{margin-top:auto;padding-top:20px;color:#655016;font-weight:850;text-decoration:none;font-size:13px}.state{display:grid;gap:6px;margin:22px 0;padding:22px;border:1px solid #dfe2e5;border-radius:14px;background:#fff}.state span{color:#636c78}.state button{width:max-content;min-height:44px;border:0;border-radius:9px;background:#111827;color:#fff;padding:0 15px;font-weight:800;cursor:pointer}.error{border-color:#e7c5c5}.trust{background:#13243a;color:#fff;padding:66px 20px}.trust>.wrap{display:grid;grid-template-columns:1fr 1fr;gap:52px}.trust p{color:#c5ced8}.trust a{color:#e3c86f;font-weight:850;text-decoration:none}@media(max-width:720px){.hero{padding:62px 18px}.section{padding:58px 18px}.heading,.trust>.wrap,.filters{grid-template-columns:1fr}.heading{gap:8px}.trust{padding:54px 18px}.grid{grid-template-columns:1fr}}`
