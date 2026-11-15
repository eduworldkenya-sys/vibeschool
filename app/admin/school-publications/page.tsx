'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { getAdminSchoolAuthority } from '@/lib/admin/authority'
import { supabase } from '@/lib/supabase'
import { schoolUrl } from '@/lib/school-urls'
import SchoolPublicContent from '@/app/schools/components/SchoolPublicContent'

export default function SchoolAdminPublicationsPage() {
  const [slug,setSlug]=useState<string|null>(null)
  const [loading,setLoading]=useState(true)
  const [error,setError]=useState('')
  useEffect(()=>{
    let active=true
    void(async()=>{
      try {
        const authority=await getAdminSchoolAuthority()
        const {data,error:lookupError}=await supabase.rpc('schools_resolve_url_public_v1',{
          p_slug:null,p_school_id:authority.schoolId,p_directory_id:null
        })
        if(!active)return
        if(lookupError||!data?.[0]?.slug)throw Error('The school public home could not be resolved.')
        setSlug(data[0].slug)
      } catch(cause) {
        if(active)setError(cause instanceof Error?cause.message:'School publishing is unavailable.')
      } finally {
        if(active)setLoading(false)
      }
    })()
    return()=>{active=false}
  },[])
  return <main style={{maxWidth:950,margin:'auto',padding:'24px 14px 70px'}}>
    <Link href="/admin" style={{color:'#087451'}}>School operations</Link>
    <h1 style={{fontSize:26,margin:'14px 0 6px'}}>Public school information</h1>
    <p style={{fontSize:13,color:'#5d7080'}}>Publish verified news, fee notices, uniforms, admissions and contacts. Private messages remain in School Communications.</p>
    {loading&&<p role="status">Loading school…</p>}
    {error&&<p role="alert">{error}</p>}
    {slug&&<><p><Link href={schoolUrl(slug)} style={{color:'#087451'}}>View public school page</Link></p>
      <SchoolPublicContent slug={slug}/>
    </>}
  </main>
}
