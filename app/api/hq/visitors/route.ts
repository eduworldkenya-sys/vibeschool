import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createHmac } from 'node:crypto'
import { revocationDatabase } from '@/lib/success-wishes/server'

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
    const client = db()
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
    const rateKey = createHmac('sha256', process.env.SUPABASE_SERVICE_ROLE_KEY!).update('traffic-rate:' + ip).digest('hex')
    const { data: allowed, error: limitError } = await client.rpc('success_wishes_take_attempt', { p_key_hash: rateKey, p_limit: 100, p_window_seconds: 3600 })
    if (limitError || allowed !== true) return respond({ error: 'Rate limited' }, 429)
    const visitor_hash = createHmac('sha256', process.env.SUPABASE_SERVICE_ROLE_KEY!).update('traffic-visitor:' + body.visitor).digest('hex')
    const { error } = await client.from('hq_visitor_events').insert({ visitor_hash, page_path: path })
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
    const { data, error } = await db().from('hq_visitor_events').select('visitor_hash,page_path,occurred_at').gte('occurred_at', from).order('occurred_at', { ascending: false }).limit(50000)
    if (error) return respond({ error: 'Visitor reporting unavailable' }, 503)
    const events = data || []
    const visitors = new Set(events.map(event => event.visitor_hash)).size
    const pages = new Map<string, number>()
    const daily = new Map<string, { date: string, views: number, visitors: Set<string> }>()
    for (const event of events) {
      pages.set(event.page_path, (pages.get(event.page_path) || 0) + 1)
      const date = event.occurred_at.slice(0, 10)
      if (!daily.has(date)) daily.set(date, { date, views: 0, visitors: new Set() })
      const item = daily.get(date)!
      item.views++
      item.visitors.add(event.visitor_hash)
    }
    return respond({
      visitors, pageViews: events.length, days: period, truncated: events.length === 50000,
      pages: [...pages].sort((a,b) => b[1] - a[1]).slice(0, 10).map(([path, views]) => ({ path, views })),
      daily: [...daily.values()].sort((a,b) => a.date.localeCompare(b.date)).map(item => ({ date: item.date, views: item.views, visitors: item.visitors.size })),
      source: 'VibeSchool first-party tracking',
    })
  } catch { return respond({ error: 'Visitor reporting unavailable' }, 503) }
}
