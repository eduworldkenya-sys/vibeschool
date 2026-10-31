import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createHmac } from 'node:crypto'
import { revocationDatabase } from '@/lib/success-wishes/server'
import { hashSecret } from '@/lib/success-wishes/security'

export const dynamic = 'force-dynamic'
const noStore = { 'Cache-Control': 'private, no-store' }
function respond(body: unknown, status = 200) { return NextResponse.json(body, { status, headers: noStore }) }
function db() { return revocationDatabase() }
const safePath = (value: unknown) => typeof value === 'string' && /^\/[a-z0-9/_-]*$/i.test(value) && value.length <= 160 && !value.startsWith('/hq') && !value.startsWith('/api') ? value : null

export async function POST(req: NextRequest) {
  try {
    if (req.headers.get('origin') !== req.nextUrl.origin) return respond({ error: 'Invalid origin' }, 403)
    if (!(req.headers.get('content-type') || '').startsWith('application/json')) return respond({ error: 'Invalid content type' }, 415)
    if (Number(req.headers.get('content-length') || 0) > 512) return respond({ error: 'Too large' }, 413)
    const body = await req.json()
    const path = safePath(body?.path)
    if (!path || typeof body?.visitor !== 'string' || !/^[0-9a-f-]{36}$/i.test(body.visitor)) return respond({ error: 'Invalid event' }, 400)
    const eventType = ['card_selected','checkout_opened','form_started'].includes(body?.eventType) && path === '/success-wishes' ? body.eventType : 'page_view'
    const eventLabel = eventType === 'card_selected' && typeof body?.label === 'string' && /^[a-z0-9_-]{1,40}$/i.test(body.label) ? body.label : null
    const client = db()
    // Bound anonymous event ingestion by network, not user-supplied visitor IDs.
    const network = (req.headers.get('x-real-ip') || req.headers.get('x-forwarded-for')?.split(',')[0] || 'unknown').slice(0,100)
    const { data: allowed, error: rateError } = await client.rpc('success_wishes_take_attempt', {
      p_key_hash: hashSecret('hq-visitors:rate:' + network), p_limit: 600, p_window_seconds: 60
    })
    if (rateError) return respond({ error: 'Visitor rate limit unavailable' }, 503)
    if (allowed !== true) return respond({ error: 'Rate limited' }, 429)
    const visitor_hash = createHmac('sha256', process.env.SUPABASE_SERVICE_ROLE_KEY!).update('traffic-visitor:' + body.visitor).digest('hex')
    const device = /mobile|android|iphone/i.test(req.headers.get('user-agent') || '') ? 'Mobile' : /ipad|tablet/i.test(req.headers.get('user-agent') || '') ? 'Tablet' : 'Desktop'
    const referrer = typeof body?.referrer === 'string' && /^[a-z0-9.-]{1,100}$/i.test(body.referrer) ? body.referrer : 'Direct'
    const { error } = await client.from('hq_visitor_events').insert({ visitor_hash, page_path: path, device, referrer, event_type: eventType, event_label: eventLabel })
    if (error) return respond({ error: 'Unable to record visit' }, 503)
    return respond({ ok: true })
  } catch { return respond({ error: 'Unable to record visit' }, 503) }
}

export async function GET(req: NextRequest) {
  try {
    const authorization = req.headers.get('authorization') || ''
    const token = authorization.startsWith('Bearer ') ? authorization.slice(7) : ''
    if (!token) return respond({ error: 'Sign in required' }, 401)
    const userClient = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
      global: { headers: { Authorization: 'Bearer ' + token } },
      auth: { persistSession: false, autoRefreshToken: false },
    })
    const { data: identity, error: authError } = await userClient.auth.getUser(token)
    if (authError || !identity.user) return respond({ error: 'Unauthorized' }, 401)
    const { data: owner, error: ownerError } = await userClient.rpc('is_platform_owner')
    if (ownerError || owner !== true) return respond({ error: 'Founder access required' }, 403)
    const period = req.nextUrl.searchParams.get('days') === '30' ? 30 : 7
    const from = new Date(Date.now() - period * 86400000).toISOString()
    const { data, error } = await db().from('hq_visitor_events').select('visitor_hash,page_path,occurred_at,device,referrer,event_type,event_label').gte('occurred_at', from).order('occurred_at', { ascending: false }).limit(50000)
    if (error) return respond({ error: 'Visitor reporting unavailable' }, 503)
    const allEvents = data || []
    const events = allEvents.filter(event => event.event_type === 'page_view')
    const funnel = ['form_started','card_selected','checkout_opened'].map(name=>({name,count:allEvents.filter(event=>event.event_type===name).length}))
    const cardSelections = [...allEvents.filter(event=>event.event_type==='card_selected' && event.event_label).reduce((map,event)=>map.set(event.event_label!, (map.get(event.event_label!)||0)+1),new Map<string,number>())].sort((a,b)=>b[1]-a[1]).map(([name,count])=>({name,count}))
    const visitors = new Set(events.map(event => event.visitor_hash)).size
    const pages = new Map<string, number>()
    const hours = new Map<number, number>()
    const devices = new Map<string, number>()
    const sources = new Map<string, number>()
    const daily = new Map<string, { date: string, views: number, visitors: Set<string> }>()
    for (const event of events) {
      pages.set(event.page_path, (pages.get(event.page_path) || 0) + 1)
      const hour = Number(new Date(event.occurred_at).toLocaleString('en-GB',{hour:'2-digit',hour12:false,timeZone:'Africa/Nairobi'}))
      hours.set(hour,(hours.get(hour)||0)+1)
      devices.set(event.device || 'Unknown', (devices.get(event.device || 'Unknown') || 0) + 1)
      sources.set(event.referrer || 'Direct', (sources.get(event.referrer || 'Direct') || 0) + 1)
      const date = event.occurred_at.slice(0, 10)
      if (!daily.has(date)) daily.set(date, { date, views: 0, visitors: new Set() })
      const item = daily.get(date)!
      item.views++
      item.visitors.add(event.visitor_hash)
    }
    return respond({
      visitors, pageViews: events.length, days: period, truncated: allEvents.length === 50000, funnel, cardSelections,
      recent: events.slice(0,20).map(e => ({path:e.page_path,at:e.occurred_at,device:e.device||'Unknown',source:e.referrer||'Direct'})),
      hourly: Array.from({length:24},(_,hour)=>({hour,views:hours.get(hour)||0})),
      repeatVisitors: [...events.reduce((map,event)=>map.set(event.visitor_hash,(map.get(event.visitor_hash)||0)+1),new Map<string,number>()).values()].filter(count=>count>1).length,
      devices: [...devices].sort((a,b) => b[1]-a[1]).map(([name,views]) => ({name,views})),
      sources: [...sources].sort((a,b) => b[1]-a[1]).slice(0,10).map(([name,views]) => ({name,views})),
      pages: [...pages].sort((a,b) => b[1] - a[1]).slice(0, 10).map(([path, views]) => ({ path, views })),
      daily: [...daily.values()].sort((a,b) => a.date.localeCompare(b.date)).map(item => ({ date: item.date, views: item.views, visitors: item.visitors.size })),
      source: 'VibeSchool first-party tracking',
    })
  } catch { return respond({ error: 'Visitor reporting unavailable' }, 503) }
}
