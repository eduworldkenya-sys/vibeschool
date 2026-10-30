'use client'
import { useCallback, useEffect, useState } from 'react'
import { hqSupabase } from '@/lib/hq/supabase'
import { HQPanel, HQ_THEME } from '@/components/hq/HQShell'
type Report = { visitors: number; pageViews: number; days: number; truncated: boolean; pages: { path: string; views: number }[]; daily: { date: string; views: number; visitors: number }[]; devices: {name:string;views:number}[]; sources:{name:string;views:number}[]; source: string }
export default function VisitorReport() {
  const [days, setDays] = useState(7)
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
    } catch (reason) { setReport(null); setError(reason instanceof Error ? reason.message : 'Visitor reporting unavailable.') }
    finally { setLoading(false) }
  }, [days])
  useEffect(() => { void refresh() }, [refresh])
  return <HQPanel title="Website visitors" description="Anonymous visits recorded by VibeSchool. Counts start when first-party tracking is deployed; earlier Vercel history is not imported.">
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
      {report.truncated && <p role="status">High traffic: showing the most recent 50,000 page views.</p>}
      <h3 style={{marginTop:20}}>Daily traffic</h3>
      {report.daily.length === 0 ? <p>No visits recorded in this period yet.</p> : <div style={{display:'grid',gap:8}}>{report.daily.map(day => <div key={day.date} style={{display:'flex',justifyContent:'space-between',gap:12,fontSize:13}}><span>{day.date}</span><span>{day.visitors} visitors · {day.views} views</span></div>)}</div>}
      <h3 style={{marginTop:20}}>Traffic sources</h3>
      {report.sources.map(item => <div key={item.name} style={{display:'flex',justifyContent:'space-between',padding:'6px 0'}}><span>{item.name}</span><strong>{item.views}</strong></div>)}
      <h3 style={{marginTop:20}}>Devices</h3>
      {report.devices.map(item => <div key={item.name} style={{display:'flex',justifyContent:'space-between',padding:'6px 0'}}><span>{item.name}</span><strong>{item.views}</strong></div>)}
      <h3 style={{marginTop:20}}>Popular pages</h3>
      {report.pages.map(page => <div key={page.path} style={{display:'flex',justifyContent:'space-between',gap:12,padding:'8px 0',borderBottom:'1px solid '+HQ_THEME.border,fontSize:13}}><span style={{overflowWrap:'anywhere'}}>{page.path}</span><strong>{page.views}</strong></div>)}
      <p style={{fontSize:12,color:HQ_THEME.muted,marginTop:16}}>Source: {report.source}. No visitor names, phone numbers or gift messages are stored.</p>
    </>}
  </HQPanel>
}
