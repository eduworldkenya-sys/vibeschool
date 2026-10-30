'use client'
import { useCallback, useEffect, useState } from 'react'
import { hqSupabase } from '@/lib/hq/supabase'
import { HQPanel, HQ_THEME } from '@/components/hq/HQShell'
type Commerce = { orders:number; settledOrders:number; settledAmountKes:number; free:number; freeOpened:number; links:number; linksOpened:number; states:Record<string,number> }
type Report = { visitors: number; pageViews: number; days: number; truncated: boolean; pages: { path: string; views: number }[]; daily: { date: string; views: number; visitors: number }[]; devices: {name:string;views:number}[]; sources:{name:string;views:number}[]; source: string; repeatVisitors:number; hourly:{hour:number;views:number}[]; recent:{path:string;at:string;device:string;source:string}[] }
export default function VisitorReport() {
  const [days, setDays] = useState(7)
  const [commerce, setCommerce] = useState<Commerce | null>(null)
  const [report, setReport] = useState<Report | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const refresh = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const { data: { session } } = await hqSupabase.auth.getSession()
      if (!session) throw new Error('Sign in to HQ to view visitors.')
      const response = await fetch('/api/hq/visitors?days=' + days, { headers: { Authorization: 'Bearer ' + session.access_token }, cache: 'no-store' })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Visitor reporting unavailable.')
      setReport(result)
      const commerceResponse = await fetch('/api/hq/success-wishes-report', { headers: { Authorization: 'Bearer ' + session.access_token }, cache: 'no-store' })
      if (commerceResponse.ok) setCommerce(await commerceResponse.json())
      else setCommerce(null)
    } catch (reason) { setReport(null); setError(reason instanceof Error ? reason.message : 'Visitor reporting unavailable.') }
    finally { setLoading(false) }
  }, [days])
  useEffect(() => { void refresh() }, [refresh])
  return <HQPanel title="Website visitors" description="Traffic and engagement overview">
    <div style={{display:'flex',gap:8,alignItems:'center',marginBottom:16}}>
      <label htmlFor="visitor-days">Period</label>
      <select id="visitor-days" value={days} onChange={event => setDays(Number(event.target.value))} style={{padding:7,fontSize:13,borderRadius:8,background:HQ_THEME.panelSoft,color:HQ_THEME.text,border:'1px solid '+HQ_THEME.border}}>
        <option value={7}>7 days</option><option value={30}>30 days</option>
      </select>
      <button type="button" disabled={loading} onClick={() => void refresh()} style={{padding:'7px 10px',fontSize:13,borderRadius:8,background:HQ_THEME.panelSoft,color:HQ_THEME.text,border:'1px solid '+HQ_THEME.border}}>{loading ? 'Loading…' : 'Refresh'}</button>
    </div>
    {error && <p role="alert" style={{color:HQ_THEME.red}}>{error}</p>}
    {report && <>
      <div style={{display:'grid',gridTemplateColumns:'repeat(2,minmax(0,1fr))',gap:12}}>
        {([['Visitors',report.visitors],['Page views',report.pageViews]] as const).map(([name,count]) => <div key={name} style={{padding:16,borderRadius:12,background:HQ_THEME.panelSoft}}><div style={{fontSize:13,color:HQ_THEME.muted}}>{name}</div><strong style={{fontSize:28}}>{count.toLocaleString()}</strong></div>)}
      </div>
      {commerce && <section aria-label="Success Wishes business results" style={{marginTop:18}}><h3>Success Wishes business</h3><div style={{display:'grid',gridTemplateColumns:'repeat(2,minmax(0,1fr))',gap:10}}>{([['Revenue (KES)',commerce.settledAmountKes],['Paid orders',commerce.settledOrders],['Free cards',commerce.free],['Cards opened',commerce.freeOpened+commerce.linksOpened]] as const).map(([label,value])=><div key={label} style={{background:HQ_THEME.panelSoft,padding:12,borderRadius:10}}><div style={{fontSize:12,color:HQ_THEME.muted}}>{label}</div><strong style={{fontSize:22}}>{value.toLocaleString()}</strong></div>)}</div><p style={{fontSize:12,color:HQ_THEME.muted}}>Confirmed payments only · {commerce.orders} orders · {commerce.links} paid gifts</p></section>}
      {report.truncated && <p role="status">High traffic: showing the most recent 50,000 page views.</p>}
      <p style={{marginTop:12,fontSize:13,color:HQ_THEME.muted}}>Returning visitors: <strong style={{color:HQ_THEME.text}}>{report.repeatVisitors}</strong></p>
      <h3 style={{marginTop:20}}>Recent visits</h3>
      {report.recent.length===0 ? <p>No visits yet.</p> : <div style={{display:'grid',gap:0}}>{report.recent.map((item,i)=><div key={item.at+i} style={{display:'grid',gridTemplateColumns:'90px minmax(0,1fr)',gap:10,padding:'9px 0',borderBottom:'1px solid '+HQ_THEME.border,fontSize:13}}><span style={{color:HQ_THEME.muted}}>{new Date(item.at).toLocaleTimeString('en-KE',{timeZone:'Africa/Nairobi',hour:'2-digit',minute:'2-digit'})}</span><span style={{overflowWrap:'anywhere'}}>{item.path} <span style={{color:HQ_THEME.muted}}>· {item.device} · {item.source}</span></span></div>)}</div>}
      <h3 style={{marginTop:20}}>Hourly traffic · Kenya time</h3>
      <div style={{display:'grid',gridTemplateColumns:'repeat(12,minmax(0,1fr))',gap:3,alignItems:'end',height:75}}>{report.hourly.map(item=><div key={item.hour} title={item.hour+':00 — '+item.views+' views'} style={{height:Math.max(4,item.views/Math.max(1,...report.hourly.map(h=>h.views))*65)+'px',background:HQ_THEME.cyan,borderRadius:3}} />)}</div>
      <div style={{display:'flex',justifyContent:'space-between',fontSize:11,color:HQ_THEME.muted}}><span>00:00</span><span>12:00</span><span>23:00</span></div>
      <h3 style={{marginTop:20}}>Daily traffic</h3>
      {report.daily.length === 0 ? <p>No visits recorded in this period yet.</p> : <div style={{display:'grid',gap:8}}>{report.daily.map(day => <div key={day.date} style={{display:'flex',justifyContent:'space-between',gap:12,fontSize:13}}><span>{day.date}</span><span>{day.visitors} visitors · {day.views} views</span></div>)}</div>}
      <h3 style={{marginTop:20}}>Traffic sources</h3>
      {report.sources.map(item => <div key={item.name} style={{display:'flex',justifyContent:'space-between',padding:'6px 0'}}><span>{item.name}</span><strong>{item.views}</strong></div>)}
      <h3 style={{marginTop:20}}>Devices</h3>
      {report.devices.map(item => <div key={item.name} style={{display:'flex',justifyContent:'space-between',padding:'6px 0'}}><span>{item.name}</span><strong>{item.views}</strong></div>)}
      <h3 style={{marginTop:20}}>Popular pages</h3>
      {report.pages.map(page => <div key={page.path} style={{display:'flex',justifyContent:'space-between',gap:12,padding:'8px 0',borderBottom:'1px solid '+HQ_THEME.border,fontSize:13}}><span style={{overflowWrap:'anywhere'}}>{page.path}</span><strong>{page.views}</strong></div>)}

    </>}
  </HQPanel>
}
