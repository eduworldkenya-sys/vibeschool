'use client'

import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react'
import { HQPage, HQPanel, HQ_THEME, hqButtonStyle } from '@/components/hq/HQShell'
import { hqSupabase } from '@/lib/hq/supabase'

type Days = '7' | '30' | '90' | 'all'
type Ranked = { name: string; views: number }
type Summary = {
  visitors: number
  pageViews: number
  days: Days
  pathsTracked: number
  truncated: boolean
  repeatVisitors: number
  allPages: { path: string; views: number }[]
  daily: { date: string; views: number; visitors: number }[]
  sources: Ranked[]
  devices: Ranked[]
  recent: { path: string; at: string; device: string; source: string }[]
}
type Visit = { id: number; at: string; path: string; device: string; source: string; browser: string }
type Ledger = { visits: Visit[]; nextCursor: string | null; remainingWithCursor: number | null }

const control: CSSProperties = {
  background: HQ_THEME.panelSoft, border: '1px solid ' + HQ_THEME.border,
  color: HQ_THEME.text, borderRadius: 10, padding: '10px 12px',
  minHeight: 44, fontSize: 13, maxWidth: '100%',
}
const muted: CSSProperties = { color: HQ_THEME.muted, fontSize: 12 }
const numberFormat = new Intl.NumberFormat('en-KE')
function dateTime(value: string) {
  return new Date(value).toLocaleString('en-GB', { timeZone: 'Africa/Nairobi', dateStyle: 'medium', timeStyle: 'short' })
}
function periodLabel(days: Days) {
  return days === 'all' ? 'All recorded history' : 'Last ' + days + ' days'
}
async function authorizedFetch(url: string, signal?: AbortSignal) {
  const { data: { session } } = await hqSupabase.auth.getSession()
  if (!session) throw new Error('Sign in to VibeSchool HQ to see traffic.')
  const response = await fetch(url, {
    headers: { Authorization: 'Bearer ' + session.access_token },
    cache: 'no-store', signal,
  })
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}))
    throw new Error(payload.error || 'Traffic records are unavailable.')
  }
  return response
}

