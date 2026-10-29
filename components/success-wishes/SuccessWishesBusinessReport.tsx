'use client'

import { useState } from 'react'
import { HQPanel, HQ_THEME, hqButtonStyle } from '@/components/hq/HQShell'
import { hqSupabase } from '@/lib/hq/supabase'

type Order = { id: string; state: string; amountKes: number; createdAt: string; settledAt: string | null }
type Report = {
  orders: number; states: Record<string, number>; settledOrders: number; settledAmountKes: number
  free: number; freeOpened: number; links: number; linksOpened: number
  recent: Order[]; generatedAt: string
}
const money = (value: number) => 'KSh ' + new Intl.NumberFormat('en-KE').format(value)
const date = (value: string) => new Date(value).toLocaleString('en-KE', { timeZone: 'Africa/Nairobi', dateStyle: 'medium', timeStyle: 'short' })

export default function SuccessWishesBusinessReport() {
  const [report, setReport] = useState<Report | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  async function refresh() {
    if (busy) return
    setBusy(true); setError('')
    try {
      const { data, error: sessionError } = await hqSupabase.auth.getSession()
      if (sessionError || !data.session?.access_token) throw new Error('Sign in to HQ to view reporting.')
      const response = await fetch('/api/hq/success-wishes-report', {
        cache: 'no-store', headers: { Authorization: 'Bearer ' + data.session.access_token },
      })
      if (!response.ok) throw new Error(response.status === 403 ? 'Only the active founder can view this report.' : 'Report unavailable. Try again.')
      setReport(await response.json() as Report)
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Report unavailable.') }
    finally { setBusy(false) }
  }
  return <HQPanel title="Success Cards · Business records"
    description="Founder-only, read-only production records. Settlement values are not a bank reconciliation. Gift links are not additional orders.">
    <button type="button" style={hqButtonStyle} onClick={() => void refresh()} disabled={busy}>
      {busy ? 'Loading records…' : report ? 'Refresh report' : 'Load report'}
    </button>
    {error && <p role="alert" style={{color: HQ_THEME.red}}>{error}</p>}
    {report && <>
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(145px,1fr))',gap:12,margin:'18px 0'}}>
        {([
          ['Settled orders',String(report.settledOrders)],
          ['Recorded settlements',money(report.settledAmountKes)],
          ['All guest orders',String(report.orders)],
          ['Unpaid / other',String(report.orders-report.settledOrders)],
          ['Free wishes',String(report.free)],
          ['Free wishes opened',String(report.freeOpened)],
          ['Paid gift links',String(report.links)],
          ['Paid gift links opened',String(report.linksOpened)],
        ] as const).map(([label,value])=><div key={label} style={{border:'1px solid '+HQ_THEME.border,borderRadius:12,padding:14}}>
          <div style={{fontSize:12,color:HQ_THEME.muted}}>{label}</div>
          <strong style={{fontSize:20,overflowWrap:'anywhere'}}>{value}</strong>
        </div>)}
      </div>
      <p style={{fontSize:13}}>Order states: {Object.entries(report.states).map(([state,count])=>state+' '+count).join(' · ') || 'None'}</p>
      <div style={{overflowX:'auto'}}>
        <table style={{width:'100%',borderCollapse:'collapse',textAlign:'left',fontSize:13}}>
          <caption style={{textAlign:'left',margin:'12px 0',fontWeight:600}}>Most recent 20 orders (no phone numbers or private messages)</caption>
          <thead><tr><th scope="col">Created (EAT)</th><th scope="col">Order</th><th scope="col">Status</th><th scope="col">Amount</th></tr></thead>
          <tbody>{report.recent.map(o=><tr key={o.id} style={{borderTop:'1px solid '+HQ_THEME.border}}>
            <td style={{padding:'10px 6px'}}>{date(o.createdAt)}</td>
            <td style={{padding:'10px 6px',fontFamily:'monospace'}}>{o.id.slice(0,8)}…</td>
            <td style={{padding:'10px 6px'}}>{o.state}</td>
            <td style={{padding:'10px 6px'}}>{money(o.amountKes)}</td>
          </tr>)}</tbody>
        </table>
      </div>
      <p style={{fontSize:12,color:HQ_THEME.muted}}>Updated {date(report.generatedAt)}. Revenue includes only orders marked settled with a settlement timestamp; refunds and provider reconciliation require separate review.</p>
    </>}
  </HQPanel>
}
