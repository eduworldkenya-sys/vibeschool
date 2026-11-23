import 'server-only'
import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const NO_STORE = { 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' }
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function response(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: NO_STORE })
}

function enabled() {
  return process.env.MINI_LESSONS_REVIEW_ENABLED === 'true'
}

function sameOrigin(req: NextRequest) {
  const origin = req.headers.get('origin')
  if (!origin) return true // bearer-only, non-browser operations are authenticated
  try {
    const candidate = new URL(origin)
    const host = req.nextUrl.hostname
    return candidate.protocol === 'https:' &&
      (candidate.hostname === host ||
       candidate.hostname === 'vibeschool.co.ke' ||
       candidate.hostname === 'hq.vibeschool.co.ke')
  } catch { return false }
}

function database() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw Error('Mini review service unavailable')
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
}

async function reviewer(req: NextRequest) {
  const bearer = req.headers.get('authorization')?.match(/^Bearer\s+(.+)$/i)?.[1]
  if (!bearer) return null
  const db = database()
  const { data: auth, error } = await db.auth.getUser(bearer)
  const user = error ? null : auth.user
  if (!user) return null
  const { data: membership, error: memberError } = await db.from('hq_human_members')
    .select('role,status,permissions,access_expires_at,revoked_at,suspended_at')
    .eq('profile_id',user.id).maybeSingle()
  if (memberError || !membership || membership.status !== 'active' ||
      membership.revoked_at || membership.suspended_at ||
      (membership.access_expires_at && new Date(membership.access_expires_at).getTime() <= Date.now()) ||
      (membership.role !== 'founder' && !membership.permissions?.includes('content.approve'))) return null
  return { db, actorId: user.id }
}

export async function GET(req: NextRequest) {
  if (!enabled()) return response({ error: 'Mini review is not commissioned' }, 503)
  if (!sameOrigin(req)) return response({ error: 'Forbidden origin' }, 403)
  try {
    const actor = await reviewer(req)
    if (!actor) return response({ error: 'HQ reviewer authorization required' }, 403)
    const [{ data: minis, error: postError }, { data: comments, error: commentError },
      { data: reports, error: reportError }] = await Promise.all([
      actor.db.from('mini_lessons')
        .select('id,creator_id,creator_label,title,body,subject,cover_path,status,created_at')
        .eq('status','pending').order('created_at',{ascending:true}).limit(80),
      actor.db.from('mini_comments')
        .select('id,mini_id,author_id,body,status,created_at')
        .eq('status','pending').order('created_at',{ascending:true}).limit(100),
      actor.db.from('mini_reports')
        .select('mini_id,reason,description,created_at')
        .order('created_at',{ascending:false}).limit(100),
    ])
    if (postError || commentError || reportError) return response({ error: 'Moderation queue unavailable' }, 503)
    return response({ minis: minis ?? [], comments: comments ?? [], reports: reports ?? [] })
  } catch { return response({ error: 'Moderation queue unavailable' }, 503) }
}

export async function PATCH(req: NextRequest) {
  if (!enabled()) return response({ error: 'Mini review is not commissioned' }, 503)
  if (!sameOrigin(req)) return response({ error: 'Forbidden origin' }, 403)
  if (!(req.headers.get('content-type')||'').startsWith('application/json'))
    return response({ error: 'JSON required' }, 415)
  if (Number(req.headers.get('content-length')||'0') > 4096)
    return response({ error: 'Request too large' }, 413)
  try {
    const actor = await reviewer(req)
    if (!actor) return response({ error: 'HQ reviewer authorization required' }, 403)
    const raw = await req.text()
    if (new TextEncoder().encode(raw).byteLength > 4096)
      return response({ error: 'Request too large' }, 413)
    const input: unknown = JSON.parse(raw)
    if (!input || typeof input !== 'object' || Array.isArray(input))
      return response({ error: 'Invalid request' }, 400)
    const data = input as Record<string,unknown>
    const target = data.target
    const decision = data.decision
    const id = data.id
    const reason = data.reason ?? null
    const quality = data.quality ?? 50
    if (!['mini','comment'].includes(String(target)) ||
        !['approved','rejected','hidden'].includes(String(decision)) ||
        typeof id !== 'string' || !UUID.test(id) ||
        (reason !== null && (typeof reason !== 'string' || reason.length > 500)) ||
        typeof quality !== 'number' || !Number.isInteger(quality) || quality < 0 || quality > 100)
      return response({ error: 'Invalid review decision' }, 400)
    const { data: result, error } = await actor.db.rpc('mini_review_item', {
      p_actor: actor.actorId,
      p_target: target,
      p_id: id,
      p_decision: decision,
      p_reason: reason,
      p_quality: quality,
    })
    if (error) return response({ error: error.message }, 409)
    return response({ ok: true, review: result })
  } catch { return response({ error: 'Unable to review this Mini' }, 503) }
}
