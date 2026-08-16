import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { SupabaseClient } from '@supabase/supabase-js'
import { getSupabaseServerClient } from '@/lib/supabaseServer'

const SITE_URL = 'https://www.vibeschool.co.ke'

type Pathway = {
  id:string
  slug:string
  name:string
  short_name:string|null
  plain_language_summary:string
  source_id:string
  updated_at:string
}

type Source = {
  source_name:string
  source_url:string|null
  source_reference:string|null
  observed_at:string
  effective_from:string|null
  effective_to:string|null
}

// These tables are introduced by this PR's migrations, so the generated
// production Database type cannot contain them until the migration lands and
// types are regenerated. Keep the untyped boundary local to these new reads;
// the returned rows are narrowed immediately to the explicit domain types.
function getPathwaysClient(): SupabaseClient<any> {
  return getSupabaseServerClient() as SupabaseClient<any>
}

async function getPathway(slug:string):Promise<{pathway:Pathway;source:Source|null}|null>{
  const supabase=getPathwaysClient()
  const {data:pathway,error}=await supabase.from('pathways').select('id,slug,name,short_name,plain_language_summary,source_id,updated_at').eq('slug',slug).eq('status','published').maybeSingle()
  if(error||!pathway)return null
  const typedPathway=pathway as Pathway
  const {data:source}=await supabase.from('pathway_sources').select('source_name,source_url,source_reference,observed_at,effective_from,effective_to').eq('id',typedPathway.source_id).maybeSingle()
  return {pathway:typedPathway,source:(source as Source|null)??null}
}

export async function generateMetadata({params}:{params:{slug:string}}):Promise<Metadata>{
  const found=await getPathway(params.slug)
  if(!found)return {title:'Pathway not found'}
  const {pathway}=found
  const title=`${pathway.name} Pathway Kenya`
  const description=pathway.plain_language_summary||`Understand the ${pathway.name} Senior School pathway in Kenya with source-backed VibeSchool guidance.`
  return {title,description,alternates:{canonical:`${SITE_URL}/pathways/${pathway.slug}`},openGraph:{title,description,url:`${SITE_URL}/pathways/${pathway.slug}`,siteName:'VibeSchool',type:'article'}}
}

export default async function PathwayDetailPage({params}:{params:{slug:string}}){
  const found=await getPathway(params.slug)
  if(!found)notFound()
  const {pathway,source}=found
  const schema={
    '@context':'https://schema.org','@type':'EducationalOccupationalProgram',name:pathway.name,
    description:pathway.plain_language_summary,url:`${SITE_URL}/pathways/${pathway.slug}`,
    provider:{'@type':'EducationalOrganization',name:'VibeSchool',url:SITE_URL},
    ...(source?.source_url?{sameAs:source.source_url}:{})
  }
  return <main style={{minHeight:'100dvh',background:'#f7f7fb',color:'#111827',padding:'24px 16px 60px'}}><article style={{maxWidth:760,margin:'0 auto'}}>
    <script type="application/ld+json" dangerouslySetInnerHTML={{__html:JSON.stringify(schema)}}/>
    <Link href="/pathways" style={{color:'#4f46e5',fontSize:13,fontWeight:800,textDecoration:'none'}}>← Pathways</Link>
    <p style={{margin:'38px 0 8px',fontSize:10,fontWeight:900,letterSpacing:'.16em',color:'#725815'}}>KENYA SENIOR SCHOOL PATHWAY</p>
    <h1 style={{fontSize:'clamp(38px,7vw,64px)',lineHeight:1.02,letterSpacing:'-.045em',margin:0}}>{pathway.name}</h1>
    <p style={{fontSize:18,lineHeight:1.65,color:'#596171',margin:'20px 0 28px'}}>{pathway.plain_language_summary}</p>

    <section style={{background:'#fff',border:'1px solid #e2e4ea',borderRadius:18,padding:20,marginBottom:12}}>
      <h2 style={{fontSize:18,margin:'0 0 8px'}}>What VibeSchool can verify</h2>
      <p style={{fontSize:13,lineHeight:1.65,color:'#626b7b'}}>This page is generated from the published Pathways truth layer. Tracks, subject combinations, careers and school offerings are not inferred from this pathway name. They appear only when their own source-backed records have been published.</p>
      <div style={{display:'flex',flexWrap:'wrap',gap:9,marginTop:14}}><Link href={`/pathways/check`} style={{padding:'11px 14px',borderRadius:11,background:'#4f46e5',color:'#fff',fontSize:12,fontWeight:850,textDecoration:'none'}}>Check my direction</Link><Link href={`/pathways/schools?pathway=${encodeURIComponent(pathway.slug)}`} style={{padding:'10px 14px',borderRadius:11,border:'1px solid #d9dce5',color:'#3730a3',fontSize:12,fontWeight:850,textDecoration:'none'}}>Find verified schools</Link></div>
    </section>

    <section style={{background:'#fffbeb',border:'1px solid #fde68a',borderRadius:18,padding:18}}>
      <h2 style={{fontSize:15,margin:'0 0 8px'}}>Source and freshness</h2>
      {source?<><p style={{fontSize:12,lineHeight:1.6,color:'#6b5b27',margin:'0 0 5px'}}><strong>{source.source_name}</strong>{source.source_reference?` — ${source.source_reference}`:''}</p><p style={{fontSize:10,lineHeight:1.5,color:'#806d35',margin:0}}>Observed by VibeSchool: {new Date(source.observed_at).toLocaleDateString('en-KE')}. VibeSchool guidance is not an official placement decision.</p></>:<p style={{fontSize:12,color:'#806d35'}}>Source details are not currently available. No additional factual claim is being made here.</p>}
    </section>
  </article></main>
}
