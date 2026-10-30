'use client'

import { useMemo, useState } from 'react'
import { HQPanel, HQ_THEME, hqButtonStyle } from '@/components/hq/HQShell'
import { hqSupabase } from '@/lib/hq/supabase'

type Card = { id:string; type:'free'|'paid'; createdAt:string; school:string; recipient:string; sender:string; paymentStatus:string; amountKes:number|null; refunded:boolean }
type SchoolSummary = { name:string; cards:number; free:number; paid:number; senders:Set<string>; candidates:Set<string>; settledKes:number; latest:string }
const normalise = (name:string) => name.trim().replace(/\s+/g,' ').toLocaleLowerCase()
const money = (n:number) => 'KSh ' + new Intl.NumberFormat('en-KE').format(n)

export default function SuccessWishesSchoolReport() {
  const [rows,setRows] = useState<Card[]>([])
  const [cursor,setCursor] = useState<string|null>(null)
  const [loaded,setLoaded] = useState(false)
  const [busy,setBusy] = useState(false)
  const [error,setError] = useState('')
  const [filter,setFilter] = useState('')
  async function load(more=false) {
    if(busy)return
    setBusy(true);setError('')
    try {
      const {data,error:authError}=await hqSupabase.auth.getSession()
      if(authError||!data.session?.access_token)throw Error('Sign in to HQ to view school reporting.')
      const response=await fetch('/api/hq/success-wishes-ledger',{
        method:'POST',cache:'no-store',
        headers:{Authorization:'Bearer '+data.session.access_token,'Content-Type':'application/json'},
        body:JSON.stringify({search:'',before:more?cursor:null})
      })
      const result=await response.json()
      if(!response.ok)throw Error(result.error||'School records unavailable.')
      setRows(previous=>{
        const combined=more?[...previous,...result.records]:result.records
        return [...new Map(combined.map((row:Card)=>[row.type+':'+row.id,row])).values()]
      })
      setCursor(result.next||null)
      setLoaded(true)
    }catch(reason){setError(reason instanceof Error?reason.message:'School records unavailable.')}
    finally{setBusy(false)}
  }
  const summaries=useMemo(()=>{
    const grouped=new Map<string,SchoolSummary>()
    for(const row of rows){
      const name=row.school?.trim()||'Not specified'
      const key=normalise(name)
      let school=grouped.get(key)
      if(!school){school={name,cards:0,free:0,paid:0,senders:new Set(),candidates:new Set(),settledKes:0,latest:row.createdAt};grouped.set(key,school)}
      school.cards++
      if(row.type==='free')school.free++;else school.paid++
      if(row.sender)school.senders.add(normalise(row.sender))
      if(row.recipient)school.candidates.add(normalise(row.recipient))
      if(row.type==='paid'&&row.paymentStatus==='settled'&&!row.refunded)school.settledKes+=row.amountKes||0
      if(row.createdAt>school.latest)school.latest=row.createdAt
    }
    return [...grouped.values()].filter(s=>normalise(s.name).includes(normalise(filter))).sort((a,b)=>b.cards-a.cards||a.name.localeCompare(b.name))
  },[rows,filter])
  return <HQPanel title="Schools reached" description="Schools selected by senders, whether or not they participate in VibeSchool. These are reported associations, not verified partnerships.">
    <div style={{display:'flex',gap:10,flexWrap:'wrap',alignItems:'center',marginBottom:14}}>
      <button type="button" style={hqButtonStyle} disabled={busy} onClick={()=>void load(false)}>{busy?'Loading…':loaded?'Refresh schools':'Load schools'}</button>
      {loaded&&<span style={{color:HQ_THEME.muted,fontSize:13}}>{rows.length} card records · {new Set(rows.map(r=>normalise(r.school||'Not specified'))).size} school groups</span>}
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
            <span>Named senders: <strong>{s.senders.size}</strong></span><span>Named candidates: <strong>{s.candidates.size}</strong></span>
            <span style={{gridColumn:'1 / -1'}}>Recorded settled value: <strong>{money(s.settledKes)}</strong></span>
          </div>
          <p style={{color:HQ_THEME.muted,fontSize:12,margin:'10px 0 0'}}>Latest: {new Date(s.latest).toLocaleDateString('en-KE',{timeZone:'Africa/Nairobi',dateStyle:'medium'})}</p>
        </section>)}
      </div>
      {summaries.length===0&&<p>No matching schools in loaded records.</p>}
      {cursor&&<button type="button" style={{...hqButtonStyle,marginTop:14}} disabled={busy} onClick={()=>void load(true)}>{busy?'Loading…':'Load older records'}</button>}
      <p style={{fontSize:12,color:HQ_THEME.muted,marginTop:14}}>Based on loaded ledger pages only; load older records for broader coverage. School names are supplied by senders. Named senders and candidates are approximate counts, not verified unique people. Paid values are indicative, not bank reconciliation.</p>
    </>}
  </HQPanel>
}