export default function WebsiteTraffic() {
  const [days, setDays] = useState<Days>('30')
  const [tab, setTab] = useState<'overview' | 'visits'>('overview')
  const [summary, setSummary] = useState<Summary | null>(null)
  const [summaryError, setSummaryError] = useState('')
  const [summaryLoading, setSummaryLoading] = useState(true)
  const [visits, setVisits] = useState<Visit[]>([])
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [cursor, setCursor] = useState<string | null>(null)
  const [cursorHistory, setCursorHistory] = useState<Array<string | null>>([])
  const [ledgerError, setLedgerError] = useState('')
  const [ledgerLoading, setLedgerLoading] = useState(true)
  const [refreshKey, setRefreshKey] = useState(0)
  const [pathText, setPathText] = useState('')
  const [pathFilter, setPathFilter] = useState('')
  const [device, setDevice] = useState('')
  const [source, setSource] = useState('')
  const [pageSearch, setPageSearch] = useState('')
  const [pageCount, setPageCount] = useState(35)
  const [exporting, setExporting] = useState(false)
  const [exportError, setExportError] = useState('')

  const resetPages = useCallback(() => {
    setCursor(null)
    setCursorHistory([])
  }, [])

  const loadSummary = useCallback(async (signal: AbortSignal) => {
    setSummaryLoading(true); setSummaryError('')
    try {
      const response = await authorizedFetch('/api/hq/visitors?days=' + days, signal)
      const result = await response.json() as Summary
      if (!signal.aborted) setSummary(result)
    } catch (error) {
      if (!signal.aborted) {
        setSummary(null)
        setSummaryError(error instanceof Error ? error.message : 'Unable to load traffic.')
      }
    } finally { if (!signal.aborted) setSummaryLoading(false) }
  }, [days, refreshKey])

  useEffect(() => {
    const request = new AbortController()
    void loadSummary(request.signal)
    return () => request.abort()
  }, [loadSummary])

  const params = useMemo(() => {
    const query = new URLSearchParams({ mode: 'visits', days, limit: '50' })
    if (pathFilter) query.set('path', pathFilter)
    if (device) query.set('device', device)
    if (source) query.set('source', source)
    if (cursor) query.set('cursor', cursor)
    return query
  }, [days, pathFilter, device, source, cursor])

  useEffect(() => {
    const request = new AbortController()
    async function load() {
      setLedgerLoading(true); setLedgerError('')
      try {
        const response = await authorizedFetch('/api/hq/visitors?' + params.toString(), request.signal)
        const result = await response.json() as Ledger
        if (!request.signal.aborted) {
          setVisits(result.visits)
          setNextCursor(result.nextCursor)
        }
      } catch (error) {
        if (!request.signal.aborted) {
          setVisits([])
          setNextCursor(null)
          setLedgerError(error instanceof Error ? error.message : 'Unable to load visits.')
        }
      } finally { if (!request.signal.aborted) setLedgerLoading(false) }
    }
    void load()
    return () => request.abort()
  }, [params, refreshKey])

  const filteredPages = useMemo(() => {
    const search = pageSearch.trim().toLowerCase()
    return (summary?.allPages || []).filter(item => item.path.toLowerCase().includes(search))
  }, [summary, pageSearch])

  async function downloadCsv() {
    setExporting(true); setExportError('')
    try {
      const query = new URLSearchParams({ mode: 'export', days })
      if (pathFilter) query.set('path', pathFilter)
      if (device) query.set('device', device)
      if (source) query.set('source', source)
      const response = await authorizedFetch('/api/hq/visitors?' + query.toString())
      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = 'vibeschool-visits-' + days + '.csv'
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.setTimeout(() => URL.revokeObjectURL(url), 5000)
    } catch (error) {
      setExportError(error instanceof Error ? error.message : 'Unable to export visits.')
    } finally { setExporting(false) }
  }

  const daily = summary?.daily.slice(-21) || []
  const maxDaily = Math.max(1, ...daily.map(day => day.views))
  const availableSources = (summary?.sources || []).map(item => item.name)

  return <HQPage title="Website traffic" description="Real visits recorded across VibeSchool, in Kenya time."
    actions={<>
      <select aria-label="Traffic period" value={days} onChange={event => { setDays(event.target.value as Days); resetPages() }} style={control}>
        <option value="7">Last 7 days</option>
        <option value="30">Last 30 days</option>
        <option value="90">Last 90 days</option>
        <option value="all">All history</option>
      </select>
      <button type="button" style={hqButtonStyle} onClick={() => setRefreshKey(value => value + 1)}>Refresh</button>
    </>}>
    <div style={{ display: 'flex', gap: 8, marginBottom: 16 }} role="tablist" aria-label="Website traffic views">
      {(['overview', 'visits'] as const).map(value =>
        <button key={value} type="button" role="tab" aria-selected={tab === value} onClick={() => setTab(value)}
          style={{ ...hqButtonStyle, background: tab === value ? 'rgba(59,130,246,.22)' : HQ_THEME.panelSoft,
            borderColor: tab === value ? HQ_THEME.blue : HQ_THEME.border }}>
          {value === 'overview' ? 'Overview' : 'All visits'}
        </button>,
      )}
    </div>

    {tab === 'overview' ? <>
      {summaryError && <p role="alert" style={{ color: HQ_THEME.red }}>{summaryError}</p>}
      {summaryLoading && <p role="status" style={muted}>Loading recorded traffic…</p>}
      {summary && <>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,190px),1fr))', gap: 12, marginBottom: 16 }}>
          {([
            ['Page views', summary.pageViews],
            ['Browser visitors', summary.visitors],
            ['Recorded page paths', summary.pathsTracked],
            ['IDs with multiple views', summary.repeatVisitors],
          ] as const).map(([label, value]) =>
            <div key={label} style={{ padding: '17px 16px', background: HQ_THEME.panel, borderRadius: 14, border: '1px solid ' + HQ_THEME.border }}>
              <div style={muted}>{label}</div>
              <strong style={{ display: 'block', fontSize: 28, letterSpacing: '-.04em', marginTop: 4 }}>{numberFormat.format(value)}</strong>
            </div>,
          )}
        </div>
        {summary.truncated && <p role="status" style={{ color: HQ_THEME.amber }}>Overview reflects only the most recent 50,000 events. Use All visits to page through the complete ledger and narrow CSV exports by period.</p>}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,320px),1fr))', gap: 14, marginBottom: 14 }}>
          <HQPanel title="Traffic over time" description={periodLabel(days)}>
            <div style={{ padding: 16 }}>
              {daily.length === 0 ? <p style={muted}>No visits recorded in this period.</p> :
                <div role="img" aria-label="Daily page view totals in the last 21 recorded days"
                  style={{ height: 174, overflowX: 'auto', display: 'flex', alignItems: 'end', gap: 7, paddingBottom: 18 }}>
                  {daily.map(item => <div key={item.date} title={item.date + ': ' + item.views + ' views, ' + item.visitors + ' visitors'}
                    style={{ flex: '1 0 13px', minWidth: 13, maxWidth: 32, height: Math.max(5, item.views / maxDaily * 135),
                      background: HQ_THEME.blue, borderRadius: '5px 5px 0 0', position: 'relative' }}>
                    <span style={{ position: 'absolute', bottom: -17, left: 0, fontSize: 9, color: HQ_THEME.muted }}>{item.date.slice(-2)}</span>
                  </div>)}
                </div>}
              <p style={muted}>Daily totals · Africa/Nairobi · last 21 recorded days</p>
            </div>
          </HQPanel>
          <HQPanel title="Traffic sources" description="Referral source of recorded page views">
            <div style={{ padding: '10px 16px 16px' }}>
              {summary.sources.length ? summary.sources.slice(0, 10).map(item =>
                <div key={item.name} style={{ display: 'flex', gap: 12, justifyContent: 'space-between', padding: '9px 0', borderBottom: '1px solid ' + HQ_THEME.border, overflowWrap: 'anywhere' }}>
                  <span style={{ fontSize: 13 }}>{item.name}</span><strong>{numberFormat.format(item.views)}</strong>
                </div>) : <p style={muted}>No traffic sources recorded.</p>}
              <h3 style={{ fontSize: 13, marginTop: 20 }}>Devices</h3>
              {summary.devices.map(item => <div key={item.name} style={{ display: 'flex', gap: 12, justifyContent: 'space-between', padding: '7px 0', fontSize: 13 }}>
                <span>{item.name}</span><strong>{numberFormat.format(item.views)}</strong>
              </div>)}
            </div>
          </HQPanel>
        </div>
        <HQPanel title="Every recorded page" description="Search and inspect every unique tracked page path — not just the top ten.">
          <div style={{ padding: 16 }}>
            <label htmlFor="traffic-page-search" style={muted}>Find a page</label>
            <input id="traffic-page-search" type="search" value={pageSearch}
              onChange={event => { setPageSearch(event.target.value); setPageCount(35) }} placeholder="/learn, /teacher, /vibetutor…"
              style={{ ...control, display: 'block', marginTop: 7, width: '100%', maxWidth: 500 }} />
            <p style={{ ...muted, marginTop: 10 }}>{filteredPages.length} matching page paths</p>
            <div style={{ display: 'grid', gap: 0 }}>
              {filteredPages.slice(0, pageCount).map(item =>
                <div key={item.path} style={{ display: 'flex', alignItems: 'center', gap: 12, justifyContent: 'space-between',
                  padding: '11px 0', borderBottom: '1px solid ' + HQ_THEME.border, minWidth: 0 }}>
                  <code style={{ fontSize: 12, overflowWrap: 'anywhere', minWidth: 0 }}>{item.path}</code>
                  <strong style={{ flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}>{numberFormat.format(item.views)}</strong>
                </div>,
              )}
              {filteredPages.length === 0 && <p style={muted}>No pages match this search.</p>}
            </div>
            {filteredPages.length > pageCount && <button type="button" style={{ ...hqButtonStyle, marginTop: 12 }}
              onClick={() => setPageCount(value => value + 50)}>Show more pages ({filteredPages.length - pageCount} remaining)</button>}
          </div>
        </HQPanel>
      </>}
    </> : <>
      <HQPanel title="Visit-by-visit ledger" description="Search recorded page visits, filter devices and sources, and export CSV.">
        <div style={{ padding: 16 }}>
          <form onSubmit={event => {
            event.preventDefault()
            if (pathText.trim() && !/^\/[a-z0-9/_-]{0,79}$/i.test(pathText.trim())) {
              setLedgerError('Enter a path beginning with /, without query strings or special characters.')
              return
            }
            setPathFilter(pathText.trim()); resetPages()
          }} style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'end' }}>
            <label style={{ display: 'grid', gap: 5, flex: '1 1 180px', minWidth: 0 }}>
              <span style={muted}>Page contains</span>
              <input value={pathText} onChange={event => setPathText(event.target.value)}
                placeholder="/student or /learn" style={{ ...control, width: '100%' }} />
            </label>
            <button type="submit" style={hqButtonStyle}>Search pages</button>
            <label style={{ display: 'grid', gap: 5, flex: '1 1 130px' }}>
              <span style={muted}>Device</span>
              <select value={device} onChange={event => { setDevice(event.target.value); resetPages() }} style={{ ...control, width: '100%' }}>
                <option value="">All devices</option>
                {['Mobile', 'Desktop', 'Tablet', 'Unknown'].map(value => <option key={value} value={value}>{value}</option>)}
              </select>
            </label>
            <label style={{ display: 'grid', gap: 5, flex: '1 1 150px' }}>
              <span style={muted}>Source</span>
              <select value={source} onChange={event => { setSource(event.target.value); resetPages() }} style={{ ...control, width: '100%' }}>
                <option value="">All sources</option>
                {availableSources.map(value => <option key={value} value={value}>{value}</option>)}
              </select>
            </label>
          </form>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'space-between', flexWrap: 'wrap', alignItems: 'center', marginTop: 14 }}>
            <span style={muted}>{periodLabel(days)} · 50 events per page</span>
            <button type="button" style={hqButtonStyle} disabled={exporting} onClick={() => void downloadCsv()}>
              {exporting ? 'Preparing CSV…' : 'Download CSV'}
            </button>
          </div>
          {ledgerError && <p role="alert" style={{ color: HQ_THEME.red }}>{ledgerError}</p>}
          {exportError && <p role="alert" style={{ color: HQ_THEME.red }}>{exportError}</p>}
          {ledgerLoading ? <p role="status" style={{ padding: '12px 0', ...muted }}>Loading individual visits…</p> :
            visits.length === 0 ? <p style={{ ...muted, padding: '12px 0' }}>No recorded visits match these filters.</p> :
              <div style={{ display: 'grid', gap: 0, marginTop: 14 }}>
                {visits.map(item => <div key={item.id} style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) auto', gap: 10,
                  padding: '12px 0', borderBottom: '1px solid ' + HQ_THEME.border }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, overflowWrap: 'anywhere' }}>{item.path}</div>
                    <div style={{ ...muted, marginTop: 4, overflowWrap: 'anywhere' }}>{item.device} · {item.source} · Browser {item.browser}</div>
                  </div>
                  <time dateTime={item.at} style={{ ...muted, whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums', textAlign: 'right' }}>{dateTime(item.at)}</time>
                </div>)}
              </div>}
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'space-between', marginTop: 16 }}>
            <button type="button" style={hqButtonStyle} disabled={ledgerLoading || cursorHistory.length === 0}
              onClick={() => {
                const previous = cursorHistory[cursorHistory.length - 1]
                setCursorHistory(items => items.slice(0, -1))
                setCursor(previous)
              }}>Previous</button>
            <span style={muted}>Page {cursorHistory.length + 1}</span>
            <button type="button" style={hqButtonStyle} disabled={ledgerLoading || !nextCursor}
              onClick={() => { setCursorHistory(items => [...items, cursor]); setCursor(nextCursor) }}>Next 50</button>
          </div>
        </div>
      </HQPanel>
    </>}
    <p style={{ ...muted, marginTop: 16, lineHeight: 1.55 }}>
      First-party data starts 30 October 2026. Browser IDs are anonymous identifiers, not confirmed people.
      Bots, blocked tracking, offline visits and some navigation may be missing. API requests are not page visits.
      Only an authorized VibeSchool founder can view this report.
    </p>
  </HQPage>
}
