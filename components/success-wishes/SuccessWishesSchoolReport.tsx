'use client'

import { useEffect, useMemo, useState } from 'react'
import { HQPanel, HQ_THEME, hqButtonStyle } from '@/components/hq/HQShell'
import { hqSupabase } from '@/lib/hq/supabase'

type SchoolSummary = { name:string; cards:number; free:number; paid:number; senders:number; candidates:number; settledKes:number; latest:string }
const normalise = (name:string) => name.trim().replace(/\\s+/g,' ').toLocaleLowerCase()
const money = (n:number) => 'KSh ' + new Intl.NumberFormat('en-KE').format(n)

export default function SuccessWishesSchoolReport() {
  const [schools,setSchools] = useState<SchoolSummary[]>([])
  const [loaded,setLoaded] = useState(false)
  const [busy,setBusy] = useState(false)
  const [error,setError] = useState('')
  const [filter,setFilter] = useState('')
  async function load() {
    setBusy(true);setError('')
    try {
      const {data,error:authError}=await hqSupabase.auth.getSession()
      if(authError||!data.session?.access_token)throw Error('Sign in to HQ to view school reporting.')
      const response=await fetch('/api/hq/success-wishes-schools',{cache:'no-store',headers:{Authorization:'Bearer '+data.session.access_token}})
      const result=await response.json()
      if(!response.ok)throw Error(result.error||'School records unavailable.')
      setSchools(result.schools)
      setLoaded(true)
    }catch(reason){setError(reason instanceof Error?reason.message:'School records unavailable.')}
    finally{setBusy(false)}
  }
  useEffect(()=>{void load()},[])
  const summaries=useMemo(()=>schools.filter(s=>normalise(s.name).includes(normalise(filter))),[schools,filter])
  return <HQPanel title="Schools reached" description="Schools selected by senders, whether or not they participate in VibeSchool. These are reported associations, not verified partnerships.">
    <div style={{display:'flex',gap:10,flexWrap:'wrap',alignItems:'center',marginBottom:14}}>
      <button type="button" style={hqButtonStyle} disabled={busy} onClick={()=>void load()}>{busy?'Loading…':loaded?'Refresh schools':'Load schools'}</button>
      {loaded&&<span style={{color:HQ_THEME.muted,fontSize:13}}>{schools.reduce((n,s)=>n+s.cards,0)} card records · {schools.length} school groups</span>}
    </div>
    {error&&<p role="alert" style={{color:HQ_THEME.red}}>{error}</p>}
    {loaded&&<>
      <label htmlFor="hq-school-filter" style={{display:'block',fontSize:13,marginBottom:6}}>Find a school</label>
      <input id="hq-school-filter" type="search" value={filter} onChange={e=>setFilter(e.target.value)} placeholder="Search school name" style={{width:'100%',minHeight:44,border:'1px solid '+HQ_THEME.border,background:HQ_THEME.panelSoft,color:HQ_THEME.text,borderRadius:10,padding:'10px 12px',fontSize:15,marginBottom:14}}/>
      <div style={{display:'grid',gap:10}}>
        {summaries.map(s=><section key={normalise(s.name)} style={{border:'1px solid '+HQ_THEME.border,borderRadius:12,padding:14,background:HQ_THEME.panelSoft}}>
          <div style={{display:'flex',justifyContent:'space-between',gap:12,alignItems:'baseline',flexWrap:'wrap'}}>
            <strong style={{fontSize:16,overflowWrap:'anywhere'}}>{s.name}</strong>
            <strong style={{fontSize:18,color:'#dfc27a'}}>{s.cards} cards</strong>
          </div>
          <div style={{display:'grid',gridTemplateColumns:'repeat(2,minmax(0,1fr))',gap:8,marginTop:12,fontSize:13}}>
            <span>Free: <strong>{s.free}</strong></span><span>Paid: <strong>{s.paid}</strong></span>
            <span>Named senders: <strong>{s.senders}</strong></span><span>Named candidates: <strong>{s.candidates}</strong></span>
            <span style={{gridColumn:'1 / -1'}}>Recorded settled value: <strong>{money(s.settledKes)}</strong></span>
          </div>
          <p style={{color:HQ_THEME.muted,fontSize:12,margin:'10px 0 0'}}>Latest: {new Date(s.latest).toLocaleDateString('en-KE',{timeZone:'Africa/Nairobi',dateStyle:'medium'})}</p>
        </section>)}
      </div>
      {summaries.length===0&&<p>No matching schools in loaded records.</p>}
      <p style={{fontSize:12,color:HQ_THEME.muted,marginTop:14}}>Complete records from the existing free and paid gift tables. School names are supplied by senders, not verified school partnerships. Named senders and candidates are approximate counts; settlement values are not bank reconciliation.</p>
    </>}
  </HQPanel>
}
