'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'

/** Preserve the existing account and study records; do not allocate a false school grade. */
export default function LearningUnavailablePage() {
  const [busy,setBusy]=useState(false)
  const [error,setError]=useState(false)
  async function signOut() {
    if(busy)return
    setBusy(true);setError(false)
    try {
      const response=await fetch('/auth/logout',{method:'POST',credentials:'same-origin',cache:'no-store'})
      if(!response.ok)throw Error('logout_failed')
      await supabase.auth.signOut({scope:'local'}).catch(()=>undefined)
      window.location.assign('/login')
    } catch {setError(true);setBusy(false)}
  }
  return <main style={{minHeight:'100dvh',display:'grid',placeItems:'center',padding:24}}>
    <section style={{maxWidth:380,width:'100%',textAlign:'center',display:'grid',gap:16}}>
      <h1 style={{fontSize:24,margin:0}}>Learning access unavailable</h1>
      <p style={{margin:0}}>Your account and learning records are safe.</p>
      <button type="button" disabled={busy} onClick={()=>void signOut()} style={{minHeight:46,borderRadius:12,padding:'12px 20px',fontWeight:700}}>{busy?'Signing out…':'Sign out'}</button>
      {error && <p role="alert">Could not sign out. Please retry.</p>}
    </section>
  </main>
}
