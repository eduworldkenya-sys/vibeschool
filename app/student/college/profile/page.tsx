'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useStudent } from '@/lib/student-context'
import { supabase } from '@/lib/supabase'

export default function CollegeProfile() {
  const { identity } = useStudent()
  const [signingOut,setSigningOut] = useState(false)
  const [error,setError] = useState('')
  const [study,setStudy] = useState<{programme_family:string;qualification_code:string;examining_body:string|null}|null>(null)
  useEffect(()=>{
    if(!identity?.profileId)return
    let active=true
    void supabase.from('learner_education_paths').select('programme_family,qualification_code,examining_body')
      .eq('user_id',identity.profileId).maybeSingle().then(({data,error:lookupError})=>{
        if(!active)return
        if(lookupError)setError('Could not load your study pathway.')
        else setStudy(data)
      })
    return()=>{active=false}
  },[identity?.profileId])
  async function signOut() {
    if (signingOut) return
    setSigningOut(true);setError('')
    try {
      const response = await fetch('/auth/logout', {method:'POST',credentials:'same-origin',cache:'no-store'})
      if (!response.ok) throw new Error('logout_failed')
      await supabase.auth.signOut({scope:'local'}).catch(() => undefined)
      document.cookie = 'vibe_role=; path=/; max-age=0'
      window.location.assign('/?role=student')
    } catch {
      setError('Could not sign out. Please retry.')
      setSigningOut(false)
    }
  }
  return <main style={{maxWidth:650,margin:'0 auto',padding:'12px 0 40px',display:'grid',gap:16}}>
    <Link href="/student/college" style={{color:'var(--vs-accent)',fontSize:13,fontWeight:750}}>← Study home</Link>
    <h1 style={{fontSize:26}}>My learner profile</h1>
    <section style={{border:'1px solid var(--vs-border)',borderRadius:18,padding:20,background:'var(--vs-card)',display:'grid',gap:14}}>
      <div><p style={{fontSize:12,color:'var(--vs-muted)'}}>Name</p><strong>{identity?.name || 'Learner'}</strong></div>
      <div><p style={{fontSize:12,color:'var(--vs-muted)'}}>Learning category</p><strong>{study?.programme_family === 'professional_studies' ? 'Professional Studies' : study?.programme_family === 'tvet' ? 'College / TVET' : study?.programme_family === 'university' ? 'University' : 'Post-secondary'}</strong></div>
      <div><p style={{fontSize:12,color:'var(--vs-muted)'}}>Programme</p><strong>{study ? `${study.qualification_code.replaceAll('_',' ')}${study.examining_body ? ` · ${study.examining_body}` : ''}` : 'Loading…'}</strong></div>
      <div><p style={{fontSize:12,color:'var(--vs-muted)'}}>Age and institution</p><span style={{fontSize:13}}>Can be completed later. No age has been assumed.</span></div>
      <div><p style={{fontSize:12,color:'var(--vs-muted)'}}>Username</p><span style={{fontSize:13}}>Optional. Your existing email login still works.</span></div>
    </section>
    {error && <p role="alert" style={{color:'var(--vs-error)'}}>{error}</p>}
    <button type="button" onClick={signOut} disabled={signingOut} style={{border:'1px solid var(--vs-border)',borderRadius:12,padding:14,background:'var(--vs-card)',color:'var(--vs-text)',fontWeight:700}}>
      {signingOut?'Signing out…':'Sign out'}
    </button>
  </main>
}
