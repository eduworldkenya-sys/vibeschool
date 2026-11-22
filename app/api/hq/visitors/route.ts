import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createHmac } from 'node:crypto'
import { revocationDatabase } from '@/lib/success-wishes/server'
import { hashSecret } from '@/lib/success-wishes/security'
import {
  csvTrafficCell, kenyaDateKey, normalizeTrafficPagePath,
  parseTrafficCursor, parseTrafficPeriod, parseTrafficSearch,
} from '@/lib/hq/traffic-policy'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
const noStore = { 'Cache-Control': 'private, no-store' }
const ROW_BATCH = 1000
const SUMMARY_LIMIT = 50000
const CSV_LIMIT = 100000
type Visit = {
  id: number
  occurred_at: string
  visitor_hash: string
  page_path: string
  device: string | null
  referrer: string | null
  event_type: string
  event_label: string | null
}
function respond(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: noStore })
}
function db() { return revocationDatabase() }
function periodStart(period: ReturnType<typeof parseTrafficPeriod>): string | null {
  return period === 'all' ? null : new Date(Date.now() - period * 86400000).toISOString()
}

export async function POST(req: NextRequest) {
  try {
    if (req.headers.get('origin') !== req.nextUrl.origin) return respond({ error: 'Invalid origin' }, 403)
    if (!(req.headers.get('content-type') || '').startsWith('application/json')) return respond({ error: 'Invalid content type' }, 415)
    if (Number(req.headers.get('content-length') || 0) > 512) return respond({ error: 'Too large' }, 413)
    const body = await req.json()
    // Never accept query strings, secrets, raw learner identifiers or API endpoints.
    const path = normalizeTrafficPagePath(body?.path)
    if (!path || path !== body.path || typeof body?.visitor !== 'string' || !/^[0-9a-f-]{36}$/i.test(body.visitor)) {
      return respond({ error: 'Invalid event' }, 400)
    }
    const eventType = ['card_selected', 'checkout_opened', 'form_started'].includes(body?.eventType) && path === '/success-wishes'
      ? body.eventType : 'page_view'
    const eventLabel = eventType === 'card_selected' && typeof body?.label === 'string' && /^[a-z0-9_-]{1,40}$/i.test(body.label)
      ? body.label : null
    const client = db()
    const network = (req.headers.get('x-real-ip') || req.headers.get('x-forwarded-for')?.split(',')[0] || 'unknown').slice(0, 100)
    const { data: allowed, error: rateError } = await client.rpc('success_wishes_take_attempt', {
      p_key_hash: hashSecret('hq-visitors:rate:' + network), p_limit: 600, p_window_seconds: 60,
    })
    if (rateError) return respond({ error: 'Visitor rate limit unavailable' }, 503)
    if (allowed !== true) return respond({ error: 'Rate limited' }, 429)
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!key) return respond({ error: 'Visitor tracking unavailable' }, 503)
    const visitor_hash = createHmac('sha256', key).update('traffic-visitor:' + body.visitor).digest('hex')
    const userAgent = req.headers.get('user-agent') || ''
    const device = /ipad|tablet/i.test(userAgent) ? 'Tablet' : /mobile|android|iphone/i.test(userAgent) ? 'Mobile' : 'Desktop'
    const referrer = typeof body?.referrer === 'string' && /^[a-z0-9.-]{1,100}$/i.test(body.referrer) ? body.referrer : 'Direct'
    const { error } = await client.from('hq_visitor_events').insert({
      visitor_hash, page_path: path, device, referrer, event_type: eventType, event_label: eventLabel,
    })
    if (error) return respond({ error: 'Unable to record visit' }, 503)
    return respond({ ok: true })
  } catch {
    return respond({ error: 'Unable to record visit' }, 503)
  }
}

async function authorizedOwner(req: NextRequest) {
  const authorization = req.headers.get('authorization') || ''
  const token = authorization.startsWith('Bearer ') ? authorization.slice(7) : ''
  if (!token) return { error: respond({ error: 'Sign in required' }, 401) }
  const userClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
      global: { headers: { Authorization: 'Bearer ' + token } },
      auth: { persistSession: false, autoRefreshToken: false },
    },
  )
  const { data: identity, error: authError } = await userClient.auth.getUser(token)
  if (authError || !identity.user) return { error: respond({ error: 'Unauthorized' }, 401) }
  const { data: owner, error: ownerError } = await userClient.rpc('is_platform_owner')
  if (ownerError || owner !== true) return { error: respond({ error: 'Founder access required' }, 403) }
  return { error: null }
}

