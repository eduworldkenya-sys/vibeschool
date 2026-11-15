'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { hqSupabase } from '@/lib/hq/supabase'
import { HQPage, HQPanel } from '@/components/hq/HQShell'
import { schoolUrl, type PublicSchoolAddress } from '@/lib/school-urls'
import SchoolPublicContent from '@/app/schools/components/SchoolPublicContent'

export default function HqSchoolPublications() {
  const [query,setQuery]=useState('')
  const [rows,setRows]=useState<PublicSchoolAddress[]>([])
  const [selected,setSelected]=useState<PublicSchoolAddress|null>(null)
  const [permission,setPermission]=useState<'checking'|'allowed'|'denied'>('checking')
  const [loading,setLoading]=useState(false)
  const [error,setError]=useState('')
  useEffect(()=>{
    let active=true
    void(async()=>{
      const {data:{user}}=await hqSupabase.auth.getUser()
      if(!active)return
      if(!user){setPermission('denied');return}
      const {data,error}=await hqSupabase.rpc('hq_human_has_permission',{p_profile_id:user.id,p_permission:'schools.publish'})
      if(active)setPermission(!error&&data===true?'allowed':'denied')
    })()
    return()=>{active=false}
  },[])
  useEffect(()=>{
    if(permission!=='allowed'){setRows([]);return}
    let active=true
    const timer=setTimeout(async()=>{
      setLoading(true);setError('')
      const {data,error:searchError}=await hqSupabase.rpc('schools_search_urls_public_v2',{
        p_query:query.trim()||null,p_county:null,p_sub_county:null,p_level:null,p_limit:25
      })
      if(!active)return
      setRows(searchError?[]:(data??[]) as PublicSchoolAddress[])
      if(searchError)setError('Could not search schools.')
      setLoading(false)
    },query?220:0)
    return()=>{active=false;clearTimeout(timer)}
  },[query,permission])
  return <HQPage title="School publishing" description="Verified public information for Kenyan school homes. Private circulars remain in VibeConnect."
    actions={<Link href="/hq/schools" style={{color:'#93c5fd'}}>School network</Link>}>
    {permission==='checking'&&<HQPanel title="Checking publishing authority"><p>Checking access…</p></HQPanel>}
    {permission==='denied'&&<HQPanel title="Access restricted"><p>Only authorised HQ publishers may manage public school information.</p></HQPanel>}
    {permission==='allowed'&&<HQPanel title="Choose a school" description="Search the canonical directory; an official profile is never created from an unverified match.">
      <label style={{display:'grid',gap:6,maxWidth:650}}>Find school
        <input value={query} onChange={e=>setQuery(e.target.value)} type="search" placeholder="Search school name"
          style={{padding:12,borderRadius:10,border:'1px solid #648096',background:'#fff',color:'#102030',fontSize:15}}/>
      </label>
      {loading&&<p role="status">Searching…</p>}{error&&<p role="alert">{error}</p>}
      <div style={{display:'grid',gap:7,marginTop:12,maxHeight:260,overflowY:'auto'}}>
        {rows.map(s=><button key={s.slug} type="button" onClick={()=>setSelected(s)} style={{
          padding:12,borderRadius:10,border:selected?.slug===s.slug?'2px solid #22c55e':'1px solid #496078',
          background:selected?.slug===s.slug?'#163e38':'#0f2235',color:'white',textAlign:'left',cursor:'pointer'
        }}><strong>{s.school_name}</strong><small style={{display:'block',color:'#c2d2e0'}}>{s.county} · {s.source_kind==='directory'?'Directory listing':'Canonical school'}</small></button>)}
      </div>
    </HQPanel>}
    {permission==='allowed'&&selected&&<section style={{marginTop:16}}>
      <p><Link style={{color:'#93c5fd'}} href={schoolUrl(selected.slug)} target="_blank">View public school home</Link></p>
      <SchoolPublicContent key={selected.slug} slug={selected.slug}/>
    </section>}
  </HQPage>
}
