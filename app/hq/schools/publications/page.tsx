'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { hqSupabase } from '@/lib/hq/supabase'
import { HQPage, HQPanel } from '@/components/hq/HQShell'
import SchoolPublicBoard from '@/app/schools/components/SchoolPublicBoard'
import { schoolUrl } from '@/lib/school-urls'

type Match = {slug:string;school_name:string;source_kind:string;source_id:string}

export default function HQSchoolPublications() {
  const params = useSearchParams()
  const [query, setQuery] = useState('')
  const [matches, setMatches] = useState<Match[]>([])
  const [school, setSchool] = useState<Match | null>(null)
  const [error, setError] = useState('')
  const slug = params.get('school') || ''

  useEffect(() => {
    let active = true
    setSchool(null)
    if (!slug) return
    void hqSupabase.rpc('schools_resolve_url_public_v1', { p_slug: slug }).then(({ data, error: e }: { data: unknown; error: unknown }) => {
      if (!active) return
      const found = ((data ?? []) as Match[])[0]
      if (e || !found) { setError('School not found.'); return }
      setError('')
      setSchool(found)
    })
    return () => { active = false }
  }, [slug])

  useEffect(() => {
    if (query.trim().length < 2) { setMatches([]); return }
    let active = true
    const timer = setTimeout(() => {
      void hqSupabase.rpc('schools_search_urls_public_v2', {
        p_query: query.trim(), p_county: null, p_sub_county: null, p_level: null, p_limit: 15,
      }).then(({ data, error: e }: { data: unknown; error: unknown }) => {
        if (active) setMatches(e ? [] : ((data ?? []) as Match[]))
      })
    }, 200)
    return () => { active = false; clearTimeout(timer) }
  }, [query])

  return <HQPage title="School public pages" description="Publish public school information with clear school or VibeSchool attribution. Private notices remain in VibeConnect.">
    <HQPanel title="Choose a school">
      <Link href="/hq/schools">Schools overview</Link>
      <label style={{ display: 'grid', gap: 7, marginTop: 15, maxWidth: 560, fontSize: 13 }}>
        Search schools
        <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search by school name"
          style={{ width: '100%', minHeight: 44, padding: 12, borderRadius: 10, border: '1px solid var(--vs-border,#ddd)' }}/>
      </label>
      {matches.length > 0 && <div style={{ display: 'grid', gap: 5, marginTop: 12 }}>
        {matches.map(item => <Link key={item.slug} href={'/hq/schools/publications?school=' + encodeURIComponent(item.slug)}
          style={{ padding: 10, borderRadius: 8, border: '1px solid var(--vs-border,#ddd)' }}>{item.school_name}</Link>)}
      </div>}
    </HQPanel>
    {error && <p role="alert">{error}</p>}
    {school && <HQPanel title={school.school_name}>
      <p><Link target="_blank" href={schoolUrl(school.slug)}>View public school home</Link></p>
      <SchoolPublicBoard slug={school.slug} schoolId={school.source_kind === 'canonical' ? school.source_id : undefined}/>
    </HQPanel>}
  </HQPage>
}