function readVisitFilters(params: URLSearchParams) {
  const path = parseTrafficSearch(params.get('path'))
  const device = params.get('device') || ''
  const source = params.get('source') || ''
  const cursorRaw = params.get('cursor')
  const cursor = parseTrafficCursor(cursorRaw)
  if (path === null || (cursorRaw && !cursor) || (device && !['Desktop', 'Mobile', 'Tablet', 'Unknown'].includes(device))) return null
  if (source && !/^[a-z0-9.-]{1,100}$/i.test(source)) return null
  return { path, device, source, cursor }
}

export async function GET(req: NextRequest) {
  try {
    const access = await authorizedOwner(req)
    if (access.error) return access.error

    const params = req.nextUrl.searchParams
    const period = parseTrafficPeriod(params.get('days'))
    const from = periodStart(period)
    const mode = params.get('mode') || 'summary'

    if (mode === 'visits' || mode === 'export') {
      const filters = readVisitFilters(params)
      if (!filters) return respond({ error: 'Invalid traffic filters' }, 400)
      const { path, device, source, cursor } = filters

      if (mode === 'visits') {
        const rawLimit = params.get('limit') || '50'
        if (!/^(25|50|100)$/.test(rawLimit)) return respond({ error: 'Invalid limit' }, 400)
        const limit = Number(rawLimit)
        let query = db().from('hq_visitor_events')
          .select('id,occurred_at,visitor_hash,page_path,device,referrer', { count: 'exact' })
          .eq('event_type', 'page_view').order('id', { ascending: false }).limit(limit + 1)
        if (from) query = query.gte('occurred_at', from)
        if (path) query = query.ilike('page_path', '%' + path + '%')
        if (device) query = query.eq('device', device)
        if (source) query = query.eq('referrer', source)
        if (cursor) query = query.lt('id', cursor)
        const { data, count, error } = await query
        if (error) return respond({ error: 'Visit ledger unavailable' }, 503)
        const rows = data || []
        const page = rows.slice(0, limit)
        const nextCursor = rows.length > limit ? String(page[page.length - 1].id) : null
        return respond({
          visits: page.map(item => ({
            id: item.id, at: item.occurred_at, path: item.page_path,
            device: item.device || 'Unknown', source: item.referrer || 'Direct',
            browser: item.visitor_hash.slice(0, 12),
          })),
          nextCursor, remainingWithCursor: count, days: period,
        })
      }

      // Export a complete, filtered snapshot; never silently serve a partial CSV.
      let countQuery = db().from('hq_visitor_events').select('id', { count: 'exact', head: true }).eq('event_type', 'page_view')
      if (from) countQuery = countQuery.gte('occurred_at', from)
      if (path) countQuery = countQuery.ilike('page_path', '%' + path + '%')
      if (device) countQuery = countQuery.eq('device', device)
      if (source) countQuery = countQuery.eq('referrer', source)
      const counted = await countQuery
      if (counted.error) return respond({ error: 'Export unavailable' }, 503)
      if ((counted.count || 0) > CSV_LIMIT) return respond({ error: 'Too many rows. Select a shorter period or filter by page to export everything.' }, 413)

      const lines: string[] = [
        ['Event ID', 'Visited at (UTC)', 'Visited at (Kenya time)', 'Page', 'Device', 'Source', 'Anonymous browser ID'].map(csvTrafficCell).join(','),
      ]
      let before: string | null = cursor
      while (true) {
        let query = db().from('hq_visitor_events')
          .select('id,occurred_at,visitor_hash,page_path,device,referrer')
          .eq('event_type', 'page_view').order('id', { ascending: false }).limit(ROW_BATCH)
        if (from) query = query.gte('occurred_at', from)
        if (path) query = query.ilike('page_path', '%' + path + '%')
        if (device) query = query.eq('device', device)
        if (source) query = query.eq('referrer', source)
        if (before) query = query.lt('id', before)
        const { data, error } = await query
        if (error) return respond({ error: 'Export unavailable; no partial data returned' }, 503)
        const rows = data || []
        for (const item of rows) {
          lines.push([
            item.id, item.occurred_at,
            new Date(item.occurred_at).toLocaleString('en-GB', { timeZone: 'Africa/Nairobi', hour12: false }),
            item.page_path, item.device || 'Unknown', item.referrer || 'Direct', item.visitor_hash.slice(0, 12),
          ].map(csvTrafficCell).join(','))
        }
        if (rows.length < ROW_BATCH) break
        before = String(rows[rows.length - 1].id)
        if (lines.length > CSV_LIMIT + 1) return respond({ error: 'Export limit reached; narrow the period' }, 413)
      }
      const filename = 'vibeschool-visits-' + (period === 'all' ? 'all' : String(period) + 'd') + '.csv'
      return new NextResponse('\uFEFF' + lines.join('\r\n') + '\r\n', {
        status: 200, headers: {
          ...noStore, 'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': 'attachment; filename="' + filename + '"',
          'X-Content-Type-Options': 'nosniff',
        },
      })
    }

    if (mode !== 'summary') return respond({ error: 'Invalid reporting mode' }, 400)

    // PostgREST caps individual requests at its configured max-rows (often 1k).
    // Page deliberately so historical traffic is not silently undercounted.
    const allEvents: Visit[] = []
    // Keyset paging freezes the traversal under concurrent new visits.
    // OFFSET paging could skip or duplicate events as the table grows.
    let beforeId: string | null = null
    for (let fetched = 0; fetched < SUMMARY_LIMIT; fetched += ROW_BATCH) {
      let query = db().from('hq_visitor_events')
        .select('id,visitor_hash,page_path,occurred_at,device,referrer,event_type,event_label')
        .order('id', { ascending: false }).limit(ROW_BATCH)
      if (from) query = query.gte('occurred_at', from)
      if (beforeId) query = query.lt('id', beforeId)
      const { data, error } = await query
      if (error) return respond({ error: 'Visitor reporting unavailable' }, 503)
      const rows = (data || []) as Visit[]
      allEvents.push(...rows)
      if (rows.length < ROW_BATCH) break
      beforeId = String(rows[rows.length - 1].id)
    }
    const events = allEvents.filter(event => event.event_type === 'page_view')
    const funnel = ['form_started', 'card_selected', 'checkout_opened'].map(name => ({
      name, count: allEvents.filter(event => event.event_type === name).length,
    }))
    const cardCounts = new Map<string, number>()
    for (const event of allEvents) {
      if (event.event_type === 'card_selected' && event.event_label) {
        cardCounts.set(event.event_label, (cardCounts.get(event.event_label) || 0) + 1)
      }
    }
    const visitors = new Set(events.map(event => event.visitor_hash)).size
    const pages = new Map<string, number>()
    const hours = new Map<number, number>()
    const devices = new Map<string, number>()
    const sources = new Map<string, number>()
    const repeat = new Map<string, number>()
    const daily = new Map<string, { date: string; views: number; visitors: Set<string> }>()
    for (const event of events) {
      pages.set(event.page_path, (pages.get(event.page_path) || 0) + 1)
      const hour = Number(new Date(event.occurred_at).toLocaleString('en-GB', { hour: '2-digit', hour12: false, timeZone: 'Africa/Nairobi' }))
      hours.set(hour, (hours.get(hour) || 0) + 1)
      devices.set(event.device || 'Unknown', (devices.get(event.device || 'Unknown') || 0) + 1)
      sources.set(event.referrer || 'Direct', (sources.get(event.referrer || 'Direct') || 0) + 1)
      repeat.set(event.visitor_hash, (repeat.get(event.visitor_hash) || 0) + 1)
      const date = kenyaDateKey(event.occurred_at)
      if (!daily.has(date)) daily.set(date, { date, views: 0, visitors: new Set() })
      const item = daily.get(date)!
      item.views++
      item.visitors.add(event.visitor_hash)
    }
    const allPages = [...pages].sort((a, b) => b[1] - a[1]).map(([path, views]) => ({ path, views }))
    return respond({
      visitors, pageViews: events.length, days: period, truncated: allEvents.length >= SUMMARY_LIMIT,
      totalTrackedEvents: allEvents.length, pathsTracked: allPages.length, allPages, pages: allPages.slice(0, 10),
      funnel, cardSelections: [...cardCounts].sort((a, b) => b[1] - a[1]).map(([name, count]) => ({ name, count })),
      recent: events.slice(0, 20).map(e => ({ path: e.page_path, at: e.occurred_at, device: e.device || 'Unknown', source: e.referrer || 'Direct' })),
      hourly: Array.from({ length: 24 }, (_, hour) => ({ hour, views: hours.get(hour) || 0 })),
      repeatVisitors: [...repeat.values()].filter(count => count > 1).length,
      devices: [...devices].sort((a, b) => b[1] - a[1]).map(([name, views]) => ({ name, views })),
      sources: [...sources].sort((a, b) => b[1] - a[1]).map(([name, views]) => ({ name, views })),
      daily: [...daily.values()].sort((a, b) => a.date.localeCompare(b.date)).map(item => ({ date: item.date, views: item.views, visitors: item.visitors.size })),
      source: 'VibeSchool first-party tracking',
    })
  } catch {
    return respond({ error: 'Visitor reporting unavailable' }, 503)
  }
}
